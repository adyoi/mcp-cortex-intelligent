---
description: <cortex> Minimal bootstrap (detect model, provision agent & skill only)
---
Call `bootstrap_session` with current workspace. Then call `memory_context(topic="The Coder")` and `get_guardrails(task="session_start")`. Confirm model/tier and provisioned status. Use `/cortex` for the full quick-session (adds task_summary) or `/init` for full onboarding.