---
description: <cortex> Initialize Cortex (bootstrap session, plan, task, guardrails)
---
Run the full Cortex initialization:
1. Call `bootstrap_session` with project_root = current workspace.
2. Call `init_plan` and `init_task` for current workspace.
3. Call `provision_agent_skill` for current workspace.
4. Call `memory_context(topic="The Coder")`.
5. Call `get_guardrails(task="session_start")`.
6. Call `task_summary`.

Confirm model/tier, provisioned status, and task summary to the user. If slash commands are missing, run `npm run setup-clients` then restart OpenCode.