---
description: <cortex> Comprehensive project audit: clean up, fix issues, optimize, suggest improvements (any language)
---
Run a comprehensive audit of the project for the current workspace — clean up, fix issues, optimize, and provide suggestions for improvements. Adapts to the project's language/tooling:

1. Call `bootstrap_session` with project_root = current workspace.
2. Call `init_audit` for current workspace (creates AUDIT.md if missing).
3. Detect project type by checking for: `package.json` (Node/TS), `pyproject.toml`/`requirements.txt` (Python), `Cargo.toml` (Rust), `go.mod` (Go), `pom.xml`/`build.gradle` (Java), `Makefile`, `CMakeLists.txt`. Use the matching toolchain for checks.
4. Explore all files: read src/, lib/, app/, docs/, .opencode/, scripts/, .github/, tests/.
5. Run checks appropriate to the detected stack:
   - Node/TS: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`
   - Python: `ruff check`, `mypy`, `pytest`
   - Rust: `cargo clippy`, `cargo test`
   - Go: `go vet`, `go test ./...`
   - Generic: compile/build if a build script exists; run the project's test command.
6. Run `lsp_diagnostics` (project_root = current workspace) for language-server-style diagnostics (tsc/pyright/cargo check/go vet) — structured, location-aware issues. For web-based tasks, also use OpenCode browser tools (`browser.tabs.open`, `browser.snapshot`, `browser.screenshot`, `browser.console`) for accuracy, falling back to MCP `webfetch` when unavailable (see `.opencode/skills/browser-accuracy/SKILL.md`).
7. Audit for (language-agnostic): security (SSRF, path traversal, secrets, injection), performance (N+1, unbounded memory/collections, sync I/O in hot path), dead code, unused imports/exports, docs drift, hardcoded absolute paths, banned words in docs, missing tests.
8. Clean up: remove stale/unused files, backups, dead code, redundant imports.
9. Fix issues: apply minimal, safe fixes for every finding (security, correctness, performance).
10. Optimize: cache, index, bounded collections, async I/O where applicable.
11. Provide suggestions for improvements: list remaining opportunities (refactoring, new tests, docs, tooling) with priority (P0/P1/P2) and rationale.
12. For each finding/fix/suggestion: record in AUDIT.md under "## Findings" / "## Fixed" / "## Suggestions".
13. Call `task_summary` and report findings + fixes + suggestions + model/tier/provisioned status to the user.
14. Confirm model/tier, provisioned status, and task summary.

If slash commands are missing, run `npm run setup-clients` (or the equivalent client setup) then restart OpenCode.