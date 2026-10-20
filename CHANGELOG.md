# Changelog

All notable changes to mcp-cortex-intelligent are documented here.

## [Unreleased]

### Added
- `task_update` tool (update title/priority/owner/plan_ref/notes) — suite now 58 tools.
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
- README + docs stats aligned to 58 tools / 258 checks.
- `taskRisk` refined (destructive verbs only high-risk when targeting real objects).

### Fixed
- Model detection now reads `opencode.jsonc` (OpenCode's actual config) in addition to `opencode.json`.
- `webfetch` ingest dedups by URL (no duplicate docs).
- Plugin no longer crashes when `ctx.storage` is unavailable.

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
