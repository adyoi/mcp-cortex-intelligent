import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export function runVerification(cmds: string[], cwd: string, timeoutMs: number) {
  return cmds.map(cmd => {
    const r = spawnSync(cmd, { shell: true, cwd, timeout: timeoutMs, encoding: "utf8" });
    return { cmd, exitCode: r.status ?? 1, summary: ((r.stdout || "") + (r.stderr || "")).slice(0, 2000), passed: r.status === 0 };
  });
}

/**
 * Detect the canonical verification commands for a project root, so the
 * verifier is not hard-wired to npm. Returns [] when no known stack is found
 * (caller should fall back to CORTEX_VERIFY_ALLOWLIST).
 */
export function detectVerificationCommands(root: string): string[] {
  try {
    if (fs.existsSync(path.join(root, "package.json"))) {
      return ["npm run typecheck", "npm run lint", "npm test"];
    }
    if (fs.existsSync(path.join(root, "pyproject.toml")) || fs.existsSync(path.join(root, "requirements.txt"))) {
      return ["ruff check .", "mypy .", "pytest -q"];
    }
    if (fs.existsSync(path.join(root, "Cargo.toml"))) {
      return ["cargo clippy -- -D warnings", "cargo test"];
    }
    if (fs.existsSync(path.join(root, "go.mod"))) {
      return ["go vet ./...", "go test ./..."];
    }
    if (fs.existsSync(path.join(root, "Makefile"))) {
      return ["make test"];
    }
  } catch {
    /* ignore — caller falls back to allowlist */
  }
  return [];
}
