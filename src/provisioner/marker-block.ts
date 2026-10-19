import * as fs from "fs";
import * as path from "path";
import { createHash } from "node:crypto";

const BEGIN = (v: string, sha: string) =>
  `<!-- cortex:auto:begin v=${v} sha=${sha} -->`;
const END = `<!-- cortex:auto:end -->`;

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function provision(filePath: string, autoBlock: string, version: string): { changed: boolean } {
  const sha = sha256(autoBlock);
  const block = `${BEGIN(version, sha)}\n${autoBlock}\n${END}`;
  let originalContent = "";
  let content = "";
  if (fs.existsSync(filePath)) {
    originalContent = fs.readFileSync(filePath, "utf8");
    content = originalContent;
  }
  const re = /<!-- cortex:auto:begin[\s\S]*?<!-- cortex:auto:end -->/;
  if (re.test(content)) {
    const m = content.match(re)!;
    if (sha256(m[0]) === sha) return { changed: false };
    content = content.replace(re, block);
  } else {
    content = content.trimEnd() + (content.trim() ? "\n\n" : "") + block + "\n";
  }
  const backupPath = filePath + ".bak-" + version;
  if (!fs.existsSync(backupPath) && originalContent) {
    fs.writeFileSync(backupPath, originalContent);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { changed: true };
}

export function listBlocks(filePath: string): { version: string | null; sha: string | null } {
  if (!fs.existsSync(filePath)) return { version: null, sha: null };
  const content = fs.readFileSync(filePath, "utf8");
  const m = content.match(/<!-- cortex:auto:begin v=([^\s]+) sha=([^\s]+) -->/);
  return m ? { version: m[1], sha: m[2] } : { version: null, sha: null };
}
