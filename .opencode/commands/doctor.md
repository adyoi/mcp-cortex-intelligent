---
description: <cortex> Doctor: diagnose setup (model, DB, plugin, paths, LSP, banned words)
---
Run a full setup diagnosis for the current workspace:

1. Call `bootstrap_session` with current workspace.
2. Call `detect_model` with current workspace. Report model id + tier.
3. Call `system_stats` — report DB path, health status, embedding backend, store state.
4. Call `lsp_diagnostics` (current workspace) — report error/warning count.
5. Check paths: verify `.opencode/`, `AGENTS.md`, `PLAN.md`, `TASK.md`, `.cortex-data/` exist.
6. Check banned words in docs — report any hits.
7. Check plugin: verify `.opencode/plugins/cortex-auto/index.ts` exists and `~/.config/opencode/opencode.json` has the cortex MCP server + plugin registered.
8. Call `task_summary` and report: overall health (pass/fail per item), model/tier/provisioned status, recommendations.

If slash commands or MCP tools are missing, run the client setup then restart the client. Never store secrets.