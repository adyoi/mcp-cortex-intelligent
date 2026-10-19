# Changelog

All notable changes to mcp-cortex-intelligent are documented here.

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
