---
description: <cortex> Universal session init (bootstrap, plan, task, guardrails) for any project
---
Run the full Cortex initialization for the current workspace (works for any language/stack):

1. Call `bootstrap_session` with project_root = current workspace.
2. Call `init_plan` and `init_task` for current workspace.
3. Call `init_agents` and `provision_agent_skill` for current workspace.
4. Call `memory_context(topic="The Coder")`.
5. Call `get_guardrails(task="session_start")`.
6. Call `task_summary`.

Confirm model/tier, provisioned status, and task summary to the user. If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent setup for your stack) then restart the client.