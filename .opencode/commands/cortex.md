---
description: <cortex> Quick session start (bootstrap, sync, guardrails) — use after /init
---
Run the quick Cortex session start for the current workspace (works for any language/stack). Assumes `/init` has already been run once (scaffolding exists).

1. Call `bootstrap_session` with current workspace.
2. Call `knowledge_sync_session` with directory = current workspace (syncs the most recent session transcript — user inputs + responses — into the knowledge store so prior Q&A is searchable). Best-effort; skip if no session exists.
3. Call `memory_context(topic="The Coder")`.
4. Call `get_guardrails(task="session_start")`.
5. Call `task_summary`.

Confirm model/tier, provisioned status, and task summary to the user. If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent setup for your stack) then restart the client.