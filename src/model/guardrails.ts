import { tierOf } from "./resolver.js";
import { procedureRoute, taskRisk } from "./model-decision.js";

export function getGuardrails(model: string, task: string): string {
  const tier = tierOf(model);
  const risk = taskRisk(task, []);
  const route = procedureRoute(task);
  const isDocTask = /doc|readme|md|plan/.test(task.toLowerCase());
  const isDelete = /delete|drop|wipe|rm/.test(task.toLowerCase());

  const base = `Model: ${model} (tier: ${tier})\nTask: ${task}\nRoute: ${route} | Risk: ${risk}\n`;

  // Procedure depends on tier + route (not one-size-fits-all)
  const proc = tier === "weak"
    ? `Mandatory (weak - proceed with care):\n1. Read the target fully.\n2. Write a short plan.\n3. Apply minimal edits.\n4. Verify (test+lint+typecheck).\n5. Review the diff before commit.\n`
    : tier === "medium"
    ? `Standard: Plan -> Read -> Edit -> Verify -> Review.\n`
    : `Concise (strong - fast but safe): Read -> Edit -> Verify.\n`;

  // Anti-blunder is risk-adaptive, not static
  const anti = [
    isDelete ? "- CAUTION: destructive action (delete) - ensure backup/rollback is ready." : null,
    "- Do not assume a path exists; read first.",
    "- Do not edit without reading the full content.",
    "- Do not skip verification just because it looks simple.",
    risk === "high" ? "- High risk: mandatory manual review + test + lint + typecheck." : null,
    isDocTask ? "- For docs: keep consistency with PLAN/TASK and never store secrets." : "- Never store secrets / tokens / passwords.",
    "- Run `run_verification` before finishing.",
    tier === "strong" ? "- Regardless of strength, still verify any code that touches DB/auth." : null,
  ].filter(Boolean).join("\n");

  const verify = tier === "weak"
    ? `Verification required (weak): npm test + npm run lint + npm run typecheck + review diff.\n`
    : `Verification: npm test, npm run lint, npm run typecheck. Recommend running before marking done.\n`;

  return base + proc + "\nAnti-blunder:\n" + anti + "\n\n" + verify;
}
