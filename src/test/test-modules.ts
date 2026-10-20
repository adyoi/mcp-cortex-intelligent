import * as path from "path";
import * as fs from "fs";
process.env.CORTEX_DB_DIR = ".test-data";

const results: Array<{ file: string; passed: number; failed: number; errors: string[] }> = [];

async function main() {
  const suiteDir = path.join(import.meta.dirname ?? ".", "modules");
  const files = fs.readdirSync(suiteDir).filter((f) => f.endsWith(".ts"));
  for (const f of files.sort()) {
    const { run } = await import(path.join(suiteDir, f));
    const res = await run();
    results.push({ file: f, passed: res.passed ?? 0, failed: res.failed ?? 0, errors: res.failures ?? [] });
    console.log(`=== ${f}: ${res.passed ?? 0} passed, ${res.failed ?? 0} failed ===`);
  }

  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  console.log(`\n=== MODULE TEST RESULTS ===`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  for (const r of results) {
    console.log(`  ${r.file}: ${r.passed}/${r.passed + r.failed}`);
  }
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
