  /* ================== 1. DB LAYER ================== */
  console.log("\n=== 1. Database Layer ===");
  const db = getDB();
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>).map((t) => t.name);
  check("tables created", ["documents", "chunks", "memories", "chunks_fts", "meta"].every((t) => tables.includes(t)), tables.join(","));
  check("DB file created on disk", fs.existsSync(DB_PATH));
  check("DB in test dir", DB_PATH.startsWith(TEST_DB));

  const vec = new Float64Array([0.1, 0.2, 0.3, -0.5, 0.9]);
  const packed = packVector(vec);
  const unpacked = unpackVector(packed);
  check("packVector/unpackVector roundtrip", unpacked !== null && unpacked.length === vec.length && unpacked[4] === 0.9);

  /* ================== 2. EMBEDDER ================== */
  console.log("\n=== 2. Embedder (local hashing) ===");
  const e1 = embed("fetch weather data for Jakarta");
  const e2 = embed("fetch weather data for Jakarta");
  const eDiff = embed("buy groceries at the supermarket");
  check("embed is deterministic", Array.from(e1).every((v, i) => v === e2[i]));
  check("embed has correct dim", e1.length === EMBED_DIM);
  check("embed is normalized", Math.abs(1 - (() => { let s = 0; for (const v of e1) s += v * v; return Math.sqrt(s); })()) < 1e-9);
  check("similar text scores higher", cosineSimilarity(e1, e2) > cosineSimilarity(e1, eDiff));
  check("dotProduct == cosine for normalized vectors", Math.abs(dotProduct(e1, e2) - cosineSimilarity(e1, e2)) < 1e-9);
  const cjk1 = embed("该引擎支持中文检索");
  const cjk2 = embed("该引擎支持中文检索");
  check("CJK text embeds", cosineSimilarity(cjk1, cjk2) > 0.99);

  /* ================== 3. CHUNKER ================== */
  console.log("\n=== 3. Chunker ===");
  const longText = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}: The quick brown fox jumps over the lazy dog near the river bank of Jakarta. This sentence provides additional detail for chunking tests.`).join("\n\n");
  const chunks = chunkText(longText);
  check("long text split into multiple chunks", chunks.length > 1, `got ${chunks.length}`);
  check("no chunk is empty", chunks.every((c) => c.text.trim().length > 0));
  check("chunks have overlap context", chunks.some((c) => c.text.includes("river bank")));
  check("each chunk under max size", chunks.every((c) => c.text.length <= 950));
  const sourceReconstruction = chunks.map((c) => c.text).join("");
  check("content preserved", Array.from(sourceReconstruction).length > Array.from(longText).length * 0.9);
  check("indexes sequential", chunks.every((c, i) => c.index === i));
  check("token estimation positive", chunks.every((c) => c.tokenCount > 0));

  /* ================== 4. KNOWLEDGE PIPELINE ================== */
  console.log("\n=== 4. Knowledge Pipeline ===");
  const doc1 = await kb.ingestText(
    "The authentication service uses JWT tokens, RSA signing with a 4096-bit key, and sessions expire after 30 minutes.",
    "Auth architecture"
  );
  const doc2 = await kb.ingestText(
    "Database migrations are handled with Prisma. The main schema lives in prisma/schema.prisma and there are 42 tables.",
    "DB setup",
    { contentType: "markdown", metadata: { project: "core" } }
  );
  check("ingestText returns doc id", typeof doc1.docId === "string" && doc1.docId.length > 0);
  check("ingestText created chunks", doc1.chunks >= 1, `chunks=${doc1.chunks}`);
  check("ingestText counts tokens", doc1.tokens > 0);
  check("ingestText not deduplicated on first insert", doc1.deduplicated === false);

  const s1 = await kb.searchDocs("jwt authentication RSA", 5);
  check("search finds auth doc first", s1.length > 0 && s1[0].docTitle === "Auth architecture", JSON.stringify(s1[0]));
  check("search returns scores", s1.every((h) => h.score > 0));
  check("search results include docTitle", s1.every((h) => h.docTitle));
  check("search hits include tokenCount", s1.length > 0 && s1.every((h) => typeof h.tokenCount === "number" && h.tokenCount > 0));

  const s2 = await kb.searchDocs("prisma migration tables", 5);
  check("search finds db doc ", s2.length > 0 && s2[0].docTitle === "DB setup");

  const sFiltered = await kb.searchDocs("jwt authentication RSA", 5, 0.08, { source: "scratch" });
  check("search filter: source narrows results", sFiltered.length === 0, JSON.stringify(sFiltered));

  const authDocId = kb.listDocuments().documents.find((d) => d.title === "Auth architecture")?.id as string;
  const sDocFiltered = await kb.searchDocs("jwt authentication RSA", 5, 0.08, { docId: authDocId });
  check("search filter: doc_id keeps only that document", sDocFiltered.length > 0 && sDocFiltered.every((h) => h.docId === authDocId && h.docTitle === "Auth architecture"), JSON.stringify(sDocFiltered[0] ?? null));

  const retrieved = await kb.retrieve("how is jwt signing configured", 3);
  check("retrieve returns context", retrieved.chunks.length > 0);
  check("retrieve reports tokens", retrieved.totalTokens >= retrieved.chunks[0]?.tokenCount);
  check("retrieve ranks auth content", retrieved.chunks[0]?.content.includes("JWT"), retrieved.chunks[0]?.content);

  const docs = kb.listDocuments();
  check("listDocuments returns 2 docs", docs.documents.length === 2 && docs.total === 2);
  check("listDocuments paginates", kb.listDocuments({ limit: 1 }).documents.length === 1 && kb.listDocuments({ limit: 1 }).total === 2);
  check("listDocuments offset skips", kb.listDocuments({ limit: 1, offset: 1 }).documents[0]?.id !== docs.documents[0]?.id);
  check("listDocuments clamps limit", kb.listDocuments({ limit: 10_000 }).total === 2);
  const stats = await kb.documentStats();
  check("documentStats correct", stats.documents === 2 && stats.chunks === doc1.chunks + doc2.chunks, JSON.stringify(stats));

  // Content-hash dedup.
  const dupText = "Deduplication marker content alpha beta gamma.";
  const d1 = await kb.ingestText(dupText, "Dup first");
  const d2 = await kb.ingestText(dupText, "Dup second");
  check("dedup returns existing doc id", d2.deduplicated === true && d2.docId === d1.docId);
  check("dedup reuses chunk count", d2.chunks === d1.chunks);
  const statsAfterDup = await kb.documentStats();
  check("dedup does not grow store", statsAfterDup.documents === stats.documents + 1 && statsAfterDup.chunks === stats.chunks + d1.chunks, JSON.stringify(statsAfterDup));
  await kb.deleteDocument(d1.docId);
  const statsAfterDupDelete = await kb.documentStats();
  check("dedup doc deletable", statsAfterDupDelete.documents === stats.documents);

  let emptyGuardHit = false;
  try {
    await kb.ingestText("", "empty doc");
  } catch (e) {
    emptyGuardHit = (e as Error).message.includes("non-empty");
  }
  check("ingestText rejects empty content", emptyGuardHit);

  // Hybrid / keyword search modes.
  const kwDoc = await kb.ingestText(
    "The zzzqx hypertesting marker appears exclusively inside this single document body.",
    "Hybrid marker"
  );
  const prevMode = process.env.SEARCH_MODE;
  process.env.SEARCH_MODE = "keyword";
  const kw = await kb.searchDocs("zzzqx", 5);
  check("keyword (FTS5) search finds exact term", kw.length > 0 && kw[0].docTitle === "Hybrid marker", JSON.stringify(kw[0] ?? null));
  process.env.SEARCH_MODE = "vector";
  const vh = await kb.searchDocs("zzzqx hypertesting", 5);
  check("vector search still works", vh.length >= 1, JSON.stringify(vh.length));
  process.env.SEARCH_MODE = "hybrid";
  const hy = await kb.searchDocs("zzzqx hypertesting", 5);
  check("hybrid search returns marker doc", hy.length >= 1 && hy.some((h) => h.docTitle === "Hybrid marker"));
  if (prevMode === undefined) delete process.env.SEARCH_MODE;
  else process.env.SEARCH_MODE = prevMode;
  await kb.deleteDocument(kwDoc.docId);

  // ingestFile + size guard.
  const fPath = path.join(ROOT, "src/test/sample.md");
  fs.writeFileSync(fPath, "# Sample\n\nThe rate limiter allows 100 requests per second per API key.");
  const doc3 = await kb.ingestFile(fPath);
  check("ingestFile works", doc3.chunks >= 1);
  check("ingestFile detects markdown", doc3.title === "sample.md");
  fs.rmSync(fPath);

  const bigPath = path.join(TEST_DB, "big.ts");
  fs.writeFileSync(bigPath, "x".repeat(4096));
  process.env.KB_MAX_FILE_MB = "0.0005";
  let sizeGuardHit = false;
  try {
    await kb.ingestFile(bigPath);
  } catch (e) {
    sizeGuardHit = (e as Error).message.includes("too large");
  }
  check("size guard rejects large files", sizeGuardHit);
  delete process.env.KB_MAX_FILE_MB;

  // KB_ALLOWED_DIRS allowlist.
  const okPath = path.join(TEST_DB, "ok.ts");
  fs.writeFileSync(okPath, "allowlisted content one two three.");
  const blkPath = path.join(ROOT, "src/test/blk.ts");
  fs.writeFileSync(blkPath, "blocked content four five six.");
  process.env.KB_ALLOWED_DIRS = TEST_DB;
  let allowGuardHit = false;
  try {
    await kb.ingestFile(blkPath);
  } catch (e) {
    allowGuardHit = (e as Error).message.includes("not allowed");
  }
  check("allowlist blocks outside paths", allowGuardHit);
  const okDoc = await kb.ingestFile(okPath);
  check("allowlist allows inside paths", okDoc.docId !== undefined);
  await kb.deleteDocument(okDoc.docId);
  delete process.env.KB_ALLOWED_DIRS;
  fs.unlinkSync(blkPath);
  fs.unlinkSync(bigPath);

  const d = await kb.deleteDocument(doc3.docId);
  check("deleteDocument works", d.deleted === true);
  const docsAfter = kb.listDocuments();
  check("document removed after delete", docsAfter.total === 2);

  // ingestDirectory skips junk dirs and tolerates per-file failures.
  const srcDir = path.join(TEST_DB, "ingest-src");
  fs.mkdirSync(path.join(srcDir, ".git"), { recursive: true });
  fs.mkdirSync(path.join(srcDir, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(srcDir, ".git", "config.ts"), "git internal stuff.");
  fs.writeFileSync(path.join(srcDir, "node_modules", "dep.ts"), "dependency code.");
  for (let i = 0; i < 12; i++) {
    fs.writeFileSync(path.join(srcDir, `file${i}.ts`), `module file ${i} with distinct payload.`);
  }
  fs.writeFileSync(path.join(srcDir, "notes.txt"), "not an extension we ingest.");
  const dirResult = await kb.ingestDirectory(srcDir, { recursive: true });
  const dirTitles = dirResult.ingested.map((r) => r.title);
  check("ingest-dir ingests source + txt files", dirResult.ingested.length === 13, `got ${dirResult.ingested.length}`);
  check("ingest-dir reports ingestedCount", dirResult.ingestedCount === 13, JSON.stringify(dirResult.ingestedCount));
  check("ingest-dir skips .git and node_modules", !dirTitles.includes("config.ts") && !dirTitles.includes("dep.ts"), JSON.stringify(dirTitles));
  check("ingest-dir includes txt default ext", dirTitles.includes("notes.txt"));
  check("ingest-dir reports no failures", dirResult.skipped.length === 0, JSON.stringify(dirResult.skipped));
  fs.rmSync(srcDir, { recursive: true, force: true });
