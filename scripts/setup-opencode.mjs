import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Resolve project root robustly on Windows (avoid leading-slash drive letters).
const ROOT = path.resolve(process.cwd());
const ROOT_FWD = ROOT.replace(/\\/g, "/");

const home = os.homedir();
const cfgDir = path.join(home, ".config", "opencode");
const files = ["opencode.json", "opencode.jsonc"];
const entry = {
  type: "local",
  command: ["node", ROOT_FWD + "/dist/index.js"],
  cwd: ROOT_FWD,
  environment: { CORTEX_DB_DIR: ROOT_FWD + "/.cortex-data" },
};
const instr = ROOT_FWD + "/.opencode/instructions.md";

for (const name of files) {
  const p = path.join(cfgDir, name);
  let obj = {};
  if (fs.existsSync(p)) {
    try { obj = JSON.parse(fs.readFileSync(p, "utf8")); } catch { obj = {}; }
  }
  obj.mcp = obj.mcp || {};
  obj.mcp.cortex = entry;
  obj.instructions = Array.isArray(obj.instructions) ? obj.instructions : [];
  if (!obj.instructions.includes(instr)) obj.instructions.push(instr);
  obj.instructions = [...new Set(obj.instructions.filter((x) => typeof x === "string" && !/D:\/D:|D:\\\\D:\\\\/i.test(x)))];
  // Only cortex-auto plugin (no external session-logger dependency).
  obj.plugins = Array.isArray(obj.plugins) ? obj.plugins : [];
  const plug = "file:///" + ROOT_FWD + "/.opencode/plugins/cortex-auto/index.ts";
  // Remove any stale/duplicate/bad entries, keep only the valid cortex-auto one.
  obj.plugins = [...new Set(obj.plugins.filter((x) => x === plug))];
  if (obj.plugins.length === 0) obj.plugins.push(plug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
  console.log("updated:", p);
}

console.log("Done.");