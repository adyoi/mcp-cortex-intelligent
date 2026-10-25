import { getDB } from "../db/database.js";

export interface DecisionResult {
  answers: Record<string, unknown>;
  risk?: "low" | "medium" | "high";
  needsVerify?: boolean;
  rationale: string;
  latencyMs: number;
}

function assessRisk(state: string): "low" | "medium" | "high" {
  const s = (state ?? "").toLowerCase();
  if (/(delete|drop|remove|reset|force|migration|secret|token|password|destructive|wipe)/.test(s)) return "high";
  if (/(refactor|rename|move|restructure|schema|auth)/.test(s)) return "medium";
  return "low";
}

export function decisionClassify(input: { state: string; questions: any }): DecisionResult {
  const t0 = Date.now();
  const state = input?.state ?? "";
  const questions = input?.questions ?? {};
  const risk = assessRisk(state);
  const needsVerify = risk !== "low";
  const answers: Record<string, unknown> = {};

  for (const key of Object.keys(questions)) {
    const q = questions[key];
    const opts: unknown[] = Array.isArray(q?.options) ? q.options : Array.isArray(q) ? q : [];
    let choice: unknown = opts.length ? opts[0] : "default";
    // Prefer a safe/verify option when risk is high.
    if (risk === "high" && opts.length > 0) {
      const safe = opts.find((o) => /verify|safe|backup|test|review/i.test(String((o as { label?: unknown })?.label ?? o)));
      if (safe) choice = safe;
    }
    answers[key] = { choice, score: risk === "high" ? 0.9 : risk === "medium" ? 0.7 : 0.5, risk, needsVerify };
  }

  return {
    answers,
    risk,
    needsVerify,
    rationale: `heuristic: risk=${risk}, keys=${Object.keys(questions).length}`,
    latencyMs: Date.now() - t0,
  };
}

export function decisionHealth() {
  try {
    const db = getDB();
    const n = (db.prepare("SELECT COUNT(*) AS c FROM decisions").get() as { c: number }).c;
    return { status: "ok", backend: "internal", decisions: n, latencyMs: 0 };
  } catch {
    return { status: "ok", backend: "internal", decisions: 0, latencyMs: 0 };
  }
}