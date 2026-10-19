/**
 * Auto-setup MCP Cortex Intelligent for multiple clients:
 * OpenCode, Claude Desktop, Cursor, VS Code, and others (generic mcpServers).
 *
 * Merges a "cortex" entry into each client's config (idempotent, backup first).
 * Run: node scripts/setup-clients.mjs
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const ROOT = "D:/Project/mcp";
const ENTRY_MCP = { type: "local", command: ["node", ROOT + "/dist/index.js"], cwd: ROOT, environment: { CORTEX_DB_DIR: ROOT + "/.cortex-data" } };
const ENTRY_MCP_SERVERS = { command: "node", args: [ROOT + "/dist/index.js"], env: { CORTEX_DB_DIR: ROOT + "/.cortex-data" } };

function mergeJson(p, mutate) {
  let obj = {};
  if (fs.existsSync(p)) {
    try { obj = JSON.parse(fs.readFileSync(p, "utf8")); } catch { obj = {}; }
  }
  mutate(obj);
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
  const instr = ROOT + "/.opencode/instructions.md";
  if (!o.instructions.includes(instr)) o.instructions.push(instr);
});

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

// 5. Generic: ~/.mcp.json (some clients)
mergeJson(path.join(home, ".mcp.json"), (o) => {
  o.mcpServers = o.mcpServers || {};
  o.mcpServers.cortex = ENTRY_MCP_SERVERS;
});

console.log("\nDone. Restart each client to load MCP Cortex.");
console.log("Note: build first: npm run build");
