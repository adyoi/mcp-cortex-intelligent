import { spawnSync } from "node:child_process";

export function runVerification(cmds: string[], cwd: string, timeoutMs: number) {
  return cmds.map(cmd => {
    const r = spawnSync(cmd, { shell: true, cwd, timeout: timeoutMs, encoding: "utf8" });
    return { cmd, exitCode: r.status ?? 1, summary: ((r.stdout || "") + (r.stderr || "")).slice(0, 2000), passed: r.status === 0 };
  });
}
