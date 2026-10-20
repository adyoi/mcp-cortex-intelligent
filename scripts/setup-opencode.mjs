import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const home = os.homedir();
const cfgDir = path.join(home, ".config", "opencode");
const files = ["opencode.json", "opencode.jsonc"];
const ROOT = path.resolve(__dirname, "..");
const ROOT_FWD = ROOT.replace(/\\/g, "/");
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
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
  console.log("updated", p);
}
