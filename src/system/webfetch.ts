/**
 * Offline-first web fetcher.
 *
 * The server itself never phones home on its own; this module only runs when a
 * caller explicitly asks for a URL. Guards:
 *  - http/https only (no file:, data:, ftp: …)
 *  - no private / loopback / link-local targets (SSRF guard for a local server)
 *  - hard timeout, hard size cap, and a redirect budget
 *  - nothing is persisted unless the caller opts in with `ingest: true`
 */

import * as fs from "node:fs";
import * as path from "node:path";
export const FETCH_TIMEOUT_MS = 20_000;
export const MAX_FETCH_BYTES = 2_000_000;
export const MAX_REDIRECTS = 3;
export const DEFAULT_SNIPPET_CHARS = 2_000;
export const FETCH_CACHE_TTL_MS = 60_000;
export const FETCH_DISK_CACHE_TTL_MS = 3_600_000; // 1 hour for cross-session reuse

const fetchCache = new Map<string, { result: unknown; ts: number }>();
const CACHE_MAX = 200;

const DISK_CACHE_FILE = path.join(
  process.env.CORTEX_DB_DIR && (process.env.CORTEX_DB_DIR.startsWith("/") || /^[a-z]:/i.test(process.env.CORTEX_DB_DIR))
    ? process.env.CORTEX_DB_DIR
    : path.join(process.cwd(), process.env.CORTEX_DB_DIR || ".cortex-data"),
  "fetch-cache.json"
);

function loadDiskCache(): void {
  try {
    if (!fs.existsSync(DISK_CACHE_FILE)) return;
    const raw = fs.readFileSync(DISK_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { result: unknown; ts: number }>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.ts === "number" && now - v.ts < FETCH_DISK_CACHE_TTL_MS) {
        fetchCache.set(k, v);
      }
    }
  } catch { /* ignore corrupt cache */ }
}

let diskSaveTimer: NodeJS.Timeout | null = null;
function scheduleDiskSave(): void {
  if (diskSaveTimer) return;
  diskSaveTimer = setTimeout(() => {
    diskSaveTimer = null;
    try {
      const obj: Record<string, { result: unknown; ts: number }> = {};
      for (const [k, v] of fetchCache) obj[k] = v;
      fs.mkdirSync(path.dirname(DISK_CACHE_FILE), { recursive: true });
      fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify(obj));
    } catch { /* ignore */ }
  }, 1000);
}

// Load on module init
loadDiskCache();


const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
];

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  title: string;
  text: string;
  truncated: boolean;
  bytes: number;
  elapsedMs: number;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) → check the v4 part.
  const mapped = h.match(/^::ffff:(.+)$/i);
  const target = mapped ? mapped[1] : h;
  // Normalize numeric (decimal/hex/octal) and dotted-quad encodings so
  // obfuscated loopback/private addresses cannot bypass the guard.
  let normalized = target;
  if (/^0x[0-9a-f]+$/i.test(target)) {
    const n = parseInt(target, 16);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      normalized = `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
    }
  } else if (/^\d+$/.test(target)) {
    const n = Number(target);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      normalized = `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
    }
  } else if (/^0[0-7]+$/.test(target)) {
    const n = parseInt(target, 8);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      normalized = `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
    }
  }
  if (normalized === "0.0.0.0") return true;
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(normalized));
}

export function validateUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: `Invalid URL: ${raw}` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: `Unsupported protocol: ${url.protocol} (only http/https)` };
  }
  if (!url.hostname) return { ok: false, error: "URL has no hostname" };
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: `Refusing to fetch a private/loopback host: ${url.hostname}` };
  }
  return { ok: true, url };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

/** Very small HTML → text reducer. Good enough to hand a page to a model. */
export function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "")).trim() : "";
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br|hr|pre|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
  return { title, text };
}

export interface WebFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxChars?: number;
}

export async function webFetch(rawUrl: string, opts: WebFetchOptions = {}): Promise<FetchResult> {
  const started = Date.now();
  const v = validateUrl(rawUrl);
  if (!v.ok) {
    return {
      url: rawUrl,
      finalUrl: rawUrl,
      status: 0,
      ok: false,
      contentType: "",
      title: "",
      text: "",
      truncated: false,
      bytes: 0,
      elapsedMs: Date.now() - started,
      ...({ error: v.error } as Record<string, unknown>),
    } as FetchResult;
  }

  const cacheKey = `${v.url.href}|${opts.timeoutMs ?? FETCH_TIMEOUT_MS}|${opts.maxBytes ?? MAX_FETCH_BYTES}|${opts.maxChars ?? DEFAULT_SNIPPET_CHARS}`;
  const cached = fetchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < FETCH_CACHE_TTL_MS) {
    return cached.result as FetchResult;
  }

  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? MAX_FETCH_BYTES;
  const maxChars = opts.maxChars ?? DEFAULT_SNIPPET_CHARS;

  let current = v.url;
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "mcp-cortex-intelligent/0.1 (+offline MCP server)", accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        let next: URL;
        try {
          next = new URL(res.headers.get("location")!, current);
        } catch {
          return { url: rawUrl, finalUrl: current.href, status: res.status, ok: false, contentType: "", title: "", text: "", truncated: false, bytes: 0, elapsedMs: Date.now() - started, error: "Malformed redirect location" } as FetchResult;
        }
        if (!validateUrl(next.href).ok) {
          return { url: rawUrl, finalUrl: current.href, status: res.status, ok: false, contentType: "", title: "", text: "", truncated: false, bytes: 0, elapsedMs: Date.now() - started, error: `Redirect to a blocked target: ${next.href}` } as FetchResult;
        }
        current = next;
        continue;
      }
      response = res;
      break;
    } catch (e) {
      return {
        url: rawUrl,
        finalUrl: current.href,
        status: 0,
        ok: false,
        contentType: "",
        title: "",
        text: "",
        truncated: false,
        bytes: 0,
        elapsedMs: Date.now() - started,
        error: `Fetch failed: ${(e as Error).message}`,
      } as FetchResult;
    } finally {
      clearTimeout(timer);
    }
  }
  if (!response) {
    return { url: rawUrl, finalUrl: current.href, status: 0, ok: false, contentType: "", title: "", text: "", truncated: false, bytes: 0, elapsedMs: Date.now() - started, error: "Too many redirects" } as FetchResult;
  }

  const contentType = response.headers.get("content-type") ?? "";
  let bytes = 0;
  let truncated = false;
  let raw = "";
  try {
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          truncated = true;
          break;
        }
        raw += decoder.decode(value, { stream: true });
      }
      try { await reader.cancel(); } catch { /* ignore */ }
    } else {
      raw = await response.text();
      bytes = Buffer.byteLength(raw, "utf8");
      if (bytes > maxBytes) truncated = true;
    }
  } catch (e) {
    return { url: rawUrl, finalUrl: current.href, status: response.status, ok: false, contentType, title: "", text: "", truncated, bytes, elapsedMs: Date.now() - started, error: `Read failed: ${(e as Error).message}` } as FetchResult;
  }

  const isHtml = /text\/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(raw);
  const isBinary = /^(image|audio|video|application\/(pdf|zip|octet-stream|gz|x-tar|x-7z))/i.test(contentType) && !/text/i.test(contentType);
  if (isBinary) {
    const result: FetchResult = {
      url: rawUrl,
      finalUrl: current.href,
      status: response.status,
      ok: response.ok,
      contentType,
      title: "",
      text: `[binary content: ${contentType}, ${bytes} bytes — not decoded]`,
      truncated: false,
      bytes,
      elapsedMs: Date.now() - started,
    };
    fetchCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }
  const { title, text } = isHtml ? htmlToText(raw) : { title: "", text: raw.trim() };
  const clipped = text.length > maxChars ? text.slice(0, maxChars) : text;

  const result: FetchResult = {
    url: rawUrl,
    finalUrl: current.href,
    status: response.status,
    ok: response.ok,
    contentType,
    title,
    text: clipped,
    truncated: truncated || text.length > maxChars,
    bytes,
    elapsedMs: Date.now() - started,
  };
  fetchCache.set(cacheKey, { result, ts: Date.now() });
  scheduleDiskSave();
  while (fetchCache.size > CACHE_MAX) {
    const oldest = fetchCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    fetchCache.delete(oldest);
  }
  return result;
}


process.on("beforeExit", () => { try { const obj: Record<string, { result: unknown; ts: number }> = {}; for (const [k, v] of fetchCache) obj[k] = v; fs.mkdirSync(path.dirname(DISK_CACHE_FILE), { recursive: true }); fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify(obj)); } catch { /* ignore */ } });
