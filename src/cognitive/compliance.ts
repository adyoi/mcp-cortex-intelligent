const REQUIRED = ["read", "edit", "verify", "review"];

const SECRET_RE = /(api[_-]?key|token|password|secret)\s*[:=]/i;
const VERIFY_CMD_RE = /npm (test|run lint|run typecheck)|yarn (test|lint)|pnpm (test|lint)|cargo (test|clippy)|pytest|ruff|mypy|go (test|vet)/i;

export interface ComplianceResult {
  score: number;
  missing_steps: string[];
  issues: string[];
  has_secrets: boolean;
  has_verification_command: boolean;
}

export function scoreCompliance(plan: string): ComplianceResult {
  const p = plan.toLowerCase();
  const missing = REQUIRED.filter((r) => !p.includes(r));
  const issues: string[] = [];
  for (const m of missing) issues.push(`Missing required step: ${m}`);
  const hasSecrets = SECRET_RE.test(plan);
  if (hasSecrets) issues.push("Possible secret in plan.");
  const hasVerifyCmd = VERIFY_CMD_RE.test(plan);
  if (!hasVerifyCmd && p.includes("verify")) issues.push("Verification mentioned but no concrete command.");
  const base = (REQUIRED.length - missing.length) / REQUIRED.length;
  const penalty = (hasSecrets ? 0.25 : 0) + (!hasVerifyCmd && p.includes("verify") ? 0.1 : 0);
  const score = Math.max(0, Math.min(1, base - penalty));
  return { score, missing_steps: missing, issues, has_secrets: hasSecrets, has_verification_command: hasVerifyCmd };
}