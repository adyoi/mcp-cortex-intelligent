---
description: <cortex> Quick session init (bootstrap, guardrails) for any project — use after /init
---
Run the quick Cortex session initialization for the current workspace (works for any language/stack). Assumes `/init` has already been run once (scaffolding exists).

1. Call `bootstrap_session` with project_root = current workspace.
2. Call `memory_context(topic="The Coder")`.
3. Call `get_guardrails(task="session_start")`.
4. Call `task_summary`.

Confirm model/tier, provisioned status, and task summary to the user. If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent setup for your stack) then restart the client.