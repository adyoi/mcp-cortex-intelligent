const fs = require("fs");
const p = require("path");
const root = "D:\\\\Project\\\\mcp";
const src = p.join(root, "src", "test", "test-all.ts");
const data = fs.readFileSync(src, "utf8");
const lines = data.split(/\r?\n/);

function write(name, s, e) {
  fs.writeFileSync(p.join(root, "src", "test", name), lines.slice(s-1, e).join("\n"));
  console.log("wrote", name, (e-s+1) + " lines");
}

// Group ranges from grep (approximate by line num from earlier read)
write("test-db-embed-chunk.ts", 58, 245); // 1-5
write("test-mcp.ts", 394, 573);            // 6
write("test-system.ts", 574, 833);         // 7-11

// Create harness
const harness = `
export const TEST_DB = process.env.CORTEX_DB_DIR ?? "./.test-data";
export function check(name: string, cond: unknown, detail?: string) {
  if (cond) console.log("  ✅ " + name); else { console.log("  ❌ " + name + (detail ? " — " + detail : "")); }
}
`;
fs.writeFileSync(p.join(root, "src", "test", "harness.ts"), harness);
console.log("wrote harness.ts");
