# Changelog

All notable changes to mcp-cortex-intelligent are documented here.

## [Unreleased]

## [1.0.1] - 2026-10-21

### Added
- `init_audit` tool + `/audit` slash command (repo + global): scaffold `AUDIT.md`, explore/check/audit/fix/optimize workflow.
- `CONTRIBUTING.md` + `SECURITY.md`.
- Per-module test suites (`src/test/modules/`: embedder, chunker, webfetch, telemetry, guardrails, self-critique) + runner `test-modules.ts`.

### Changed
- Renamed `init_agents_md` → `init_agents` (tool name + manager export + cli).
- Tool count 58 → 59; test count 258 → 259.
- Telemetry `telemetry` table: added `tool` column + `idx_telemetry_tool` index (ALTER migration for pre-release DBs).
- `webfetch`: bounded in-memory fetch cache (TTL 60s, LRU cap 200), cache key includes opts; SSRF guard hardened (decimal/hex/octal, mapped IPv6, 0.0.0.0); redirect `new URL` guarded.
- `bootstrap_session`: opt-in `CORTEX_AUTO_CONSOLIDATE=1` triggers memory consolidation.
- `marker-block` idempotency fixed (compare stored `sha=` instead of whole-block hash).
- `recall()` / `ingestText()`: re-acquire db handle after `await embedText` (no stale handle).
- `cortex-auto` plugin honors `CORTEX_DB_DIR`.
- Docs placeholder `D:/path/to/mcp-cortex-intelligent` → `~/mcp-cortex-intelligent`.
- README/PLAN/CHANGELOG/docs synced to 61 tools / 259 checks.

### Fixed
- `bootstrap_session` `consolidate()` now awaited (no unhandled rejection).
- `PLAN.md` stale "45 tools" → 61.
- `transcript.ts` comment `rag_search`/`rag_retrieve` → `knowledge_search`/`knowledge_retrieve`.
- Stale `.bak-*` artifacts removed.
- `/cortex.md` referenced unregistered `init_agents_md` → `init_agents` (+ `init_audit`).

### Security
- SSRF guard normalized hostnames (decimal/hex/octal, IPv4-mapped IPv6).
- No secrets stored; verification runner allowlist + locked cwd + timeout unchanged.

## [1.0.0] - 2026-10-21

### Added
- `task_update` tool (update title/priority/owner/plan_ref/notes) — suite now 61 tools.
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
- Cognitive Guardian agent & Cognitive Procedure skill upgraded to v1.1.0 (English).
- CLI `bootstrap` pre-writes the plugin context cache (fast pre-response injection).
- Plugin `cortex-auto` is async (non-blocking spawn) and tolerates missing `ctx.storage`.
- README + docs stats aligned to 61 tools / 259 checks.
- `taskRisk` refined (destructive verbs only high-risk when targeting real objects).

### Fixed
- Model detection now reads `opencode.jsonc` (OpenCode's actual config) in addition to `opencode.json`.
- `webfetch` ingest dedups by URL (no duplicate docs).
- `CONTRIBUTING.md` + `SECURITY.md` added; docs placeholder `D:/path/to` → `~/mcp-cortex-intelligent`; `/cortex.md` now references both `init_agents_md` and `provision_agent_skill`.
- Plugin no longer crashes when `ctx.storage` is unavailable.
- Telemetry `telemetry` table: added `tool` column (`ALTER` migration) + `idx_telemetry_tool`; `recordToolCall` writes tool name; bounded table maintained.
- `webfetch`: bounded in-memory fetch-cache (TTL 60s, LRU cap 200) + `webfetch_validate` stays SSRF-safe.
- `bootstrap_session`: opt-in `CORTEX_AUTO_CONSOLIDATE=1` triggers memory consolidation.
- Test suite split into per-module files (`src/test/modules/`: embedder, chunker, webfetch, telemetry, guardrails, self-critique); master `test-all.ts` preserved (259 checks verified).

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
