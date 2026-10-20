# Security Policy

## Scope
This project is a local MCP server (stdio) that stores procedural memory, documents, and task state in a local SQLite database.

## Data handling
- All data stays local. No telemetry leaves the machine. No API keys required or accepted.
- Never store secrets (tokens, passwords, keys) in memory, documents, exemplars, or task notes.

## Network
- `webfetch` is the only outbound capability. It enforces an SSRF guard (blocks private/loopback/link-local hosts), a request timeout, a response size cap, and a redirect limit.
- URL validation can be performed without fetching via `webfetch_validate`.

## Reporting
Report vulnerabilities privately via GitHub Security Advisories on the repository. Do not open a public issue for unfixed findings.
