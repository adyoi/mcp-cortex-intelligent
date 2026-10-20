import { tierOf } from "./resolver.js";

export function taskRisk(task: string, files: string[]): "low" | "medium" | "high" {
  const t = task.toLowerCase();
  // Destructive verbs only count as high risk when they target a real object
  // (file/db/table), not when they appear in prose like "delete a typo".
  if (/\b(delete|drop|wipe|rm)\s+(the\s+)?(file|table|db|database|user|row|record|collection|schema|dir|directory|folder)\b/.test(t)) return "high";
  if (/\b(secret|password|token|credential|api[_-]?key)\b/.test(t)) return "high";
  if (/\b(refactor|migration|schema\s+change)\b/.test(t)) return "medium";
  if (files.length > 10) return "medium";
  return "low";
}

export function procedureRoute(task: string): string {
  const t = task.toLowerCase();
  if (/debug|fix|bug/.test(t)) return "debug";
  if (/refactor/.test(t)) return "refactor";
  if (/plan|design/.test(t)) return "plan";
  if (/doc|readme/.test(t)) return "docs";
  return "code_edit";
}

export function modelDecision(model: string, task: string, files: string[]) {
  const tier = tierOf(model);
  const risk = taskRisk(task, files);
  const needsVerify = risk !== "low" || tier === "weak";
  const route = procedureRoute(task);
  return { tier, risk, needsVerify, route, rationale: "rule-based" };
}
