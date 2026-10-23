# Changelog

All notable changes to mcp-cortex-intelligent are documented here.

## [Unreleased]

## [1.1.0] - 2026-10-23

### Added
- `lsp_diagnostics` tool: language-server-style diagnostics (tsc/pyright/cargo check/go vet) — structured, location-aware issues.
- `browser_fetch` tool: headless browser (playwright/puppeteer) for JS-rendered pages; returns text, HTML, console, network, pageErrors. Falls back to webfetch.
- `task_from_plan` tool: auto-generate tasks from PLAN.md step/bullet lines.
- `init_audit` tool + `/audit` slash command: scaffold AUDIT.md, explore/check/audit/fix/optimize workflow.
- `/clean`, `/update`, `/review`, `/doctor`, `/init` slash commands.
- `browser-accuracy` skill (reusable, browser-first strategy with webfetch fallback).
- `CONTRIBUTING.md` + `SECURITY.md`.
- Per-module test suites (`src/test/modules/`: embedder, chunker, webfetch, telemetry, guardrails, self-critique) + runner `test-modules.ts`.
- Playwright + Chromium installed (optional dep, graceful fallback).
- Default exemplars seeded (code review, debug, refactor, test, security).
- GitHub Pages CI workflow (`pages.yml`).
- Graceful shutdown (SIGTERM/SIGINT → closeDB).
- Verifier auto-detect stack (Node/Python/Rust/Go/Makefile).
- Incremental reindex (`skipIfUnchanged` opt-in).
- Webfetch disk cache (cross-session, TTL 1h, LRU) + binary content handling.
- Telemetry query by tool (SQL GROUP BY + index).

### Changed
- Renamed `init_agents_md` → `init_agents` (tool name + manager export + cli).
- Tool count 58 → 62; test count 258 → 260.
- Telemetry `telemetry` table: added `tool` column + `idx_telemetry_tool` index (ALTER migration for pre-release DBs).
- `webfetch`: bounded in-memory fetch cache (TTL 60s, LRU cap 200), cache key includes opts; SSRF guard hardened (decimal/hex/octal, mapped IPv6, 0.0.0.0); redirect `new URL` guarded; binary content handling; disk cache (cross-session, TTL 1h).
- `bootstrap_session`: auto-consolidate memory default-on (`CORTEX_AUTO_CONSOLIDATE`), seed default exemplars.
- `marker-block` idempotency fixed (compare stored `sha=` instead of whole-block hash).
- `recall()` / `ingestText()`: re-acquire db handle after `await embedText` (no stale handle).
- `cortex-auto` plugin honors `CORTEX_DB_DIR`, injects LSP diagnostics summary.
- Docs placeholder `D:/path/to/mcp-cortex-intelligent` → `~/mcp-cortex-intelligent`.
- README/PLAN/CHANGELOG/docs synced to 62 tools / 260 checks.
- Cognitive Guardian agent & Cognitive Procedure skill upgraded to v1.4.0 (anti-blunder 17 items, tier scaling, memory/knowledge, error handling, context management, browser accuracy, LSP).
- `/init` and `/cortex` separated (no overlap): `/init` = onboarding, `/cortex` = quick session.
- `/audit` expanded: comprehensive (clean up, fix, optimize, suggest, mojibake check, no-overlap/redundancy check).
- `/verify` universal (toolchain-aware allowlist).
- Anti-blunder checklist improved (debug statements, generated files, tool/flag checks, DB/auth, minimal diff).
- `/cortex` and `/init` now sync session transcript into knowledge (prior Q&A searchable).
- `/clean` added (universal cleanup).
- `/update` added (pull latest from GitHub + build + verify).
- `/review` added (diff + critique + verify).
- `/doctor` added (setup diagnosis).

### Fixed
- `bootstrap_session` `consolidate()` now awaited (no unhandled rejection).
- `PLAN.md` stale "45 tools" → 62.
- `transcript.ts` comment `rag_search`/`rag_retrieve` → `knowledge_search`/`knowledge_retrieve`.
- Stale `.bak-*` artifacts removed.
- `/cortex.md` referenced unregistered `init_agents_md` → `init_agents` (+ `init_audit`).
- Plugin no longer crashes when `ctx.storage` is unavailable.
- Telemetry `telemetry` table: added `tool` column (`ALTER` migration) + `idx_telemetry_tool`; `recordToolCall` writes tool name; bounded table maintained.
- `webfetch`: bounded in-memory fetch-cache (TTL 60s, LRU cap 200) + `webfetch_validate` stays SSRF-safe.
- `bootstrap_session`: opt-in `CORTEX_AUTO_CONSOLIDATE=1` triggers memory consolidation (default-on).
- Test suite split into per-module files (`src/test/modules/`: embedder, chunker, webfetch, telemetry, guardrails, self-critique); master `test-all.ts` preserved (260 checks verified).
- `test-all.ts` mojibake (`???` → `✅`) fixed.
- Graceful shutdown (SIGTERM/SIGINT → closeDB).
- Incremental reindex (`skipIfUnchanged` opt-in).

### Security
- SSRF guard normalized hostnames (decimal/hex/octal, IPv4-mapped IPv6).
- No secrets stored; verification runner allowlist + locked cwd + timeout unchanged.

## [1.0.0] - 2026-10-21

### Added
- `task_update` tool (update title/priority/owner/plan_ref/notes) — suite now 62 tools.
- `/cortex` slash command for full session initialization, plus 12 helper slash commands
  (`/bootstrap`, `/guardrails`, `/critique`, `/verify`, `/tasks`, `/task-new`, `/task-done`,
  `/plan`, `/stats`, `/search`, `/remember`, `/recall`, `/webfetch`).
- `webfetch` + `webfetch_validate` tools (SSRF guard, timeout, size cap, optional ingest).
- Telemetry module: every tool call timed into bounded `telemetry` table; `system_stats` exposes summary.
- `task_list` pagination (limit/offset + total).
- `retrieve_exemplars` filter by `task_type`.
- Seed default model profiles (weak/medium/strong) on first migration.
- `publish.yml` workflow: npm Trusted Publishing (OIDC) on `v*` tags, idempotent skip when published.
- `AGENTS.md` / (optional) `SKILLS.md` auto-created by `/cortex` (idempotent).
- Mermaid flow diagram (AI Agent → SKILL.md → AGENTS.md → memory_context → PLAN.md → get_guardrails → CORTEX_EXECUTE ↔ TASK.md ↔ CORTEX_VERIFY).

### Changed
- `get_guardrails`, `model_decision`, `cognitive_status` accept `project_root` for accurate model detection (now reads `opencode.json` + `opencode.jsonc`).
- Guardrails output is risk/route/tier-adaptive (English).
- `self_critique` upgraded: weighted checklist, percent 0-100, severity, verdict, structured checks.
- Cognitive Guardian agent & Cognitive Procedure skill upgraded to v1.2.0 (English, browser-accuracy integration).
- CLI `bootstrap` pre-writes the plugin context cache (fast pre-response injection).
- Plugin `cortex-auto` is async (non-blocking spawn) and tolerates missing `ctx.storage`.
- README + docs stats aligned to 62 tools / 260 checks.
- `taskRisk` refined (destructive verbs only high-risk when targeting real objects).

### Fixed
- Model detection now reads `opencode.jsonc` (OpenCode's actual config) in addition to `opencode.json`.
- `webfetch` ingest dedups by URL (no duplicate docs).
- `CONTRIBUTING.md` + `SECURITY.md` added; docs placeholder `D:/path/to` → `~/mcp-cortex-intelligent`; `/cortex.md` now references both `init_agents` and `provision_agent_skill`.
- Plugin no longer crashes when `ctx.storage` is unavailable.
- Telemetry `telemetry` table: added `tool` column (`ALTER` migration) + `idx_telemetry_tool`; `recordToolCall` writes tool name; bounded table maintained.
- `webfetch`: bounded in-memory fetch-cache (TTL 60s, LRU cap 200) + `webfetch_validate` stays SSRF-safe.
- `bootstrap_session`: opt-in `CORTEX_AUTO_CONSOLIDATE=1` triggers memory consolidation.
- Test suite split into per-module files (`src/test/modules/`: embedder, chunker, webfetch, telemetry, guardrails, self-critique); master `test-all.ts` preserved (260 checks verified).

## [0.1.0] - 2026-10-19

### Added
- Initial release of mcp-cortex-intelligent (Cortex).
- 54 MCP tools across 9 groups: System, Provisioning, Model, Knowledge, Memory, Cognitive, Decision, Procedure, Plan & Task.
- Auto-provision Agent & Skill (idempotent marker-block, backup before write).
- Model awareness + guardrails (tier weak/medium/strong, anti-blunder checklist).
- Offline cognitive augmentor: exemplar retrieval, structured self-critique, compliance scoring, verification runner.
- Internal decision engine (heuristics, deterministic, no LLM/API).
- Plan & Task Management: AGENT → SKILL → PLAN → TASK ↔ EXECUTE → DONE.
- Knowledge base: ingest text/file/dir, hybrid search (BM25 + vector + RRF), reindex, backup.
- Long-term memory: remember/recall/context/consolidate/decay.
- Session sync from OpenCode transcripts.
- GitHub Pages docs (modern mecha-futuristic theme) + logo.
- CI workflow (typecheck, lint, build, test).

### Security
- Secrets never stored (no-secret rule).
- Verification runner allowlist, locked cwd, timeout, minimal env.
- Provisioning restricted to `.opencode/` under project root.
- 100% offline, no network calls.

### Notes
- Requires Node.js >= 22.12.
- No API keys required.
