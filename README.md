# MCP "mcp-cortex-intelligent" — Cortex Intelligent

MCP server yang meningkatkan kemampuan model LLM biasa menjadi "lebih pintar"
mandiri dari provider key apa pun, dengan **decision internal** (heuristik) untuk
keputusan cepat & deterministik. Lihat [PLAN.md](./PLAN.md) untuk perencanaan
lengkap.

## Fitur Utama

1. **Auto-provision Agent & Skill** di setiap sesi (append idempotent via marker-block).
2. **Model awareness + guardrails** (prosedur anti-blunder sesuai tier model).
3. **Offline cognitive augmentor** (exemplar knowledge, self-critique, compliance scoring, verification).
4. **Internal decision engine** (heuristik) untuk Model Decision (tier/risk/route/compliance) mandiri dari API.
5. Knowledge base + hybrid search + long-term memory (modul internal).

## Status

Implementasi Fase 1–6 selesai. 41 tools terdaftar. 238/238 test lulus.
`npm run build`, `npm run lint`, `npm run typecheck` hijau.

## Perintah

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

## Lisensi

MIT
