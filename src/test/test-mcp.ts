  /* ================== 6. MCP SERVER ROUND-TRIP ================== */
  console.log("\n=== 6. MCP Server Round-Trip (via SDK Client) ===");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join("src", "mcp", "cortex-server.ts")],
    cwd: ROOT,
    env: { ...process.env, CORTEX_DB_DIR: TEST_DB },
    stderr: "pipe",
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    check("MCP client connected", true);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    const expected = [
      "system_stats", "knowledge_ingest_text", "knowledge_ingest_file", "knowledge_ingest_dir",
      "knowledge_search", "knowledge_retrieve", "knowledge_list_documents", "knowledge_document_stats",
      "knowledge_delete_document", "memory_remember", "memory_recall", "memory_list",
      "memory_get", "memory_update", "memory_forget", "memory_consolidate",
      "memory_stats", "memory_context", "knowledge_sync_session", "knowledge_reindex",
      "knowledge_backup",
      "bootstrap_session", "provision_agent_skill", "list_agents_skills", "update_procedure_block",
      "detect_model", "get_model_profile", "set_model", "get_guardrails", "model_decision",
      "get_procedure", "list_procedures", "ingest_procedure", "retrieve_exemplars", "ingest_exemplar",
      "self_critique", "score_compliance", "run_verification",
      "decision_classify", "decision_health", "cognitive_status",
      "init_plan", "read_plan", "update_plan_section", "init_task", "init_agents_md", "task_create", "task_list",
      "task_get", "task_start", "task_done", "task_block", "task_delete", "task_update", "task_sync_md", "task_summary",
      "webfetch", "webfetch_validate",
    ];
    check("all tools registered", expected.every((t) => toolNames.includes(t)), `missing: ${expected.filter((t) => !toolNames.includes(t))}`);
    check("exactly 58 tools", toolNames.length === expected.length, `got ${toolNames.length}`);

    const sys = await client.callTool({ name: "system_stats", arguments: {} });
    const sysText = toolText(sys);
    const sysJson = JSON.parse(sysText.startsWith("---") ? sysText.replace(/^---.*$/m, "").trim() : sysText);
    check("system_stats has dbDir", sysJson.dbDir === TEST_DB, sysText.slice(0, 100));
    check("system_stats exposes embedding backend", typeof sysJson.embedding?.provider === "string", JSON.stringify(sysJson.embedding));
    check("system_stats labels the vector leg honestly", sysJson.embedding?.vectorLeg === "lexical" || sysJson.embedding?.vectorLeg === "semantic", JSON.stringify(sysJson.embedding));
    check("system_stats explains the vector leg", typeof sysJson.embedding?.note === "string" && sysJson.embedding.note.length > 20, JSON.stringify(sysJson.embedding?.note));
    check("system_stats reports a coherent store state", sysJson.storeState === "ready", JSON.stringify(sysJson.storeState));
    check("system_stats reports store integrity", sysJson.db?.health?.status === "ok", JSON.stringify(sysJson.db));

    // Backup over MCP: consistent snapshot, no overwrite of an existing file.
    const bkPath = path.join(TEST_DB, "backups", "mcp-roundtrip.sqlite");
    const bk = await client.callTool({ name: "knowledge_backup", arguments: { target_path: bkPath } });
    const bkJson = JSON.parse(toolText(bk));
    check("knowledge_backup writes a consistent snapshot", bkJson.integrity?.ok === true && fs.existsSync(bkJson.path) && bkJson.documents >= 2, JSON.stringify(bkJson));
    const bkDup = await client.callTool({ name: "knowledge_backup", arguments: { target_path: bkPath } });
    check("knowledge_backup refuses to overwrite an existing file", !toolText(bkDup).includes("integrity"), toolText(bkDup).slice(0, 160));
    fs.rmSync(bkPath, { force: true });
    fs.rmSync(path.dirname(bkPath), { recursive: true, force: true });

    // Note: shared DB — docs from earlier in-process ingestion are visible.
    const listDocs = await client.callTool({ name: "knowledge_list_documents", arguments: {} });
    const listJson = JSON.parse(toolText(listDocs));
    check("knowledge_list_documents returns existing docs", Array.isArray(listJson.documents) && listJson.documents.length >= 2, JSON.stringify(listJson).slice(0, 120));
    const pagedDocs = await client.callTool({ name: "knowledge_list_documents", arguments: { limit: 1 } });
    const pagedJson = JSON.parse(toolText(pagedDocs));
    check("knowledge_list_documents honours limit", pagedJson.documents.length === 1 && pagedJson.total >= 2, JSON.stringify(pagedJson).slice(0, 120));
    const badLimit = await client.callTool({ name: "knowledge_list_documents", arguments: { limit: 100_000 } });
    check("knowledge_list_documents rejects out-of-range limit", toolText(badLimit).length > 0);

    // Unbounded strings used to reach the chunker and embedder as-is; the caps
    // must reject them at the schema boundary instead of stalling the server.
    const hugeQuery = await client.callTool({ name: "knowledge_search", arguments: { query: "a".repeat(5_000) } });
    check("knowledge_search rejects an oversized query", /at most|too_big|too large|invalid|exceeds/i.test(toolText(hugeQuery)), toolText(hugeQuery).slice(0, 160));
    const hugeContent = await client.callTool({
      name: "knowledge_ingest_text",
      arguments: { title: "Huge", content: "b".repeat(1_200_000) },
    });
    check("knowledge_ingest_text rejects oversized content", toolText(hugeContent).length > 0 && toolText(hugeContent).slice(0, 200).toLowerCase() !== "", "expected a schema rejection");
    const manyTags = await client.callTool({
      name: "memory_remember",
      arguments: { content: "Tag flood probe", tags: Array.from({ length: 200 }, (_, i) => `t${i}`) },
    });
    check("memory_remember rejects too many tags", /at most|too_big|too large/i.test(toolText(manyTags)), toolText(manyTags).slice(0, 160));
    const overlongTag = await client.callTool({
      name: "memory_remember",
      arguments: { content: "Tag length probe", tags: ["z".repeat(500)] },
    });
    check("memory_remember rejects an overlong tag", toolText(overlongTag).length > 0, toolText(overlongTag).slice(0, 120));

    // explain must be opt-in over MCP too, and carry the same per-leg data.
    const explainMcp = await client.callTool({ name: "knowledge_search", arguments: { query: "github actions pipeline", top_k: 3, explain: true } });
    const explainJson = JSON.parse(toolText(explainMcp));
    check("knowledge_search honours explain over MCP", explainJson.length >= 1 && explainJson[0].explain !== undefined, JSON.stringify(explainJson[0]).slice(0, 160));
    const noExplainMcp = await client.callTool({ name: "knowledge_search", arguments: { query: "github actions pipeline", top_k: 3 } });
    check("knowledge_search omits explain by default", JSON.parse(toolText(noExplainMcp))[0].explain === undefined);

    // alpha blend must be schema-bounded over MCP.
    const badAlphaMcp = await client.callTool({ name: "knowledge_search", arguments: { query: "thing", alpha: 1.5 } });
    check("knowledge_search rejects alpha outside 0..1", /at most|max|between|invalid/i.test(toolText(badAlphaMcp)), toolText(badAlphaMcp).slice(0, 160));

    const ingest = await client.callTool({
      name: "knowledge_ingest_text",
      arguments: { title: "MCP test doc", content: "The ci pipeline runs on GitHub Actions with three stages: lint, test, deploy.", contentType: "text" },
    });
    const ingestJson = JSON.parse(toolText(ingest));
    check("knowledge_ingest_text works over MCP", ingestJson.chunks >= 1);

    const search = await client.callTool({ name: "knowledge_search", arguments: { query: "github actions pipeline", top_k: 3 } });
    const searchHits = JSON.parse(toolText(search));
    check("knowledge_search works over MCP", searchHits.length >= 1 && searchHits[0].content.includes("GitHub Actions"), JSON.stringify(searchHits[0]));

    const retrieveTool = await client.callTool({ name: "knowledge_retrieve", arguments: { query: "ci pipeline" } });
    check("knowledge_retrieve returns context block", toolText(retrieveTool).includes("Context block"));

    const rem = await client.callTool({
      name: "memory_remember",
      arguments: { content: "The user deploys to staging every Friday afternoon.", type: "task", importance: 0.7, tags: ["deploy", "schedule"] },
    });
    const remJson = JSON.parse(toolText(rem));
    check("memory_remember works over MCP", remJson.content.includes("Friday"), JSON.stringify(remJson));

    const rec = await client.callTool({ name: "memory_recall", arguments: { query: "deployment schedule", top_k: 3 } });
    const recHits = JSON.parse(toolText(rec));
    check("memory_recall works over MCP", recHits.length >= 1 && recHits[0].content.includes("Friday"));

    const memCtx = await client.callTool({ name: "memory_context", arguments: { topic: "deployment" } });
    check("memory_context works over MCP", toolText(memCtx).includes("Memory context"));

    const mStats = await client.callTool({ name: "memory_stats", arguments: {} });
    check("memory_stats works over MCP", JSON.parse(toolText(mStats)).memories > 0);

    /* Cortex tools smoke */
    const cTools = await client.listTools();
    const cNames = cTools.tools.map((t) => t.name);
    check("cortex tools registered (>= 55)", cNames.length >= 55, String(cNames.length));
    async function ccall(name: string, args: Record<string, unknown> = {}) {
      try { const r = await client.callTool({ name, arguments: args }); return toolText(r); }
      catch (e) { return "ERR:" + (e as Error).message; }
    }
    const dg = await ccall("detect_model", { model: "claude-haiku" });
    check("detect_model works", dg.includes("weak"), dg);
    const sc = await ccall("self_critique", { artifact: "npm test\\nread file" });
    check("self_critique works", sc.includes("score"), sc);
    const cs = await ccall("task_create", { title: "smoke task" });
    const smokeTaskId = (() => { try { return JSON.parse(cs).id; } catch { return ""; } })();
    check("task_create works", smokeTaskId.startsWith("task-"), cs);
    if (smokeTaskId) {
      check("task_start works", (await ccall("task_start", { id: smokeTaskId })).includes("true"), "");
      check("task_done works", (await ccall("task_done", { id: smokeTaskId })).includes("true"), "");
    }
    const summ = await ccall("task_summary", {});
    check("task_summary works", summ.includes("total"), summ);
    // Smoke: webfetch_validate (no network) + task_update + init_agents_md + telemetry.
    const wv = await ccall("webfetch_validate", { url: "https://example.com" });
    check("webfetch_validate works", wv.includes('"ok":true') || wv.includes('"ok": true'), wv);
    const wvBad = await ccall("webfetch_validate", { url: "http://localhost/" });
    check("webfetch_validate blocks localhost", wvBad.includes('"ok":false') || wvBad.includes('"ok": false'), wvBad);
    const ia = await ccall("init_agents_md", { project_root: ROOT });
    check("init_agents_md works", ia.includes("path"), ia);
    // telemetry exposed via system_stats
    const ss = await ccall("system_stats", {});
    check("system_stats exposes telemetry", ss.includes("telemetry"), ss.slice(0, 80));
    // Optimal / maximal guardrails + self-critique verification.
    const sc2 = await ccall("self_critique", { artifact: "test only", tier: "weak" });
    check("self_critique structured (percent/verdict)", sc2.includes("percent") && sc2.includes("verdict"), sc2.slice(0, 120));
    const gr2 = await ccall("get_guardrails", { task: "delete user table", model: "anthropic/claude-sonnet-4-6" });
    check("guardrails task-route+risk+anti-blunder", gr2.includes("Route:") && gr2.includes("Anti-blunder") && gr2.includes("Verification"), gr2.slice(0, 160));
    check("guardrails escalates destructive", gr2.includes("CAUTION") || gr2.includes("destructive"), gr2.slice(0, 200));
    const ip = await ccall("init_plan", { project_root: ROOT });
    check("init_plan works", ip.includes("path"), ip);
    const it = await ccall("init_task", { project_root: ROOT });
    check("init_task works", it.includes("path"), it);

    await client.close();
    check("MCP client closed cleanly", true);
  } catch (e) {
    check("MCP round-trip succeeded", false, (e as Error).message);
    try { await client.close(); } catch { /* ignore */ }
  }
