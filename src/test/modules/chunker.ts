import { chunkText } from "../../knowledge/chunker.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  const long = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}: The quick brown fox.`).join("\n\n");
  const ch = chunkText(long);
  ok(">1 chunk", ch.length > 1, `got ${ch.length}`);
  ok("no empty", ch.every((c: any) => c.text.trim().length > 0));
  ok("sequential index", ch.every((c: any, i: number) => c.index === i));
  ok("under max", ch.every((c: any) => c.text.length <= 950));
  return p;
}
