import * as db from "../db/database.js";

export function listProcedures(): any[] {
  try {
    return db.getDB().prepare("SELECT id, name, version, tags FROM procedures ORDER BY name").all() as any[];
  } catch {
    return [];
  }
}

export function getProcedure(name: string): any {
  try {
    return db.getDB().prepare("SELECT * FROM procedures WHERE name = ?").get(name);
  } catch {
    return null;
  }
}

export function ingestProcedure(name: string, version: string, content: string, tags: string[] = []) {
  const id = `proc-${name}-${version}`;
  db.getDB().prepare(
    "INSERT OR REPLACE INTO procedures (id, name, version, content, tags, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(id, name, version, content, JSON.stringify(tags), "manual", Date.now(), Date.now());
  return { id, name, version };
}
