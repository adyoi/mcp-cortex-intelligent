export const CortexAutoPlugin = async ({ directory }: { directory?: string }) => {
  const root = directory ?? process.cwd();
  const cacheFile = root + "/.cortex-data/context-cache.json";
  const cli = "D:/Project/mcp/dist/cli.js";
  const node = process.execPath;

  const runCli = (args: string[]): string => {
    try {
      const { execFileSync } = require("node:child_process");
      return execFileSync(node, [cli, ...args], {
        cwd: root,
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };

  // Bootstrap once per workspace.
  try {
    const { readFileSync, existsSync } = require("node:fs");
    const flag = root + "/.cortex-data/.bootstrapped";
    if (!existsSync(flag)) {
      runCli(["bootstrap", root]);
      require("node:fs").writeFileSync(flag, String(Date.now()));
    }
  } catch { /* never break the chat */ }

  // Inject context before every model dispatch.
  const ctxHook = async (ctx: any) => {
    try {
      await ctx.session.hook("context", (event: any) => {
        let block = "";
        try {
          const fs = require("node:fs");
          if (fs.existsSync(cacheFile)) {
            const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
            if (cached && Date.now() - cached.ts < 5 * 60 * 1000) block = cached.block || "";
          }
        } catch { /* ignore */ }
        if (!block) block = runCli(["context", "session"]);
        if (block) {
          event.system = event.system || [];
          event.system.push({ type: "text", text: block });
        }
        // Task status
        try {
          const out = runCli(["task-summary"]);
          const summary = JSON.parse(out);
          if (summary && summary.total > 0) {
            event.system = event.system || [];
            event.system.push({ type: "text", text: `Task status: total=${summary.total} todo=${summary.todo} doing=${summary.doing} done=${summary.done} blocked=${summary.blocked}. Check task_list before starting new work.` });
          }
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  };

  // Best-effort: register hook if supported.
  try { await ctxHook(ctx as any); } catch { /* ignore */ }

  return {
    event: async ({ event }: { event: { type?: string } }) => {
      const t = event?.type;
      if (t === "session.created" || t === "session.updated") {
        try {
          const flag = root + "/.cortex-data/.bootstrapped";
          const fs = require("node:fs");
          if (!fs.existsSync(flag)) {
            runCli(["bootstrap", root]);
            fs.writeFileSync(flag, String(Date.now()));
          }
        } catch { /* ignore */ }
      }
    },
  };
};
