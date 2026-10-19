/**
 * Wipe ALL documents and memories from the current store (CORTEX_DB_DIR).
 * Destructive — requires --force to run.
 */
import { closeDB, getDB, STORAGE_DIR } from "../src/db/database.js";
import { invalidateVectorCache } from "../src/knowledge/vector-search.js";

if (!process.argv.includes("--force")) {
  console.error("Refusing to run without --force. This deletes ALL documents and memories in:");
  console.error("  " + STORAGE_DIR);
  process.exit(1);
}

const db = getDB();
db.exec("BEGIN IMMEDIATE;");
try {
  db.prepare("DELETE FROM chunks").run();
  db.prepare("DELETE FROM chunks_fts").run();
  db.prepare("DELETE FROM documents").run();
  db.prepare("DELETE FROM memories").run();
  db.prepare("DELETE FROM procedures").run();
  db.prepare("DELETE FROM exemplars").run();
  db.prepare("DELETE FROM tasks").run();
  db.prepare("DELETE FROM cognitive_scores").run();
  db.prepare("DELETE FROM decisions").run();
  db.prepare("DELETE FROM telemetry").run();
  db.prepare("DELETE FROM verification_runs").run();
  db.prepare("DELETE FROM session_state").run();
  db.prepare("DELETE FROM model_profiles").run();
  db.exec("COMMIT;");
} catch (e) {
  try {
    db.exec("ROLLBACK;");
  } catch {
    /* transaction already closed */
  }
  throw e;
}
invalidateVectorCache();

const docs = db.prepare("SELECT COUNT(*) AS c FROM documents").get() as { c: number };
const mems = db.prepare("SELECT COUNT(*) AS c FROM memories").get() as { c: number };
console.log("documents deleted:", docs.c === 0 ? "all" : `ERROR ${docs.c} remain`);
console.log("memories deleted:", mems.c === 0 ? "all" : `ERROR ${mems.c} remain`);

closeDB();
