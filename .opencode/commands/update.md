---
description: <cortex> Update mcp-cortex-intelligent from the main GitHub repo (git pull + build + verify)
---
Update the local MCP Cortex server to the latest version from the main GitHub repository:

1. Call `bootstrap_session` with current workspace.
2. Verify the workspace is a git repo with a remote (`git remote -v`). If not, abort with a clear message.
3. Fetch latest: `git fetch origin`.
4. Show pending changes: `git log HEAD..origin/main --oneline` (or the default branch).
5. Pull: `git pull origin main` (or the default branch). If there are local uncommitted changes, stash first (`git stash`), pull, then `git stash pop`.
6. Install dependencies if `package.json` changed: `npm install` (Node) / equivalent for the stack.
7. Build: `npm run build` (Node) / equivalent.
8. Verify: `npm run typecheck`, `npm run lint`, `npm test` (or stack-appropriate checks).
9. Call `init_audit` for current workspace (creates AUDIT.md if missing). Record update under "## Fixed".
10. Call `task_summary` and report: commits pulled, build status, test results, model/tier/provisioned status.

Safety: never overwrite local uncommitted changes without stashing. Never store secrets from fetched content. If conflicts occur, abort and report — do not auto-resolve. If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent) then restart the client.