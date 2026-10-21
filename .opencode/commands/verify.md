---
description: <cortex> Run verification (build/test/lint/typecheck) — adapts to project stack
---
Call `run_verification` (default allowlist from `CORTEX_VERIFY_ALLOWLIST`, or detect the project's toolchain: Node/TS → `npm test,npm run lint,npm run typecheck`; Python → `pytest,ruff,mypy`; Rust → `cargo test,cargo clippy`; Go → `go test ./...,go vet`). Show pass/fail per command. Never store secrets from verification output.