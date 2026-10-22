---
description: <cortex> Review: diff + self-critique + verify (all-in-one review pass)
---
Run a full review pass for the current workspace:

1. Call `bootstrap_session` with project_root = current workspace.
2. Get the current diff (git diff HEAD or staged changes). Summarize what changed.
3. Call `self_critique` with artifact = the diff summary + changed file list. Show score, issues, suggestions.
4. Call `run_verification` (default allowlist). Show pass/fail per command.
5. Call `lsp_diagnostics` (project_root = current workspace) for language-server-style diagnostics.
6. Call `task_summary` and report: review verdict, issues found, verification results, model/tier/provisioned status.

If there are no changes, report "nothing to review" and suggest running `/audit` instead. If slash commands or MCP tools are missing, run the client setup then restart the client. Never store secrets from diff output.