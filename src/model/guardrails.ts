import { tierOf } from "./resolver.js";
import { procedureRoute, taskRisk } from "./model-decision.js";

export function getGuardrails(model: string, task: string): string {
  const tier = tierOf(model);
  const risk = taskRisk(task, []);
  const route = procedureRoute(task);
  const isDocTask = /doc|readme|md|plan/.test(task.toLowerCase());
  const isDelete = /delete|drop|wipe|rm/.test(task.toLowerCase());

  const base = `Model: ${model} (tier: ${tier})\nTask: ${task}\nRoute: ${route} | Risk: ${risk}\n`;

  // Procedure depends on tier + route (not one-size-fits-all)
  const proc = tier === "weak"
    ? `Wajib (lemah — hati-hati):\n1. Baca target fully.\n2. Buat rencana singkat.\n3. Edit minimal.\n4. Verifikasi (test+lint+typecheck).\n5. Review diff sebelum commit.\n`
    : tier === "medium"
    ? `Standar: Plan → Read → Edit → Verify → Review.\n`
    : `Ringkas (kuat — cepat tapi tetap aman): Read → Edit → Verify.\n`;

  // Anti-blunder is risk-adaptive, not static
  const anti = [
    isDelete ? "- HATI-HATI: aksi hapus — pastikan backup / rollback siap." : null,
    "- Jangan asumsikan path ada; baca dulu.",
    "- Jangan edit tanpa baca konten lengkap.",
    "- Jangan skip verifikasi hanya karena tampak sederhana.",
    risk === "high" ? "- Risiko tinggi: wajib review manual + test + lint + typecheck." : null,
    isDocTask ? "- Dokumen: pastikan konsistensi dengan PLAN/TASK + tidak menyimpan secret." : "- Jangan simpan secret / token / password.",
    "- Gunaakan `run_verification` sebelum menyelesaikan.",
    tier === "strong" ? "- Terlepas dari kekuatan, tetap verifikasi kode yang menyentuh DB / auth." : null,
  ].filter(Boolean).join("\n");

  const verify = tier === "weak"
    ? `Verifikasi wajib (lemah): npm test + npm run lint + npm run typecheck + cek diff.\n`
    : `Verifikasi: npm test, npm run lint, npm run typecheck. Rekomendasi: jalankan sebelum tanda done.\n`;

  return base + proc + "\nAnti-blunder:\n" + anti + "\n\n" + verify;
}
