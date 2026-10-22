import "./env.js";
import { closeDB } from "./db/database.js";

// Graceful shutdown: flush WAL + close the SQLite handle so a SIGTERM/SIGINT
// (container stop, Ctrl+C, process manager) never leaves a locked DB behind.
function shutdown(_signal: string): void {
  try {
    closeDB();
  } catch {
    /* best-effort: never throw out of a signal handler */
  }
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await import("./mcp/cortex-server.js");
