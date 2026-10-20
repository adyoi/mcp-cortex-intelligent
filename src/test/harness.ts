
export const TEST_DB = process.env.CORTEX_DB_DIR ?? "./.test-data";
export function check(name: string, cond: unknown, detail?: string) {
  if (cond) console.log("  ✅ " + name); else { console.log("  ❌ " + name + (detail ? " — " + detail : "")); }
}
