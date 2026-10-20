import { recordToolCall, telemetryStats } from "../../system/telemetry.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  recordToolCall("test_tool", 12, true);
  recordToolCall("test_tool", 8, false);
  const stats = telemetryStats();
  ok("telemetry counts calls", stats.total >= 2, `total=${stats.total}`);
  ok("telemetry reports ok", stats.ok >= 1);
  ok("telemetry reports failed", stats.failed >= 1);
  return p;
}
