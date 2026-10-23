---
description: <cortex> Clean up project: remove stale files, dead code, backups, optimize
---
Clean up the current project (works for any language/stack):

1. Call `bootstrap_session` with current workspace.
2. Explore all files: read src/, lib/, app/, docs/, .opencode/, scripts/, .github/, tests/, and root-level config files. Identify stale, unused, or redundant artifacts.
3. Clean up:
   - Remove stale backup files (`.bak`, `.bak-*`, `*.orig`, `*.rej`).
   - Remove dead code and unused imports/exports.
   - Remove redundant or duplicate files.
   - Remove empty directories.
   - Clear temporary/build artifacts (`.test-data`, `dist/` if stale, `node_modules/.cache`, `__pycache__`, `target/`, etc.) — only if safe.
4. **Mojibake check**: scan all text files for mojibake (garbled chars from encoding mismatches, e.g. `ΓÇö`, `Ã©`, `â€™`, `Â`, `�`). Re-encode affected files as UTF-8, fix or remove garbled sequences. Common causes: UTF-8 interpreted as Latin-1/Windows-1252, double-encoding, BOM mismatch. Verify with `file`/editor.
5. Run `lsp_diagnostics` (current workspace) for language-server-style diagnostics after cleanup.
6. Run checks appropriate to the detected stack:
   - Node/TS: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`
   - Python: `ruff check`, `mypy`, `pytest`
   - Rust: `cargo clippy`, `cargo test`
   - Go: `go vet`, `go test ./...`
   - Generic: compile/build if a build script exists; run the project's test command.
7. Call `init_audit` for current workspace (creates AUDIT.md if missing). Record cleanup actions under "## Fixed" / "## Findings".
8. Call `task_summary` and report: files removed, issues fixed, model/tier/provisioned status.

If slash commands or MCP tools are missing, run the client setup (`npm run setup-clients` for Node projects, or the equivalent) then restart the client. Never store secrets from project files. Never delete user content outside `.opencode/` auto-blocks without confirmation.