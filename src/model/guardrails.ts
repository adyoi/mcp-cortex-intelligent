import { tierOf } from "./resolver.js";

export function getGuardrails(model: string, task: string): string {
  const tier = tierOf(model);
  const base = `Model: ${model} (tier: ${tier})\nTask: ${task}\n`;
  const proc = tier === "weak"
    ? `Prosedur wajib:\n1. Baca file target sebelum edit.\n2. Buat rencana singkat.\n3. Edit minimal.\n4. Jalankan test & lint.\n5. Review diff.\n`
    : tier === "medium"
    ? `Prosedur: Plan -> Read -> Edit -> Verify -> Review.\n`
    : `Prosedur ringkas: Read -> Edit -> Verify.\n`;
  const anti = `Anti-blunder:\n- Jangan asumsikan path ada.\n- Jangan edit tanpa baca.\n- Jangan skip verifikasi.\n- Jangan simpan secret.\n`;
  const verify = `Verifikasi: npm test, npm run lint, npm run typecheck\n`;
  return base + proc + anti + verify;
}
