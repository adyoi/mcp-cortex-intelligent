# Contributing

- Fork, create branch `feat/<name>`.
- Verify order: `npm run typecheck` → `npm run lint` → `npm run build` → `npm test` (all pass, 258 checks).
- Commit message format: `feat: ...`, `fix: ...`, `docs: ...`.
- No API keys; all offline (local lexical embedder, SQLite, heuristics only).
- No `D:/Project/mcp` hardcoded paths; use relative / `~/mcp-cortex-intelligent`.
- Before risky edits, call `get_guardrails`; before finalizing, call `self_critique` + `run_verification`.
- Keep docs (`README.md`, `docs/index.html`, `PLAN.md`) in sync with `src/mcp/cortex-server.ts` tool counts.
