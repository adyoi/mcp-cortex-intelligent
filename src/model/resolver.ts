import * as fs from "fs";
import * as path from "path";

export function detectModel(opts: { arg?: string; env?: NodeJS.ProcessEnv; projectRoot?: string }): string {
  if (opts.arg) return opts.arg;
  if (opts.env?.CORTEX_MODEL) return opts.env.CORTEX_MODEL;
  if (opts.env?.OPENCODE_MODEL) return opts.env.OPENCODE_MODEL;
  if (opts.projectRoot) {
    for (const name of ["opencode.json", "opencode.jsonc"]) {
      try {
        const raw = fs.readFileSync(path.join(opts.projectRoot, name), "utf8");
        // Strip JSONC comments (// and /* */) so opencode.jsonc parses.
        const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
        const cfg = JSON.parse(stripped);
        if (cfg?.model) return cfg.model;
      } catch { /* try next */ }
    }
  }
  return "unknown";
}

export function tierOf(model: string): "weak" | "medium" | "strong" {
  const m = model.toLowerCase();
  if (/haiku|mini|small|flash|8b|7b|nano/.test(m)) return "weak";
  if (/opus|gpt-4o|sonnet-4|large|70b|405b/.test(m)) return "strong";
  return "medium";
}
