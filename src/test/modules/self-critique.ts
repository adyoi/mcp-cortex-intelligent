import { selfCritique } from "../../cognitive/self-critique.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  const result = selfCritique("the edit was committed and verified", { tier: "strong" });
  ok("returns an object", typeof result === "object" && result !== null);
  ok("has percent (0-100)", typeof result.percent === "number");
  ok("has verdict (ready/revise/blocked)", ["ready", "revise", "blocked"].includes((result as any).verdict));
  ok("checks array present", Array.isArray((result as any).checks));
  return p;
}
