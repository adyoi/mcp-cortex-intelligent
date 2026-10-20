  /* ================== 7. SESSION SYNC ================== */
  console.log("\n=== 7. Session Sync (jsonl logs + transcript) ===");
  const sess = await import("../session/transcript.js");

  const logDir = path.join(TEST_DB, "session-logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "ses-demo.jsonl");
  fs.writeFileSync(
    logFile,
    [
      JSON.stringify({ ts: 1000, session: "ses-demo", content: "Session log line one about the flying birds of Java island." }),
      JSON.stringify({ ts: 2000, session: "ses-demo", content: "Session log line two, a follow-up question about databases." }),
      JSON.stringify({ ts: 3000, session: "ses-demo", content: "   " }),
      "not-json-at-all",
      "",
    ].join("\n"),
    "utf8"
  );

  const parsed = sess.readJsonl(logFile);
  check("readJsonl parses valid lines only", parsed.length === 2, `got ${parsed.length}`);

  /* --- key-point condensing --- */
  const short = "Singkat saja";
  const shortOut = sess.condenseInput(short);
  check("short input passes through untouched", shortOut === short, shortOut);

  const longUncondensed =
    "Hari ini saya memutuskan arsitektur utama untuk layanan autentikasi dengan JWT token, RSA signing, dan expiry. " +
    "Kami juga memilih Prisma sebagai ORM dengan schema tunggal, dan Chart.js untuk dashboard. " +
    "Deployment dilakukan ke staging setiap Jumat sore menggunakan GitHub Actions dengan tiga stage lint, test, dan deploy. " +
    "Semua rahasia disimpan di vault dan tidak boleh masuk repository. " +
    "Tim kecil ini menyepakati bahwa review kode wajib sebelum merge. " +
    "Anggaran bulanan infrastruktur dijaga di bawah sepuluh juta rupiah.";
  const longOut = sess.condenseInput(longUncondensed);
  check("long input condensed", longOut.length < longUncondensed.length, `${longUncondensed.length} -> ${longOut.length}`);
  check("condense is deterministic", longOut === sess.condenseInput(longUncondensed));
  check("condense keeps key facts", longOut.includes("autentikasi") || longOut.includes("Prisma") || longOut.includes("staging"));

  const lr1 = await sess.ingestJsonlFile(logFile);
  check("ingest-jsonl creates one doc per message", lr1.newDocs === 2, JSON.stringify(lr1));
  check("blank/malformed lines skipped", lr1.messages === 2 && lr1.skipped === 0, JSON.stringify(lr1));

  const lr2 = await sess.ingestJsonlFile(logFile);
  check("re-run deduplicates by content-hash", lr2.deduplicated === 2 && lr2.newDocs === 0, JSON.stringify(lr2));

  const ls = await kb.searchDocs("flying birds java", 5);
  check("session log entries searchable", ls.some((h) => h.content.includes("flying")), JSON.stringify(ls[0]));

  const ld = await sess.ingestLogDir(logDir);
  check("ingest-logs-dir counts files and stays idempotent", ld.files === 1 && ld.newDocs === 0 && ld.deduplicated === 2, JSON.stringify(ld));

  const withMeta = kb.listDocuments().documents.find((d) => (d as { title: string }).title.includes("ses-demo")) as { source?: string; metadata?: unknown };
  check("listDocuments exposes source metadata", withMeta?.source === "session-log" && typeof withMeta?.metadata === "string", JSON.stringify(withMeta));

  /* ================== 8. Env loader + entry shim ================== */
  const { loadDotenv } = await import("../env.js");
  const envFile = path.join(TEST_DB, "env-fixture");
  fs.writeFileSync(
    envFile,
    [
      "# comment line",
      "KB_ENVTEST_ALPHA=hello",
      'KB_ENVTEST_QUOTED="two words"',
      'KB_ENVTEST_QCOMMENT="two words" # trailing note',
      "KB_ENVTEST_SINGLE='raw value'",
      "export KB_ENVTEST_EXPORT=ok",
      "KB_ENVTEST_INLINE=val # keep the note out",
      "KB_ENVTEST_EMPTY=",
      "AWS_SECRET_ACCESS_KEY=must-not-leak",
      "KB_ENVTEST_HASH=a#b",
      "1BAD_KEY=nope",
    ].join("\n"),
    "utf8"
  );
  process.env.KB_ENVTEST_PRESET = "existing";
  loadDotenv(envFile);
  check("env: existing var never overridden", process.env.KB_ENVTEST_PRESET === "existing");
  check("env: plain KEY=VALUE", process.env.KB_ENVTEST_ALPHA === "hello", process.env.KB_ENVTEST_ALPHA);
  check("env: quoted value stripped", process.env.KB_ENVTEST_QUOTED === "two words", process.env.KB_ENVTEST_QUOTED);
  check("env: comment after closing quote stripped", process.env.KB_ENVTEST_QCOMMENT === "two words", process.env.KB_ENVTEST_QCOMMENT);
  check("env: single quotes stripped", process.env.KB_ENVTEST_SINGLE === "raw value", process.env.KB_ENVTEST_SINGLE);
  check("env: export prefix stripped", process.env.KB_ENVTEST_EXPORT === "ok", process.env.KB_ENVTEST_EXPORT);
  check("env: inline comment stripped", process.env.KB_ENVTEST_INLINE === "val", process.env.KB_ENVTEST_INLINE);
  check("env: empty value stored as ''", process.env.KB_ENVTEST_EMPTY === "", JSON.stringify(process.env.KB_ENVTEST_EMPTY));
  check("env: hash without preceding space kept", process.env.KB_ENVTEST_HASH === "a#b", process.env.KB_ENVTEST_HASH);
  check("env: foreign keys are not injected", process.env.AWS_SECRET_ACCESS_KEY === undefined, String(process.env.AWS_SECRET_ACCESS_KEY));
  for (const k of ["KB_ENVTEST_ALPHA", "KB_ENVTEST_QUOTED", "KB_ENVTEST_QCOMMENT", "KB_ENVTEST_SINGLE", "KB_ENVTEST_EXPORT", "KB_ENVTEST_INLINE", "KB_ENVTEST_EMPTY", "KB_ENVTEST_HASH", "KB_ENVTEST_PRESET"]) delete process.env[k];

  // End-to-end: the published entry shim must load CORTEX_ENV_FILE before booting the
  // server, so the store lands where the .env points. Spawned as a real process
  // (node + tsx loader) to exercise the exact startup path. Keeps stdin open so
  // the sequential handshake (init → initialized → tools/call) completes.
  const { spawn } = await import("node:child_process");
  const envDir = path.join(TEST_DB, "entry-store");
  fs.rmSync(envDir, { recursive: true, force: true });
  const entryEnv = path.join(TEST_DB, "entry-env");
  fs.writeFileSync(entryEnv, `CORTEX_DB_DIR=${JSON.stringify(envDir)}`, "utf8");

  const runEntry = (lines: string[]) =>
    new Promise<string>((resolve, reject) => {
      const childEnv: Record<string, string | undefined> = { ...process.env, CORTEX_ENV_FILE: entryEnv };
      delete childEnv.CORTEX_DB_DIR;
      const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
        cwd: ROOT,
        env: childEnv,
        stdio: ["pipe", "pipe", "ignore"],
      });
      let out = "";
      let sent = 0;
      const killer = setTimeout(() => {
        child.kill();
        reject(new Error(`entry shim timeout; received: ${out.trim()}`));
      }, 30_000);
      child.stdout!.on("data", (chunk) => {
        out += chunk;
        // Progress the handshake once the previous response has landed.
        if (sent === 1 && out.includes('"id":1')) {
          sent = 2;
          child.stdin!.write(lines[1] + "\n");
          child.stdin!.write(lines[2] + "\n");
        }
        if (sent === 2 && out.includes('"id":2')) {
          clearTimeout(killer);
          child.kill();
          resolve(out);
        }
      });
      child.stdin!.write(lines[0] + "\n");
      sent = 1;
    });

  const entryOut = await runEntry([
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"suite","version":"0"}}}',
    '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"system_stats","arguments":{}}}',
  ]).catch((e) => {
    check("entry: server answered initialize + tools/call", false, String(e));
    return "";
  });
  const outLines = entryOut.split("\n").filter(Boolean);
  const last = outLines[outLines.length - 1] ?? "";
  check("entry: server answered initialize + tools/call", outLines.length >= 2 && /"id":2/.test(entryOut), outLines.join(" | "));
  const parsedStat = (() => {
    try {
      const o = JSON.parse(last) as { result?: { content?: Array<{ text?: string }> } };
      return JSON.parse(o.result?.content?.[0]?.text ?? "{}") as { dbDir?: string };
    } catch {
      return {};
    }
  })();
  check("entry: CORTEX_ENV_FILE honored (dbDir from .env)", parsedStat.dbDir === path.resolve(envDir), String(parsedStat.dbDir));
  check("entry: exists on disk", fs.existsSync(path.join(ROOT, "src", "index.ts")));

  const htmlT = htmlToText('<html><title>Test Page</title><body><p>Hello world</p></body></html>');
  check("htmlToText extracts title and body", htmlT.title === "Test Page" && htmlT.text.includes("Hello world"), JSON.stringify(htmlT));
  check("validateUrl allows public https", validateUrl("https://example.com/").ok === true, "");
  check("validateUrl blocks localhost", validateUrl("http://localhost/").ok === false, "");
  check("isBlockedHost blocks 10.x", isBlockedHost("10.0.0.1"), "");

  console.log("\n=== 9. Hardening Regressions ===");

  // FTS index must be populated, not just created: a fresh table with no backfill
  // makes every pre-existing chunk invisible to keyword search forever.
  const chunkCount = (db.prepare("SELECT COUNT(*) AS c FROM chunks").get() as { c: number }).c;
  const ftsCount = (db.prepare("SELECT COUNT(*) AS c FROM chunks_fts").get() as { c: number }).c;
  check("chunks_fts backfilled from chunks", ftsCount === chunkCount, `chunks=${chunkCount} fts=${ftsCount}`);

  // FTS5 syntax characters in a user query used to be passed to MATCH raw and
  // throw "fts5: syntax error near ...".
  let ftsBoom = "";
  try {
    await kb.searchDocs('zzzqx AND (unbalanced "quote NEAR/2', 5);
  } catch (e) {
    ftsBoom = (e as Error).message;
  }
  check("FTS special characters do not throw", ftsBoom === "", ftsBoom);
  const partialTerm = await kb.searchDocs("uthenticatio", 5, 0);
  check("trigram substring search works", partialTerm.length > 0, JSON.stringify(partialTerm.length));

  // min_score must be a real filter on the final fused score: every returned hit
  // clears the threshold, and raising it never widens the result set.
  const loose = await kb.searchDocs("jwt authentication RSA", 10, 0.05);
  const strict = await kb.searchDocs("jwt authentication RSA", 10, 0.9);
  check("min_score filters on the final score", strict.every((h) => h.score >= 0.9) && strict.length <= loose.length, JSON.stringify({ loose: loose.length, strict: strict.length }));
  check("min_score 0 keeps hits", loose.length > 0);
  check("scores stay in 0..1", loose.every((h) => h.score >= 0 && h.score <= 1), JSON.stringify(loose.map((h) => h.score)));

  // Cross-connection cache invalidation: a second process/connection writing to
  // the store must be visible without reopening this one (the CLI, the plugin
  // and a second MCP server all write through their own handles).
  const { DatabaseSync } = await import("node:sqlite");
  const other = new DatabaseSync(DB_PATH);
  const now = Date.now();
  const foreignText = "quixoticflimflam external writer inserted this paragraph directly";
  other.exec("BEGIN IMMEDIATE;");
  other
    .prepare("INSERT INTO documents (id, title, source, content_type, metadata, chunk_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run("foreign-doc", "Foreign write", "external", "text", "{}", 1, now, now);
  other
    .prepare("INSERT INTO chunks (id, doc_id, idx, content, embedding, token_count, created_at) VALUES (?,?,?,?,?,?,?)")
    .run("foreign-chunk", "foreign-doc", 0, foreignText, Buffer.from(packVector(embed(foreignText))), 12, now);
  other.exec("COMMIT;");
  other.close();
  const foreignHit = await kb.searchDocs("quixoticflimflam", 5, 0);
  check("search sees another connection's write", foreignHit.some((h) => h.docId === "foreign-doc"), JSON.stringify(foreignHit[0] ?? null));
  kb.deleteDocument("foreign-doc");
  check("foreign doc deleted", !kb.listDocuments({ limit: 1000 }).documents.some((d) => d.id === "foreign-doc"));

  // dedupScope: identical text in two scopes must NOT collapse into one document.
  const scopedText = "identical payload for the dedup scope check";
  const sA = await kb.ingestText(scopedText, "Scope A", { dedupScope: "sess-a:1" });
  const sB = await kb.ingestText(scopedText, "Scope B", { dedupScope: "sess-b:1" });
  check("different dedup scopes keep both docs", sA.docId !== sB.docId && sB.deduplicated === false, JSON.stringify({ a: sA.docId, b: sB.docId }));
  const sB2 = await kb.ingestText(scopedText, "Scope B again", { dedupScope: "sess-b:1" });
  check("same dedup scope dedupes", sB2.deduplicated === true && sB2.docId === sB.docId, JSON.stringify(sB2));
  kb.deleteDocument(sA.docId);
  kb.deleteDocument(sB.docId);

  // consolidate must not eat distinct-but-similar templated memories. These two
  // are ~0.95 cosine on the hashing embedder but say different things.
  const beforeTpl = mem.memoryStats().memories;
  await mem.remember({ content: "The user's favourite editor is Neovim.", type: "preference", importance: 0.6 });
  await mem.remember({ content: "The user's favourite terminal is WezTerm.", type: "preference", importance: 0.6 });
  const tplReport = await mem.consolidate();
  check("consolidate keeps distinct templated memories", tplReport.removedDuplicates === 0, JSON.stringify(tplReport));
  check("templated memories both survive", mem.memoryStats().memories === beforeTpl + 2, JSON.stringify(mem.memoryStats().memories));
  check("consolidate reports totals", tplReport.totals.memories === mem.memoryStats().memories, JSON.stringify(tplReport.totals));

  // Chunker guards. An absurd overlap is clamped (not rejected) — the guarantee
  // that matters is that no chunk ever exceeds maxChars and nothing loops.
  const clampedOverlap = chunkText(longText, { maxChars: 200, overlapChars: 5000 });
  check("absurd overlap is clamped, chunks stay bounded", clampedOverlap.length > 1 && clampedOverlap.every((c) => c.text.length <= 200), JSON.stringify(clampedOverlap.length));
  check("chunkText rejects non-finite max", await rejects(() => chunkText("some text here", { maxChars: Number.NaN })));
  check("chunkText rejects negative overlap", await rejects(() => chunkText("some text here", { maxChars: 200, overlapChars: -1 })));
  const noOverlapText = Array.from({ length: 40 }, (_, i) => `Clause ${i} holds unique marker ${i * 7 + 3} plus filler words for boundary checks.`).join(" ");
  const noOverlap = chunkText(noOverlapText, { maxChars: 300, overlapChars: 0 });
  // Whitespace-normalized: the chunker re-joins sentences with " " or "\n",
  // so a raw char-by-char comparison breaks on the joiner, not on real overlap.
  // The fixture must be non-repetitive — identical clauses would match by
  // coincidence and prove nothing.
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const carriesContext = (prev: string, next: string) => {
    const tail = norm(prev).slice(-40);
    return tail.length === 40 && norm(next).includes(tail);
  };
  check("overlap 0 shares no text between chunks", noOverlap.length > 1 && noOverlap.every((c, i) => i === 0 || !carriesContext(noOverlap[i - 1].text, c.text)), JSON.stringify(noOverlap.length));
  check("overlap 0 keeps every chunk bounded", noOverlap.every((c) => c.text.length <= 300), JSON.stringify(noOverlap.map((c) => c.text.length)));
  const withOverlap = chunkText(noOverlapText, { maxChars: 300, overlapChars: 80 });
  check("overlap 80 carries context forward", withOverlap.length > 1 && withOverlap.some((c, i) => i > 0 && carriesContext(withOverlap[i - 1].text, c.text)), JSON.stringify(withOverlap.length));
const codeChunked = chunkText("```ts\nconst a = 1;\n```\n\nplain paragraph after the fence.", { maxChars: 200 });
    check("fenced code is kept intact", codeChunked.length >= 1 && codeChunked[0].text.includes("```"), JSON.stringify(codeChunked[0]?.text.slice(0, 60)));

    // No chunk may exceed maxChars. The window is normally kept under budget,
    // but carry() can prepend up to maxChars/2 to a full-size piece, and an
    // over-budget chunk wastes embedder context for no retrieval gain.
    const oversizeProbe = chunkText(
      Array.from({ length: 12 }, (_, i) => `sentence number ${i} `.repeat(8)).join(" "),
      { maxChars: 300, overlapChars: 150 }
    );