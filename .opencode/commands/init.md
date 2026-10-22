---
description: <cortex> Universal project init: title session, read all files, suggest improvements
---
Full project onboarding for the current workspace (works for any language/stack). Run once on first open; afterwards use `/cortex` for quick session starts.

1. Call `bootstrap_session` with project_root = current workspace.
2. Call `init_plan`, `init_task`, `init_agents`, `provision_agent_skill` for current workspace (idempotent scaffolding).
3. Call `init_audit` for current workspace (creates AUDIT.md if missing).
4. Call `knowledge_sync_session` with directory = current workspace (syncs the most recent session transcript — user inputs + responses — into the knowledge store so prior Q&A is searchable). Best-effort; skip if no session exists.
5. Explore ALL project files: read README, package/config files (package.json, pyproject.toml, Cargo.toml, go.mod, etc.), src/, lib/, app/, docs/, tests/, scripts/, .github/, .opencode/, and any other source/config files. Build a full mental model of the project's purpose, stack, structure, and conventions. For web-based projects, also use OpenCode browser tools (`browser.tabs.open`, `browser.snapshot`) for visual verification, falling back to MCP `webfetch`.
6. Determine a concise session title from the project name + primary purpose (e.g. "mcp-cortex-intelligent — offline MCP server"). Use it to rename the session if supported.
7. Run `lsp_diagnostics` (project_root = current workspace) for language-server-style diagnostics (tsc/pyright/cargo/go vet) — structured, location-aware issues.
8. Analyze and suggest improvements, optimizations, and fixes:
   - Code quality (dead code, unused imports, complexity, naming).
   - Performance (N+1, unbounded collections, sync I/O, caching opportunities).
   - Security (SSRF, path traversal, secrets, injection).
   - Docs drift (README vs code, tool counts, banned words).
   - Testing gaps (missing coverage, flaky tests).
   - Tooling/CI (lint, typecheck, build, release).
   Prioritize as P0 (critical) / P1 (important) / P2 (nice-to-have) with rationale.
9. Record suggestions in AUDIT.md under "## Suggestions" with file:line references.
10. Call `memory_context(topic="The Coder")` and `get_guardrails(task="session_start")`.
11. Call `task_summary` and report: session title, project summary, prioritized suggestions, model/tier/provisioned status.

If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent) then restart the client. Never store secrets from project files.