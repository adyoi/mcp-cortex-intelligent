const REQUIRED = ["read", "edit", "verify", "review"];

export function scoreCompliance(plan: string): { score: number; missing_steps: string[] } {
  const p = plan.toLowerCase();
  const missing = REQUIRED.filter(r => !p.includes(r));
  const score = (REQUIRED.length - missing.length) / REQUIRED.length;
  return { score, missing_steps: missing };
}
