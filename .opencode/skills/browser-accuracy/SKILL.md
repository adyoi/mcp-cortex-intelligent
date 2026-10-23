---
name: browser-accuracy
description: >
  Use when a task involves fetching, reading, or verifying web content
  (HTML pages, JS-rendered apps, screenshots, forms). Prefer OpenCode's
  desktop browser tools (browser.*) for accuracy; fall back to the MCP
  `webfetch` tool when browser tools are unavailable (Claude Desktop,
  Cursor, VS Code, etc.). Reusable by any agent that adopts this skill.
version: 1.1.0
---

# Browser Accuracy Skill

## When to use
- Verifying a live URL, taking a screenshot, interacting with a form.
- Reading content from a JS-rendered (SPA) page where `webfetch` returns
  empty or incomplete HTML.
- Checking responsive layout, console errors, network requests.

## Strategy (browser-first, webfetch fallback)

1. **If OpenCode browser tools are available** (`browser.tabs.open`, `browser.snapshot`,
   `browser.screenshot`, `browser.console`, `browser.network`):
   - Open the URL in a tab: `browser.tabs.open({ url })`.
   - Wait for load, then `browser.snapshot` / `browser.screenshot` for visual truth.
   - Use `browser.console` and `browser.network` to detect runtime errors.
   - Close the tab when done to avoid leaks.

2. **Headless browser (MCP `browser_fetch`)** — if `playwright` or `puppeteer`
   is installed (optional dependency), use `browser_fetch` for JS-rendered
   content, console messages, network requests, and page errors. Returns
   structured data (title, text, html, console, network, pageErrors).

3. **Otherwise** (no headless browser, non-OpenCode clients):
   - Use the MCP `webfetch` tool (SSRF-guarded, timeout, size cap, optional ingest).
   - Note: `webfetch` returns static HTML only — JS-rendered content may be missing.
   - Use `webfetch_validate` first to check URL safety without fetching.

## Anti-blunder
- Never store secrets (tokens, passwords) found in fetched content.
- Always validate URLs (SSRF guard) before fetching.
- Prefer `webfetch_validate` for untrusted URLs.
- Close browser tabs after use (avoid resource leaks).
- For SPAs, prefer browser tools or `browser_fetch`; `webfetch` will miss client-rendered content.

## Install (optional, for headless rendering)
```bash
npm i playwright
npx playwright install chromium
```

## Reuse
This skill is standalone and can be adopted by any agent. Copy `.opencode/skills/browser-accuracy/SKILL.md`
into your agent's skill directory, or reference it via the marker-block provisioner.