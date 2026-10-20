import { validateUrl, isBlockedHost, htmlToText } from "../../system/webfetch.js";
export async function run() {
  const p = { passed: 0, failed: 0, failures: [] as string[] };
  const ok = (n: string, c: unknown, d?: string) => { if (c) { p.passed++; console.log("  ✅ " + n); } else { p.failed++; p.failures.push(n); console.log("  ❌ " + n + (d ? " — " + d : "")); } };
  ok("https allowed", validateUrl("https://example.com").ok === true);
  ok("http allowed", validateUrl("http://example.com").ok === true);
  ok("file scheme rejected", validateUrl("file:///C:/secret").ok === false);
  ok("data scheme rejected", validateUrl("data:text/html,x").ok === false);
  ok("loopback blocked", isBlockedHost("127.0.0.1") === true);
  ok("localhost blocked", isBlockedHost("localhost") === true);
  ok("private 10/8 blocked", isBlockedHost("10.0.0.5") === true);
  ok("private 192.168 blocked", isBlockedHost("192.168.1.1") === true);
  ok("public host allowed", isBlockedHost("example.com") === false);
  const t = htmlToText("<html><head><title>T</title></head><body><p>Hello</p><script>bad()</script></body></html>");
  ok("html title extracted", t.title === "T", JSON.stringify(t.title));
  ok("html text extracted", t.text.includes("Hello"));
  ok("script stripped", !t.text.includes("bad()"));
  return p;
}
