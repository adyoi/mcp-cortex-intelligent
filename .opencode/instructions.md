# Cortex Intelligent

At session start, call `memory_context(topic="The Coder")` then `get_guardrails(task="session_start")`.
Before risky actions, call `get_guardrails(task)`.
Before finalizing, call `self_critique` and `run_verification`.
Never store secrets in memory.
