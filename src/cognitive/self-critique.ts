/**
 * Structured self-critique.
 *
 * The old version was four regexes and a score. A real critique needs to say
 * *what* is missing, *how bad* it is, and *what to do next* - and it must scale
 * with the model tier: a weak model needs blunt, explicit instructions, a
 * strong model needs a short punch list it can act on.
 */

export type CritiqueSeverity = "blocker" | "major" | "minor";

export interface CritiqueCheck {
  name: string;
  pass: boolean;
  weight: number;
  severity: CritiqueSeverity;
  message: string;
  suggestion: string;
}

export interface CritiqueResult {
  /** 0..1 ratio, kept for backward compatibility with existing callers. */
  score: number;
  /** 0..100 integer, easier to reason about and to threshold on. */
  percent: number;
  issues: string[];
  suggestions: string[];
  checks: CritiqueCheck[];
  /** blocker | major | minor - the worst severity found, or "clean". */
  severity: CritiqueSeverity | "clean";
  /** ready | revise | blocked */
  verdict: "ready" | "revise" | "blocked";
  tier: "weak" | "medium" | "strong";
  summary: string;
}

interface Rule {
  name: string;
  weight: number;
  severity: CritiqueSeverity;
  test: RegExp;
  fail: RegExp;
  message: string;
  suggestion: string;
}

/**
 * Ordered by weight: a missing verification is worth more than a missing
 * mention of "review" in the notes.
 */
const RULES: Rule[] = [
  {
    name: "read_before_edit",
    weight: 5,
    severity: "blocker",
    test: /\b(read|inspect|open|view|grep|look at)\b/i,
    fail: /^\s*$/,
    message: "No evidence the target file was read before editing.",
    suggestion: "Read the target (read/grep) and show the relevant section before proposing edits.",
  },
  {
    name: "has_verification",
    weight: 5,
    severity: "blocker",
    test: /npm\s+(test|run\s+lint|run\s+typecheck)|run_verification|\b(lint|typecheck|tsc)\b/i,
    fail: /^\s*$/,
    message: "No verification command (test/lint/typecheck).",
    suggestion: "Run `run_verification` (npm test, npm run lint, npm run typecheck) and report the results.",
  },
  {
    name: "has_tests",
    weight: 4,
    severity: "major",
    test: /\b(test|spec|coverage|vitest|jest|node:test|assert)\b/i,
    fail: /^\s*$/,
    message: "Code change without tests.",
    suggestion: "Add a test that covers the new/changed behavior.",
  },
  {
    name: "no_secrets",
    weight: 5,
    severity: "blocker",
    test: /(?!)/,
    fail: /(api[_-]?key|secret|token|password|passwd|bearer|private[_-]?key)\s*[:=]\s*["'][^"']{6,}/i,
    message: "Possible literal secret in the artifact.",
    suggestion: "Replace literal secrets with env vars; never persist credentials.",
  },
  {
    name: "no_destructive_without_backup",
    weight: 4,
    severity: "blocker",
    test: /(backup|\.bak|rollback|restore|confirm|snapshot)/i,
    fail: /(rm\s+-rf|drop\s+table|delete\s+from|truncate\s+table|format\s+[a-z]:)/i,
    message: "Destructive action without backup/rollback.",
    suggestion: "Create a backup/rollback plan (or `knowledge_backup`) before running a destructive action.",
  },
  {
    name: "has_plan",
    weight: 3,
    severity: "minor",
    test: /\b(plan|step|steps|approach|strategy)\b/i,
    fail: /^\s*$/,
    message: "No plan or steps stated.",
    suggestion: "Write 2-3 short steps before executing (Read -> Edit -> Verify).",
  },
  {
    name: "has_review",
    weight: 2,
    severity: "minor",
    test: /\b(review|diff|self[- ]critique|check again|double[- ]check)\b/i,
    fail: /^\s*$/,
    message: "No review step over the result.",
    suggestion: "Review the diff/output before declaring it done.",
  },
  {
    name: "no_debug_leftovers",
    weight: 2,
    severity: "minor",
    test: /(?!)/,
    fail: /(console\.log\(|debugger;|\bTODO\b|\bFIXME\b|\bXXX\b|print\()/i,
    message: "Leftover debug statements or TODOs.",
    suggestion: "Remove leftover console.log/debug/TODO before finishing.",
  },
  {
    name: "error_handling",
    weight: 3,
    severity: "major",
    test: /(try\s*\{|catch\s*\(|throw\s+new|error handling|fallback|guard|validate)/i,
    fail: /^\s*$/,
    message: "Error handling is not addressed.",
    suggestion: "Add input validation and an error path (try/catch, guard, clear message).",
  },
  {
    name: "no_hardcoded_machine_paths",
    weight: 2,
    severity: "minor",
    test: /(?!)/,
    fail: /([A-Z]:\\Users\\|\/home\/[a-z0-9_-]+\/|\/Users\/[A-Za-z0-9_-]+\/)/i,
    message: "Hardcoded absolute machine path.",
    suggestion: "Use relative paths or configuration/env so the change stays portable.",
  },
  {
    name: "docs_or_changelog_updated",
    weight: 1,
    severity: "minor",
    test: /(readme|changelog|docs\/|documentation|AGENTS\.md|PLAN\.md|TASK\.md)/i,
    fail: /^\s*$/,
    message: "Docs/CHANGELOG not touched although behavior changed.",
    suggestion: "Update README/CHANGELOG when public behavior changes.",
  },
];

const TIER_WEIGHT: Record<"weak" | "medium" | "strong", number> = {
  // A weak model gets fewer, blunter, higher-weight instructions.
  weak: 1.2,
  medium: 1.0,
  strong: 0.85,
};

export interface SelfCritiqueOptions {
  tier?: "weak" | "medium" | "strong";
  /** Percent below which the verdict becomes "revise" (default 80). */
  threshold?: number;
}

export function selfCritique(artifact: string, opts: SelfCritiqueOptions = {}): CritiqueResult {
  const tier = opts.tier ?? "medium";
  const threshold = opts.threshold ?? 80;
  const text = artifact ?? "";

  const checks: CritiqueCheck[] = RULES.map((r) => {
    const pass = r.test.source === "(?!)" ? !r.fail.test(text) : r.test.test(text);
    return {
      name: r.name,
      pass,
      weight: r.weight,
      severity: r.severity,
      message: r.message,
      suggestion: r.suggestion,
    };
  });

  const tierFactor = TIER_WEIGHT[tier];
  let total = 0;
  let earned = 0;
  for (const c of checks) {
    const w = c.weight * tierFactor;
    total += w;
    if (c.pass) earned += w;
  }
  const ratio = total > 0 ? earned / total : 0;
  const percent = Math.round(ratio * 100);

  const failed = checks.filter((c) => !c.pass);
  // Blockers first, then major, then minor.
  const order: CritiqueSeverity[] = ["blocker", "major", "minor"];
  failed.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || b.weight - a.weight);

  const issues = failed.map((c) => `[${c.severity}] ${c.message}`);
  const suggestions = failed.map((c) => c.suggestion);

  const severity: CritiqueSeverity | "clean" = failed.length === 0
    ? "clean"
    : (failed.find((c) => c.severity === "blocker")?.severity
      ?? failed.find((c) => c.severity === "major")?.severity
      ?? "minor");

  const hasBlocker = failed.some((c) => c.severity === "blocker");
  const verdict: CritiqueResult["verdict"] = hasBlocker
    ? "blocked"
    : percent >= threshold
      ? "ready"
      : "revise";

  const summary = failed.length === 0
    ? `All ${checks.length} checks passed. Ready to deliver.`
    : `${failed.length}/${checks.length} checks failed (${percent}%). Top issue: ${failed[0].message}`;

  return {
    score: ratio,
    percent,
    issues,
    suggestions,
    checks,
    severity,
    verdict,
    tier,
    summary,
  };
}
