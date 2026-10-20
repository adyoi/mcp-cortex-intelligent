import { embed, EMBED_DIM, cosineSimilarity, dotProduct } from "../../knowledge/embedder.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  const e1 = embed("fetch weather for Jakarta");
  const e2 = embed("fetch weather for Jakarta");
  ok("embed deterministic", Array.from(e1).every((v, i) => v === e2[i]));
  ok("embed dim", e1.length === EMBED_DIM);
  ok("normalized", Math.abs(1 - Math.sqrt([...e1].reduce((s, v) => s + v * v, 0))) < 1e-9);
  ok("similar > diff", cosineSimilarity(e1, e2) > cosineSimilarity(e1, embed("buy groceries")));
  ok("dot == cosine norm", Math.abs(dotProduct(e1, e2) - cosineSimilarity(e1, e2)) < 1e-9);
  const cjk = embed("该引擎支持中文检索");
  ok("CJK embed", cosineSimilarity(cjk, embed("该引擎支持中文检索")) > 0.99);
  return p;
}
