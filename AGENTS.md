# AGENTS.md — mcp-cortex-intelligent

Compact guidance for OpenCode sessions working in this repo.

## Commands

- Install: `npm install`
- Typecheck: `npm run typecheck` (tsc --noEmit -p tsconfig.check.json)
- Lint: `npm run lint` (oxlint src scripts .opencode/plugin --deny-warnings)
- Build: `npm run build` (tsc -> dist/)
- Test: `npm test` (tsx src/test/test-all.ts, 247 checks, all must pass)
- Dev: `npm run dev` (tsx src/index.ts)
- Start (compiled): `npm start`
- CLI: `npm run cli -- <command>` (see src/cli.ts switch)
- Setup all clients: `npm run setup-clients` (node scripts/setup-clients.mjs)
- Wipe DB: `npm run clean-db -- --force`

Verification order: `typecheck -> lint -> build -> test`.

## Entrypoints

- Server: `src/index.ts` -> `src/mcp/cortex-server.ts` (McpServer, stdio).
- CLI: `src/cli.ts`.
- Tests: `src/test/test-all.ts`.
- Env loader: `src/env.ts` (must be imported first; allowlist: CORTEX_*, KB_*, OPENCODE_*, EMBEDDING_*, SEARCH_MODE).

## Architecture

- `src/knowledge/` — embedder, embeddings, chunker, vector-search, pipeline, reindex.
- `src/memory/` — long-term memory (decay, consolidate).
- `src/session/` — OpenCode transcript ingestion.
- `src/db/database.ts` — SQLite schema (node:sqlite, WAL, busy_timeout 5000). Add new tables in `createSchema`.
- `src/provisioner/` — marker-block (idempotent append), agent/skill generators.
- `src/model/` — resolver, tierOf, guardrails, modelDecision.
- `src/cognitive/` — selfCritique, compliance, verifier, exemplars.
- `src/decision/` — internal decision engine (heuristics).
- `src/procedures/` — procedure library (SQLite-backed).
- `src/plantask/` — Plan & Task management (PLAN.md/TASK.md + tasks table).

## Conventions

- Node >= 22.12 (node:sqlite). TypeScript strict, NodeNext modules.
- Env vars: shell env wins over .env. Only allowlisted keys loadable.
- DB path: `CORTEX_DB_DIR` (default `.cortex-data`), file `cortex.sqlite`.
- Provisioning: marker-block `<!-- cortex:auto:begin v=... sha=... --> ... <!-- cortex:auto:end -->`. Idempotent; preserve content outside markers; backup `.bak-<version>`.
- No secrets in memory/DB (plaintext store).
- Verification runner: allowlist from `CORTEX_VERIFY_ALLOWLIST`, locked cwd, timeout.

## Docs/Pages

- GitHub Pages source: `docs/` (mecha-futuristic theme). Logo at `docs/assets/logo.svg` (copy from `assets/logo.svg`).
- Mermaid labels with special chars must be quoted.
- Banned words in docs: tanpa, laya, jev, rag, mcp-rag-memory, mcp-server, knowledge-store (use neutral terms).
- `README.md` and `docs/index.html` should stay in sync (tools table, config).

## Release

- Bump `package.json` version, update `CHANGELOG.md`.
- `npm run build` (dist must exist for npm `files`).
- Tag `vX.Y.Z`, push, `gh release create`.
- npm: `npm login` then `npm publish`.

## Gotchas

- `src/env.ts` must be imported before any module reading `process.env`.
- Adding a DB table requires editing `createSchema` in `src/db/database.ts`.
- New MCP tools must be registered in `src/mcp/cortex-server.ts` and added to test `expected` array.
- Plugin (`.opencode/plugins/cortex-auto/index.ts`) uses `@opencode/plugin` (provided by OpenCode runtime, not installed here); don't add to deps.
- `scripts/setup-clients.mjs` merges global client configs (backup first).
- Test DB (`.test-data`) may be locked by lingering node processes; kill them before rerunning tests.
