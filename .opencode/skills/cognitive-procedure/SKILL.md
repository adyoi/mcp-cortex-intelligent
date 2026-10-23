<!-- cortex:auto:begin v=1.4.0 sha=3a0847699099506400c6d4eb12a20033e272a145cf616928024ccbfa716bdd4a -->
# Cognitive Procedure (auto)

## Standard procedure (scale to model tier)

1. **Plan** — state goal, identify affected files, list steps. Use `task_create` to track.
2. **Read** — read ALL files before editing. Never assume paths exist. Check `git status` first.
3. **Edit** — minimal change, no unrelated refactors. One logical change per commit.
4. **Verify** — `npm run typecheck` → `npm run lint` → `npm run build` → `npm test` (or stack-appropriate). Use `run_verification`.
5. **Review** — `git diff` + `self_critique` (percent/verdict/severity) before final.

### Tier scaling
- **Weak**: full checklist, explicit step-by-step, use `retrieve_exemplars` + `get_guardrails` heavily.
- **Medium**: concise checklist, verify each edit, self_critique before final.
- **Strong**: short punch list, still verify code touching DB/auth, run_verification before done.

## Anti-blunder checklist

### Files & paths
- Do not assume a path exists; read first.
- Do not edit without reading the full content.
- Do not edit generated files (`dist/`, `.cortex-data/`, `node_modules/`) directly.
- Do not assume a tool/flag exists; check the codebase first.
- Prefer minimal diff; no unrelated refactors in the same commit.

### Verification
- Do not skip verification because it looks simple.
- Run `lsp_diagnostics` after any code edit.
- Run `run_verification` before marking done.
- Destructive actions require a backup + rollback plan.
- High-risk tasks require manual review.

### Security
- Never store secrets / tokens / passwords in memory or in committed files.
- For web tasks: use browser tools for JS-rendered content; webfetch for static HTML.
- Use `webfetch_validate` for untrusted URLs. Never store secrets from fetched content.
- For DB/auth changes: always verify integrity + run migrations.

### Code quality
- Do not leave debug statements (console.log, debugger, TODO, FIXME, XXX).
- Do not store secrets in memory, documents, exemplars, or task notes.
- Prefer minimal diff; one logical change per commit.

## When to use (tools)
- `self_critique` before final (returns percent / verdict / severity / checks).
- `retrieve_exemplars(task, task_type)` when unsure — seeded defaults available.
- `model_decision(model, task, files)` for tier/risk/route.
- `get_guardrails(task)` before risky actions.
- `task_list` / `task_create` / `task_update` to track work.
- `run_verification` before marking done.
- `lsp_diagnostics(project_root)` after any code edit.
- `knowledge_search` / `knowledge_retrieve` for prior context.
- `memory_context(topic)` / `memory_remember` for long-term memory.
- `knowledge_sync_session` to ingest session transcripts into knowledge.
- `webfetch` / `webfetch_validate` / `browser_fetch` for web content.
- `task_from_plan` to auto-generate tasks from PLAN.md.

## Browser accuracy (web-based tasks)
- Prefer OpenCode browser tools (browser.*) for JS-rendered pages, screenshots, forms.
- Fall back to MCP `webfetch` (SSRF-guarded) when browser tools unavailable.
- Use `browser_fetch` (headless playwright/puppeteer) if installed; falls back to webfetch.
- Use `webfetch_validate` for untrusted URLs. Never store secrets from fetched content.
- Close browser tabs after use (avoid resource leaks).
- See .opencode/skills/browser-accuracy/SKILL.md.

## Memory & knowledge
- `memory_context(topic)` at session start (long-term memories, not raw transcripts).
- `knowledge_sync_session(directory)` to ingest prior session transcripts.
- `memory_remember` for facts/decisions/preferences (importance 0.5 default).
- `memory_consolidate` to dedupe + promote (auto-runs if CORTEX_AUTO_CONSOLIDATE != 0).
- Decay: memories fade by half-life (default 14 days, configurable).

## Error handling & recovery
- If a tool fails, read the error, fix root cause, re-run.
- If DB is corrupt, run integrity_check / rebuild FTS index.
- If paths are wrong, verify with read before editing.
- If tests fail, fix code (not tests) unless test is genuinely wrong.

## Context management
- Keep todo list as living document, not contract.
- Re-sync todo list on user interrupt.
- Scale verbosity to model tier.
- Use task_list / task_summary to track progress.
<!-- cortex:auto:end -->