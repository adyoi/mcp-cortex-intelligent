import * as pipeline from "../knowledge/pipeline.js";
import { getDB } from "../db/database.js";

export async function ingestExemplar(taskType: string, language: string, title: string, content: string, outcome: string) {
  const doc = await pipeline.ingestText(content, title, { source: "exemplar", contentType: "text", metadata: { task_type: taskType, language, outcome } });
  return doc;
}

const DEFAULT_EXEMPLARS: Array<{ taskType: string; language: string; title: string; content: string; outcome: string }> = [
  { taskType: "code_review", language: "any", title: "Code review: read before edit", content: "Before editing, read the full file and surrounding callers. Check for hidden dependencies, shared state, and side effects. Prefer minimal diff. Run tests after.", outcome: "clean diff, no regressions" },
  { taskType: "debug", language: "any", title: "Debug: reproduce first", content: "Reproduce the bug with a minimal case before fixing. Add a failing test. Fix root cause, not symptom. Verify the test passes and no regressions.", outcome: "root cause fixed, regression test added" },
  { taskType: "refactor", language: "any", title: "Refactor: keep behavior", content: "Refactor in small steps, each preserving behavior. Run tests after each step. Never mix refactor with feature changes in one commit.", outcome: "behavior preserved, tests green" },
  { taskType: "test", language: "any", title: "Test: cover edge cases", content: "Write tests for happy path, edge cases, and error paths. Use property-based tests for invariants. Keep tests fast and isolated.", outcome: "high coverage, fast suite" },
  { taskType: "security", language: "any", title: "Security: validate inputs", content: "Validate all external inputs. Use allowlists, not blocklists. Escape output. Never store secrets. Run SSRF/path-traversal checks.", outcome: "no injection, no secret leak" },
];

export async function seedDefaultExemplars(): Promise<{ seeded: number }> {
  // Only seed if no exemplars exist yet (idempotent).
  const existing = await pipeline.searchDocs("exemplar", 1, 0.0, { source: "exemplar" });
  if (existing.length > 0) return { seeded: 0 };
  let seeded = 0;
  for (const e of DEFAULT_EXEMPLARS) {
    try { await ingestExemplar(e.taskType, e.language, e.title, e.content, e.outcome); seeded++; } catch { /* skip duplicates */ }
  }
  return { seeded };
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
