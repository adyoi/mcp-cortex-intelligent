import { detectModel, tierOf } from "../../model/resolver.js";
import { getGuardrails } from "../../model/guardrails.js";
import { modelDecision } from "../../model/model-decision.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  const model = detectModel({ env: process.env, projectRoot: "." });
  ok("detect model returns id", typeof model === "string" && model.length > 0, model);
  ok("tier computed", ["weak", "medium", "strong"].includes(tierOf(model)), tierOf(model));
  const g = getGuardrails(model, "session_start");
  ok("guardrails is text", typeof g === "string" && g.length > 20);
  ok("guardrails mentions route", g.includes("Route:"), g.slice(0, 80));
  ok("guardrails mentions risk", g.includes("Risk:"), g.slice(0, 80));
  ok("guardrails lists anti-blunder", g.toLowerCase().includes("anti-blunder"));
  const d = modelDecision(model, "edit", []);
  ok("decision has tier", typeof d.tier === "string");
  ok("decision has route", typeof d.route === "string");
  return p;
}
