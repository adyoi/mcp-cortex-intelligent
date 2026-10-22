/**
 * Optional headless-browser fetcher (playwright/puppeteer).
 *
 * Offline-first: this module only activates when the caller explicitly opts in
 * AND the optional dependency is installed. Otherwise every function returns
 * `{ available: false }` and callers fall back to `webfetch` (static HTML).
 *
 * Install (optional, ~100MB+ browser binary):
 *   npm i playwright
 *   npx playwright install chromium
 */
export interface BrowserFetchResult {
  available: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  ok?: boolean;
  title?: string;
  text?: string;
  html?: string;
  error?: string;
}

export async function isBrowserAvailable(): Promise<boolean> {
  try {
    // @ts-expect-error — optional dependency
    await import("playwright");
    return true;
  } catch {
    try {
      // @ts-expect-error — optional dependency
      await import("puppeteer");
      return true;
    } catch {
      return false;
    }
  }
}

export async function browserFetch(url: string, opts: { timeoutMs?: number; maxChars?: number } = {}): Promise<BrowserFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxChars = opts.maxChars ?? 2000;
  try {
    // @ts-expect-error — optional dependency
    const pw = await import("playwright").catch(() => null);
    if (pw) {
      const browser = await pw.chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      const title = await page.title();
      const html = await page.content();
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      await browser.close();
      return {
        available: true,
        url,
        finalUrl: page.url(),
        status: 200,
        ok: true,
        title,
        text: text.slice(0, maxChars),
        html: html.slice(0, maxChars * 4),
      };
    }
  } catch (e) {
    return { available: true, url, ok: false, error: `playwright failed: ${(e as Error).message}` };
  }

  try {
    // @ts-expect-error — optional dependency
    const pp = await import("puppeteer").catch(() => null);
    if (pp) {
      const browser = await pp.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
      const title = await page.title();
      const html = await page.content();
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      await browser.close();
      return {
        available: true,
        url,
        finalUrl: page.url(),
        status: 200,
        ok: true,
        title,
        text: text.slice(0, maxChars),
        html: html.slice(0, maxChars * 4),
      };
    }
  } catch (e) {
    return { available: true, url, ok: false, error: `puppeteer failed: ${(e as Error).message}` };
  }

  return { available: false, url, error: "No headless browser installed. Run: npm i playwright && npx playwright install chromium (or puppeteer). Falls back to webfetch." };
}
