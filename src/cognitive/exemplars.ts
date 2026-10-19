import * as pipeline from "../knowledge/pipeline.js";
import { getDB } from "../db/database.js";

export async function ingestExemplar(taskType: string, language: string, title: string, content: string, outcome: string) {
  const doc = await pipeline.ingestText(content, title, { source: "exemplar", contentType: "text", metadata: { task_type: taskType, language, outcome } });
  return doc;
}

/** Widen the retrieval pool before filtering so a narrow topK can't starve the filter. */
const FILTER_POOL_MULTIPLIER = 5;
const FILTER_POOL_MAX = 50;

export async function retrieveExemplars(task: string, topK = 5, taskType?: string) {
  if (!taskType) return pipeline.searchDocs(task, topK, 0.0, { source: "exemplar" });
  const pool = await pipeline.searchDocs(
    task,
    Math.min(topK * FILTER_POOL_MULTIPLIER, FILTER_POOL_MAX),
    0.0,
    { source: "exemplar" }
  );
  if (pool.length === 0) return [];
  const ids = [...new Set(pool.map((h) => h.docId))];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDB()
    .prepare(`SELECT id, metadata FROM documents WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{ id: string; metadata: string | null }>;
  const allowed = new Set(
    rows
      .filter((r) => {
        try {
          return (JSON.parse(r.metadata ?? "{}") as { task_type?: string }).task_type === taskType;
        } catch {
          return false;
        }
      })
      .map((r) => r.id)
  );
  return pool.filter((h) => allowed.has(h.docId)).slice(0, topK);
}
