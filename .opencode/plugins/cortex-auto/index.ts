import { Plugin } from "@opencode/plugin";
import { spawn } from "node:child_process";
import * as fs from "node:fs";

interface Cache {
  ts: number;
  block?: string;
  task?: { total?: number; todo?: number; doing?: number; done?: number; blocked?: number };
}

export default Plugin.define({
  id: "cortex-auto",
  async setup(ctx) {
    const root = ctx.location.directory;
    const cacheFile = root + "/.cortex-data/context-cache.json";
    const cli = root + "/dist/cli.js";
    const cliTs = root + "/src/cli.ts";
    const node = process.execPath;

    /**
     * Async CLI runner. The previous spawnSync blocked the whole OpenCode
     * event loop on every cache miss (up to 5s); this resolves via events and
     * never blocks a tick.
     */
    const runCli = (args: string[]): Promise<string> =>
      new Promise((resolve) => {
        let settled = false;
        const finish = (v: string) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        const attempt = (argv: string[], onFail: () => void) => {
          try {
            let out = "";
            const p = spawn(node, argv, {
              cwd: root,
              windowsHide: true,
              stdio: ["ignore", "pipe", "ignore"],
            });
            p.stdout.on("data", (d) => {
              out += String(d);
            });
            p.on("error", onFail);
            p.on("close", (code) => {
              if (code === 0 && out.trim()) finish(out.trim());
              else onFail();
            });
          } catch {
            onFail();
          }
        };
        attempt([cli, ...args], () => attempt(["--import", "tsx", cliTs, ...args], () => finish("")));
      });

    const readCache = (): Cache | null => {
      try {
        if (fs.existsSync(cacheFile)) {
          const c = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
          if (c && typeof c.ts === "number") return c as Cache;
        }
      } catch { /* ignore */ }
      return null;
    };

    const writeCache = (c: Cache) => {
      try {
        fs.mkdirSync(root + "/.cortex-data", { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(c));
      } catch { /* ignore */ }
    };

    // Fire-and-forget refresh: the next dispatch picks the fresh cache up.
    const refresh = () => {
      void Promise.all([runCli(["context", "session"]), runCli(["task-summary"])]).then(([block, task]) => {
        let taskObj: Cache["task"];
        try {
          const parsed = JSON.parse(task) as Cache["task"];
          if (parsed && typeof parsed.total === "number") taskObj = parsed;
        } catch { /* ignore */ }
        if (block) writeCache({ ts: Date.now(), block, task: taskObj });
      });
    };

    // Bootstrap once per workspace (async — setup is awaited, not a hook).
    let loaded = false;
    try {
      loaded = (await ctx.storage.get("bootstrapped")) === true;
    } catch { /* storage unavailable in this runtime - fall through to bootstrap */ }
    if (!loaded) {
      await runCli(["bootstrap", root]);
      try {
        fs.mkdirSync(root + "/.cortex-data", { recursive: true });
        fs.writeFileSync(root + "/.cortex-data/.bootstrapped", String(Date.now()));
      } catch { /* ignore */ }
      try { await ctx.storage.set("bootstrapped", true); } catch { /* ignore */ }
    }

    // Inject context before every model dispatch. Synchronous reads only:
    // a stale cache is injected while a background refresh runs, so the hook
    // never waits on a subprocess.
    await ctx.session.hook("context", (event: any) => {
      const cached = readCache();
      const fresh = !!cached && Date.now() - cached.ts < 5 * 60 * 1000;
      if (!fresh) refresh();
      const block = cached?.block || "";
      if (block) {
        event.system = event.system || [];
        event.system.push({ type: "text", text: block });
      }
      const task = cached?.task;
      if (task && typeof task.total === "number" && task.total > 0) {
        event.system = event.system || [];
        event.system.push({
          type: "text",
          text: `Task status: total=${task.total} todo=${task.todo} doing=${task.doing} done=${task.done} blocked=${task.blocked}. Check task_list before starting new work.`,
        });
      }
    });

    return () => {};
  },
});
