/**
 * Headless browser check (two-way: server response + client rendering).
 *
 * Complements OpenCode's desktop browser tools (browser.*) by providing a
 * headless fallback that captures BOTH the server-side response (status,
 * headers, redirects) AND the client-side rendering (DOM text, console
 * messages, network requests, page errors). This gives the agent a complete
 * picture even when desktop browser tools are unavailable.
 *
 * Optional dependency: playwright or puppeteer.
 *   npm i playwright && npx playwright install chromium
 */
import { spawnSync } from "node:child_process";

export interface BrowserCheckResult {
  available: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  ok?: boolean;
  title?: string;
  text?: string;
  html?: string;
  console?: Array<{ type: string; text: string }>;
  network?: Array<{ url: string; status: number; method: string }>;
  pageErrors?: string[];
  error?: string;
  fallback?: "webfetch";
}

export async function isBrowserAvailable(): Promise<boolean> {
  try { await import("playwright"); return true; } catch {}
  try { await import("puppeteer"); return true; } catch {}
  return false;
}

export async function browserCheck(url: string, opts: { timeoutMs?: number; maxChars?: number } = {}): Promise<BrowserCheckResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxChars = opts.maxChars ?? 2000;

  // Try playwright first
  try {
    // @ts-expect-error — optional dependency
    const pw = await import("playwright").catch(() => null);
    if (pw) {
      const browser = await pw.chromium.launch({ headless: true });
      const page = await browser.newPage();
      const consoleMsgs: Array<{ type: string; text: string }> = [];
      const networkReqs: Array<{ url: string; status: number; method: string }> = [];
      const pageErrors: string[] = [];

      page.on("console", (msg: any) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
      page.on("pageerror", (err: any) => pageErrors.push(String(err?.message ?? err)));
      page.on("response", (res: any) => {
        try { networkReqs.push({ url: res.url(), status: res.status(), method: res.request().method() }); } catch {}
      });

      let response: any;
      try { response = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs }); }
      catch (e) { await browser.close(); return { available: true, url, ok: false, error: `navigation failed: ${(e as Error).message}`, console: consoleMsgs, network: networkReqs, pageErrors }; }

      const title = await page.title();
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      const html = await page.content();
      await browser.close();

      return {
        available: true,
        url,
        finalUrl: page.url(),
        status: response?.status() ?? 0,
        ok: response?.ok() ?? false,
        title,
        text: text.slice(0, maxChars),
        html: html.slice(0, maxChars * 4),
        console: consoleMsgs.slice(0, 20),
        network: networkReqs.slice(0, 30),
        pageErrors: pageErrors.slice(0, 10),
      };
    }
  } catch (e) {
    // fall through to puppeteer
  }

  // Try puppeteer
  try {
    // @ts-expect-error — optional dependency
    const pp = await import("puppeteer").catch(() => null);
    if (pp) {
      const browser = await pp.launch({ headless: true });
      const page = await browser.newPage();
      const consoleMsgs: Array<{ type: string; text: string }> = [];
      const networkReqs: Array<{ url: string; status: number; method: string }> = [];
      const pageErrors: string[] = [];

      page.on("console", (msg: any) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
      page.on("pageerror", (err: any) => pageErrors.push(String(err?.message ?? err)));
      page.on("response", (res: any) => {
        try { networkReqs.push({ url: res.url(), status: res.status(), method: res.request().method() }); } catch {}
      });

      let response: any;
      try { response = await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs }); }
      catch (e) { await browser.close(); return { available: true, url, ok: false, error: `navigation failed: ${(e as Error).message}`, console: consoleMsgs, network: networkReqs, pageErrors }; }

      const title = await page.title();
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      const html = await page.content();
      await browser.close();

      return {
        available: true,
        url,
        finalUrl: page.url(),
        status: response?.status() ?? 0,
        ok: response?.ok() ?? false,
        title,
        text: text.slice(0, maxChars),
        html: html.slice(0, maxChars * 4),
        console: consoleMsgs.slice(0, 20),
        network: networkReqs.slice(0, 30),
        pageErrors: pageErrors.slice(0, 10),
      };
    }
  } catch (e) {
    // fall through
  }

  return { available: false, url, error: "No headless browser installed. Run: npm i playwright && npx playwright install chromium (or puppeteer). Falls back to webfetch + OpenCode desktop browser tools." };
}
