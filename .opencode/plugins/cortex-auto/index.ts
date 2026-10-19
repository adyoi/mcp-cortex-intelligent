import { Plugin } from "@opencode/plugin";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";

export default Plugin.define({
  id: "cortex-auto",
  async setup(ctx) {
    const root = ctx.location.directory;
    const cacheFile = root + "/.cortex-data/context-cache.json";
    const cli = "D:/Project/mcp/dist/cli.js";
    const node = process.execPath;

    const runCli = (args: string[]): string => {
      for (const argv of [[cli, ...args], ["--import", "tsx", "D:/Project/mcp/src/cli.ts", ...args]]) {
        try {
          const r = spawnSync(node, argv, {
            cwd: root,
            encoding: "utf8",
            timeout: 5000,
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"],
          });
          if (r.status === 0 && r.stdout) return String(r.stdout).trim();
        } catch { /* ignore */ }
      }
      return "";
    };

    // Bootstrap once per workspace.
    const loaded = await ctx.storage.get("bootstrapped");
    if (!loaded) {
      runCli(["bootstrap", root]);
      try {
        fs.mkdirSync(root + "/.cortex-data", { recursive: true });
        fs.writeFileSync(root + "/.cortex-data/.bootstrapped", String(Date.now()));
      } catch { /* ignore */ }
      await ctx.storage.set("bootstrapped", true);
    }

    // Inject context before every model dispatch.
    await ctx.session.hook("context", (event: any) => {
      let block = "";
      try {
        if (fs.existsSync(cacheFile)) {
          const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
          if (cached && Date.now() - cached.ts < 5 * 60 * 1000) block = cached.block || "";
        }
      } catch { /* ignore */ }
      if (!block) block = runCli(["context", "session"]);
      if (block) {
        event.system = event.system || [];
        event.system.push({ type: "text", text: block });
        // cache for next calls
        try {
          fs.mkdirSync(root + "/.cortex-data", { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), block }));
        } catch { /* ignore */ }
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

    return () => {};
  },
});
