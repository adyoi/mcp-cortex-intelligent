import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/** Strip slash-slash and slash-star comments from JSONC without touching strings. */
function stripJsonComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let inStr = false;
  let strQuote = "";
  while (i < n) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
      if (c === strQuote) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strQuote = c; out += c; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    out += c;
    i++;
  }
  return out;
}

export function detectModel(opts: { arg?: string; env?: NodeJS.ProcessEnv; projectRoot?: string }): string {
  if (opts.arg) return opts.arg;
  if (opts.env?.CORTEX_MODEL) return opts.env.CORTEX_MODEL;
  if (opts.env?.OPENCODE_MODEL) return opts.env.OPENCODE_MODEL;
  const roots: string[] = [];
  if (opts.projectRoot) roots.push(opts.projectRoot);
  roots.push(path.join(os.homedir(), ".config", "opencode"));
  roots.push(path.join(os.homedir(), ".opencode"));
  for (const root of roots) {
    for (const name of ["opencode.json", "opencode.jsonc"]) {
      try {
        const raw = fs.readFileSync(path.join(root, name), "utf8");
        let cfg: { model?: string } | null = null;
        try { cfg = JSON.parse(raw); } catch {
          // JSONC: strip comments only outside strings.
          const stripped = stripJsonComments(raw);
          cfg = JSON.parse(stripped);
        }
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
