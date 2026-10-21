---
description: <cortex> Audit the whole project: explore, check, audit, fix, optimize
---
Run a full project audit for the current workspace:

1. Call `bootstrap_session` with project_root = current workspace.
2. Call `init_audit` for current workspace (creates AUDIT.md if missing).
3. Explore all files: read src/, docs/, .opencode/, scripts/, .github/.
4. Run checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
5. Audit for: security (SSRF, path traversal, secrets), performance (N+1, unbounded memory, sync I/O), dead code, unused imports, docs drift, hardcoded paths, banned words.
6. For each finding: fix it, then record in AUDIT.md under "## Findings" / "## Fixed".
7. Optimize: cache, index, bounded collections, async I/O where applicable.
8. Call `task_summary` and report findings + fixes to the user.
9. Confirm model/tier, provisioned status, and task summary.

If slash commands are missing, run `npm run setup-clients` then restart OpenCode.