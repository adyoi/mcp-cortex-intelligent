/**
 * LSP-style diagnostics for the cognitive augmentor.
 *
 * We don't bundle a full LSP client (that would require a persistent server
 * process per language). Instead we run the canonical diagnostic command for
 * the detected stack and parse its output into a structured, location-aware
 * list that an agent can act on — the same shape an LSP `textDocument/
 * publishDiagnostics` notification would carry.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  severity: "error" | "warning" | "info";
  code?: string;
  message: string;
}

export interface LspResult {
  language: string;
  command: string;
  ok: boolean;
  diagnostics: Diagnostic[];
  raw: string;
}

function detectStack(root: string): { language: string; command: string } {
  if (fs.existsSync(path.join(root, "tsconfig.json")) || fs.existsSync(path.join(root, "tsconfig.check.json"))) {
    return { language: "typescript", command: "npx tsc --noEmit --pretty false" };
  }
  if (fs.existsSync(path.join(root, "package.json"))) {
    return { language: "javascript", command: "npx tsc --noEmit --pretty false" };
  }
  if (fs.existsSync(path.join(root, "pyproject.toml")) || fs.existsSync(path.join(root, "requirements.txt"))) {
    return { language: "python", command: "python -m py_compile" };
  }
  if (fs.existsSync(path.join(root, "Cargo.toml"))) {
    return { language: "rust", command: "cargo check --message-format=short" };
  }
  if (fs.existsSync(path.join(root, "go.mod"))) {
    return { language: "go", command: "go vet ./..." };
  }
  return { language: "unknown", command: "" };
}

function parseTsc(output: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  // tsc --pretty false:  file(line,col): error TSxxxx: message
  const re = /^(.+?)\((\d+),(\d+)\):\s*(error|warning|info)\s*(TS\d+)?:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    out.push({
      file: m[1].trim(),
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4] as "error" | "warning" | "info",
      code: m[5],
      message: m[6].trim(),
    });
  }
  return out;
}

function parseGoVet(output: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  // go vet: file:line:col: message  OR  file:line: message
  const re = /^(.+?):(\d+)(?::(\d+))?:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    out.push({
      file: m[1].trim(),
      line: Number(m[2]),
      column: m[3] ? Number(m[3]) : undefined,
      severity: "error",
      message: m[4].trim(),
    });
  }
  return out;
}

export function runLspDiagnostics(root: string, timeoutMs = 120_000): LspResult {
  const { language, command } = detectStack(root);
  if (!command) {
    return { language, command: "", ok: true, diagnostics: [], raw: "No diagnostic command available for this stack." };
  }
  const r = spawnSync(command, { shell: true, cwd: root, timeout: timeoutMs, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const raw = ((r.stdout || "") + (r.stderr || "")).slice(0, 20000);
  const ok = r.status === 0;
  let diagnostics: Diagnostic[] = [];
  if (language === "typescript" || language === "javascript") diagnostics = parseTsc(raw);
  else if (language === "go") diagnostics = parseGoVet(raw);
  else diagnostics = []; // raw available for the agent to read
  return { language, command, ok, diagnostics, raw };
}
