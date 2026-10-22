import { getDB } from "../db/database.js";

/**
 * Best-effort tool-call telemetry. Bounded table (oldest rows are dropped past
 * MAX_ROWS) so it can never grow unbounded, and it never throws into a tool
 * call — observability must not be able to break the thing it observes.
 */
const MAX_ROWS = 5000;

export function recordToolCall(tool: string, ms: number, ok: boolean): void {
  try {
    const db = getDB();
    db.prepare("INSERT INTO telemetry (ts, event, session_id, model, payload, tool) VALUES (?,?,?,?,?,?)")
      .run(Date.now(), "tool_call", null, null, JSON.stringify({ tool, ms, ok }), tool);
    const { c } = db.prepare("SELECT COUNT(*) AS c FROM telemetry").get() as { c: number };
    if (c > MAX_ROWS) {
      db.prepare("DELETE FROM telemetry WHERE id IN (SELECT id FROM telemetry ORDER BY id ASC LIMIT ?)")
        .run(c - MAX_ROWS);
    }
  } catch { /* telemetry must never break a tool call */ }
}

export function telemetryStats(): {
  total: number;
  ok: number;
  failed: number;
  avgMs: number;
  top: Array<{ tool: string; calls: number }>;
} {
  const rows = getDB().prepare("SELECT payload, tool FROM telemetry WHERE event='tool_call'").all() as Array<{ payload: string; tool: string | null }>;
  let ok = 0;
  let failed = 0;
  let totalMs = 0;
  const byTool = new Map<string, number>();
  for (const r of rows) {
    try {
      const p = JSON.parse(r.payload) as { tool?: string; ms?: number; ok?: boolean };
      if (p.ok === false) failed++;
      else ok++;
      totalMs += Number(p.ms) || 0;
      const t = r.tool ?? p.tool;
      if (t) byTool.set(t, (byTool.get(t) ?? 0) + 1);
    } catch { /* skip malformed row */ }
  }
  // Prefer SQL aggregation over the in-memory map when the tool column is populated,
  // so the index (idx_telemetry_tool) is actually used for large stores.
  let top: Array<{ tool: string; calls: number }>;
  try {
    const agg = getDB().prepare("SELECT tool, COUNT(*) AS c FROM telemetry WHERE tool IS NOT NULL GROUP BY tool ORDER BY c DESC, tool ASC LIMIT 10").all() as Array<{ tool: string; c: number }>;
    if (agg.length > 0) {
      top = agg.map((r) => ({ tool: r.tool, calls: r.c }));
    } else {
      top = [...byTool.entries()].map(([tool, calls]) => ({ tool, calls })).sort((a, b) => b.calls - a.calls || a.tool.localeCompare(b.tool)).slice(0, 10);
    }
  } catch {
    top = [...byTool.entries()].map(([tool, calls]) => ({ tool, calls })).sort((a, b) => b.calls - a.calls || a.tool.localeCompare(b.tool)).slice(0, 10);
  }
  return { total: rows.length, ok, failed, avgMs: rows.length ? Math.round(totalMs / rows.length) : 0, top };
}
