import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const ROOT = path.resolve(process.cwd());
const ROOT_FWD = ROOT.replace(/\\/g, "/");

const ENTRY_MCP = { type: "local", command: ["node", ROOT_FWD + "/dist/index.js"], cwd: ROOT_FWD, environment: { CORTEX_DB_DIR: ROOT_FWD + "/.cortex-data" } };
const ENTRY_MCP_SERVERS = { command: "node", args: [ROOT_FWD + "/dist/index.js"], env: { CORTEX_DB_DIR: ROOT_FWD + "/.cortex-data" } };

function mergeJson(p, mutate) {
  let obj = {};
  if (fs.existsSync(p)) {
    try { obj = JSON.parse(fs.readFileSync(p, "utf8")); } catch { obj = {}; }
  }
  mutate(obj);
  // Clean stale/bad entries (e.g. D:/D:/ double-drive paths from older versions).
  const cleanArr = (arr) => Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && !/D:\/D:|D:\\\\D:\\\\/i.test(x)) : arr;
  if (Array.isArray(obj.instructions)) obj.instructions = cleanArr(obj.instructions);
  if (Array.isArray(obj.plugins)) obj.plugins = cleanArr(obj.plugins);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) fs.copyFileSync(p, p + ".bak");
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
  console.log("updated:", p);
}

const home = os.homedir();
const platform = os.platform();

// 1. OpenCode (global)
mergeJson(path.join(home, ".config", "opencode", "opencode.json"), (o) => {
  o.mcp = o.mcp || {};
  o.mcp.cortex = ENTRY_MCP;
  o.instructions = Array.isArray(o.instructions) ? o.instructions : [];
  const instr = ROOT_FWD + "/.opencode/instructions.md";
  if (!o.instructions.includes(instr)) o.instructions.push(instr);
  // Clean stale/duplicate/bad plugin entries; keep only valid cortex-auto.
  o.plugins = Array.isArray(o.plugins) ? o.plugins : [];
  const plug = "file:///" + ROOT_FWD + "/.opencode/plugins/cortex-auto/index.ts";
  o.plugins = [...new Set(o.plugins.filter((x) => x === plug))];
  if (o.plugins.length === 0) o.plugins.push(plug);
});

// Also clean opencode.jsonc if present
const jsoncPath = path.join(home, ".config", "opencode", "opencode.jsonc");
if (fs.existsSync(jsoncPath)) {
  mergeJson(jsoncPath, (o) => {
    o.mcp = o.mcp || {};
    o.mcp.cortex = ENTRY_MCP;
    o.instructions = Array.isArray(o.instructions) ? o.instructions : [];
    const instr = ROOT_FWD + "/.opencode/instructions.md";
    if (!o.instructions.includes(instr)) o.instructions.push(instr);
    o.plugins = Array.isArray(o.plugins) ? o.plugins : [];
    const plug = "file:///" + ROOT_FWD + "/.opencode/plugins/cortex-auto/index.ts";
    o.plugins = [...new Set(o.plugins.filter((x) => x === plug))];
    if (o.plugins.length === 0) o.plugins.push(plug);
  });
}

// 2. Claude Desktop
let claudePath;
if (platform === "win32") claudePath = path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
else if (platform === "darwin") claudePath = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
else claudePath = path.join(home, ".config", "Claude", "claude_desktop_config.json");
mergeJson(claudePath, (o) => {
  o.mcpServers = o.mcpServers || {};
  o.mcpServers.cortex = ENTRY_MCP_SERVERS;
});

// 3. Cursor
mergeJson(path.join(home, ".cursor", "mcp.json"), (o) => {
  o.mcpServers = o.mcpServers || {};
  o.mcpServers.cortex = ENTRY_MCP_SERVERS;
});

// 4. VS Code (user-level mcp.json)
let vscodePath;
if (platform === "win32") vscodePath = path.join(process.env.APPDATA || "", "Code", "User", "mcp.json");
else if (platform === "darwin") vscodePath = path.join(home, "Library", "Application Support", "Code", "User", "mcp.json");
else vscodePath = path.join(home, ".config", "Code", "User", "mcp.json");
mergeJson(vscodePath, (o) => {
  o.servers = o.servers || {};
  o.servers.cortex = { type: "stdio", ...ENTRY_MCP_SERVERS };
});

// 5. Generic: ~/.mcp.json
mergeJson(path.join(home, ".mcp.json"), (o) => {
  o.mcpServers = o.mcpServers || {};
  o.mcpServers.cortex = ENTRY_MCP_SERVERS;
});

// 6. KiloCode
const kilocodePaths = [
  path.join(home, ".config", "Code", "User", "globalStorage", "kilocode.kilo-code", "settings", "mcp_settings.json"),
  path.join(process.env.APPDATA || "", "Code", "User", "globalStorage", "kilocode.kilo-code", "settings", "mcp_settings.json"),
];
for (const kp of kilocodePaths) {
  if (fs.existsSync(path.dirname(kp))) {
    mergeJson(kp, (o) => {
      o.mcpServers = o.mcpServers || {};
      o.mcpServers.cortex = { ...ENTRY_MCP_SERVERS, disabled: false, autoApprove: [] };
    });
    break;
  }
}

// 7. Cline
const clinePaths = [
  path.join(home, ".config", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
  path.join(process.env.APPDATA || "", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
];
for (const cp of clinePaths) {
  if (fs.existsSync(path.dirname(cp))) {
    mergeJson(cp, (o) => {
      o.mcpServers = o.mcpServers || {};
      o.mcpServers.cortex = { ...ENTRY_MCP_SERVERS, disabled: false, autoApprove: [] };
    });
    break;
  }
}

// 8. Windsurf
let windsurfPath;
if (platform === "win32") windsurfPath = path.join(process.env.APPDATA || "", "Windsurf", "User", "mcp_config.json");
else if (platform === "darwin") windsurfPath = path.join(home, "Library", "Application Support", "Windsurf", "User", "mcp_config.json");
else windsurfPath = path.join(home, ".config", "Windsurf", "User", "mcp_config.json");
mergeJson(windsurfPath, (o) => {
  o.mcpServers = o.mcpServers || {};
  o.mcpServers.cortex = ENTRY_MCP_SERVERS;
});

// 9. Zed
const zedPath = platform === "win32"
  ? path.join(process.env.APPDATA || "", "Zed", "settings.json")
  : path.join(home, ".config", "zed", "settings.json");
mergeJson(zedPath, (o) => {
  o.context_servers = o.context_servers || {};
  o.context_servers.cortex = { command: "node", args: [ROOT_FWD + "/dist/index.js"], env: { CORTEX_DB_DIR: ROOT_FWD + "/.cortex-data" } };
});

console.log("\nDone. Restart each client to load MCP Cortex.");
console.log("Note: build first: npm run build");