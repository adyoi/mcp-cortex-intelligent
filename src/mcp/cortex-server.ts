#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as path from "path";
import { createRequire } from "node:module";
import { STORAGE_DIR, closeDB, getEmbedState, storeHealthSummary } from "../db/database.js";
import { backupStore } from "../db/database.js";
import { embeddingInfo } from "../knowledge/embeddings.js";
import { reindex } from "../knowledge/reindex.js";
import {
  ingestText,
  ingestFile,
  ingestDirectory,
  searchDocs,
  retrieve,
  listDocuments,
  deleteDocument,
  documentStats,
  MAX_INGEST_CHARS,
} from "../knowledge/pipeline.js";
import {
  ingestSession as syncSession,
  ingestLatest as syncLatest,
} from "../session/transcript.js";
import {
  remember,
  recall,
  listMemories,
  getMemory,
  updateMemory,
  forget,
  consolidate,
  memoryStats,
  contextPrompt,
  MEMORY_TYPES,
} from "../memory/memory.js";
import type { MemoryType } from "../memory/memory.js";
import { provision } from "../provisioner/marker-block.js";
import { agentAutoBlock, agentPath, AGENT_VERSION } from "../provisioner/agent-generator.js";
import { skillAutoBlock, skillPath, SKILL_VERSION } from "../provisioner/skill-generator.js";
import { detectModel, tierOf } from "../model/resolver.js";
import { modelDecision } from "../model/model-decision.js";
import { getGuardrails } from "../model/guardrails.js";
import { selfCritique } from "../cognitive/self-critique.js";
import { scoreCompliance } from "../cognitive/compliance.js";
import { runVerification } from "../cognitive/verifier.js";
import { ingestExemplar, retrieveExemplars } from "../cognitive/exemplars.js";
import { decisionClassify, decisionHealth } from "../decision/internal.js";
import { recordToolCall, telemetryStats } from "../system/telemetry.js";
import { webFetch, validateUrl, FETCH_TIMEOUT_MS } from "../system/webfetch.js";
import { listProcedures, getProcedure, ingestProcedure } from "../procedures/library.js";
import * as pt from "../plantask/manager.js";

const require = createRequire(import.meta.url);
const serverVersion = require("../../package.json").version as string;

/**
 * Input bounds for every tool schema.
 *
 * These were all unbounded `z.string().min(1)`, which meant a single tool call
 * could push a megabyte of text straight into the chunker and embedder (a
 * synchronous CPU spin that blocks the whole stdio server), or a path long
 * enough to be a denial of service. The caps sit above any realistic input and
 * well below anything that would stall the process.
 */
const MAX_ID = 200;
const MAX_QUERY = 2_000;
const MAX_PATH = 4_096;
const MAX_TITLE = 500;
const MAX_TAG = 64;
const MAX_TAGS = 64;
const MAX_TOPIC = 500;
/** A memory is a self-contained statement, not a document. */
const MAX_MEMORY_CONTENT = 20_000;

const server = new McpServer({
  name: "cortex-server",
  version: serverVersion,
});

/**
 * Registration wrapper: every tool call is timed into the telemetry table.
 * Failures are recorded too and rethrown, so MCP error semantics stay intact.
 */
type ToolHandler = (args: any) => unknown;
function reg(name: string, config: any, handler: ToolHandler): void {
  server.registerTool(name, config, async (args: any) => {
    const t0 = Date.now();
    try {
      const result = await handler(args);
      recordToolCall(name, Date.now() - t0, true);
      return result as any;
    } catch (e) {
      recordToolCall(name, Date.now() - t0, false);
      throw e;
    }
  });
}

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */

reg(
  "system_stats",
  {
    description: "Get overall system stats: DB location, documents, chunks, memories, tokens, embedding backend",
    inputSchema: {},
  },
  async () => {
    const docs = documentStats();
    const mem = memoryStats();
    // Surface the embed_state too: a store stuck mid-reindex refuses every search,
    // and system_stats is the first thing anyone calls when a tool starts failing.
    const state = getEmbedState();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              dbDir: STORAGE_DIR,
              db: {
                path: path.join(STORAGE_DIR, "cortex.sqlite"),
                health: storeHealthSummary(),
              },
              embedding: embeddingInfo(),
              storeState: state === "" || state === "ready" ? "ready" : state,
              ...(state !== "" && state !== "ready"
                ? { remediation: "Run 'knowledge_reindex' to finish the interrupted migration." }
                : {}),
              documents: docs,
              memories: mem,
              telemetry: telemetryStats(),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/* ------------------------------------------------------------------ */
/* Web                                                                 */
/* ------------------------------------------------------------------ */

reg(
  "webfetch",
  {
    description:
      "Fetch a public http/https URL and return its title + readable text. " +
      "Private/loopback hosts are refused. Use `ingest: true` to also store the page in the knowledge base.",
    inputSchema: {
      url: z.string().min(1).max(MAX_PATH).describe("Absolute http/https URL."),
      max_chars: z.number().int().min(200).max(100_000).optional().default(2_000),
      timeout_ms: z.number().int().min(1_000).max(60_000).optional().default(FETCH_TIMEOUT_MS),
      ingest: z.boolean().optional().default(false).describe("Also store the page in the knowledge base."),
      source: z.string().min(1).max(MAX_TAG).optional().default("web"),
    },
  },
  async (args: { url: string; max_chars?: number; timeout_ms?: number; ingest?: boolean; source?: string }) => {
    const res = await webFetch(args.url, { maxChars: args.max_chars ?? 2_000, timeoutMs: args.timeout_ms ?? FETCH_TIMEOUT_MS });
    const out: Record<string, unknown> = {
      url: res.url,
      finalUrl: res.finalUrl,
      status: res.status,
      ok: res.ok,
      contentType: res.contentType,
      title: res.title,
      text: res.text,
      truncated: res.truncated,
      bytes: res.bytes,
      elapsedMs: res.elapsedMs,
    };
    if (args.ingest && res.ok && res.text) {
      try {
        // Dedup: skip if a document with this URL was already ingested.
        const existing = listDocuments({ limit: 1000 }).documents.find((d) => {
          try { return (JSON.parse((d as { metadata?: string }).metadata ?? "{}") as { url?: string }).url === res.finalUrl; } catch { return false; }
        });
        if (existing) {
          out.ingested = { id: (existing as { id: string }).id, title: (existing as { title: string }).title, deduplicated: true };
        } else {
          const doc = await ingestText(res.text, res.title || res.finalUrl, { source: args.source ?? "web", contentType: "text", metadata: { url: res.finalUrl } });
          out.ingested = { id: doc.docId, title: doc.title };
        }
      } catch (e) {
        out.ingestError = (e as Error).message;
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }
);

reg(
  "webfetch_validate",
  {
    description: "Validate a URL for webfetch (protocol + SSRF guard) without fetching it.",
    inputSchema: { url: z.string().min(1).max(MAX_PATH) },
  },
  async (args: { url: string }) => {
    const v = validateUrl(args.url);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            v.ok
              ? { ok: true, url: v.url.href, protocol: v.url.protocol, host: v.url.hostname }
              : { ok: false, error: v.error }
          ),
        },
      ],
    };
  }
);

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

reg(
  "knowledge_reindex",
  {
    description:
      "Re-embed every stored vector for the currently configured EMBEDDING_PROVIDER/MODEL. " +
      "Use after changing the embedding model or dimension to migrate the existing store in place " +
      "instead of wiping and re-ingesting. Searches are blocked while it runs; re-run to resume " +
      "after an interruption.",
    inputSchema: {
      batch_size: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .default(32)
        .describe("Chunks embedded per transaction. Lower uses less memory, higher is faster."),
    },
  },
  async (args: { batch_size?: number }) => {
    const res = await reindex({
      batchSize: args.batch_size ?? 32,
      onProgress: (p) => {
        if (p.total > 0) process.stderr.write(`reindex ${p.phase}: ${p.done}/${p.total}\n`);
      },
    });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

reg(
  "knowledge_backup",
  {
    description:
      "Snapshot the store to a consistent SQLite file (VACUUM INTO, safe under WAL) and report its integrity. " +
      "Refuses to overwrite an existing file. Restore is done offline via 'cli restore <file>' while the server is stopped.",
    inputSchema: {
      target_path: z
        .string()
        .min(1)
        .max(MAX_PATH)
        .optional()
        .describe("Absolute target path; defaults to <CORTEX_DB_DIR>/backups/cortex-backup-<timestamp>.sqlite"),
    },
  },
  async (args: { target_path?: string }) => {
    const target = args.target_path ?? path.join(STORAGE_DIR, "backups", `cortex-backup-${Date.now()}.sqlite`);
    const res = backupStore(target);
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Knowledge: ingest                                                         */
/* ------------------------------------------------------------------ */

reg(
  "knowledge_ingest_text",
  {
    description: "Store raw text as a knowledge document (chunked + embedded for later retrieval)",
    inputSchema: {
      content: z.string().min(1).max(MAX_INGEST_CHARS),
      title: z.string().max(MAX_TITLE).describe("Document title"),
      contentType: z.string().max(64).optional().describe("e.g. markdown, typescript, text, json"),
      metadata: z.record(z.string().max(MAX_TAG), z.unknown()).optional(),
    },
  },
  async (args: { content: string; title: string; contentType?: string; metadata?: Record<string, unknown> }) => {
    const res = await ingestText(args.content, args.title, {
      contentType: args.contentType,
      metadata: args.metadata,
    });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

reg(
  "knowledge_ingest_file",
  {
    description: "Read a file and store it as a knowledge document. Honours KB_ALLOWED_DIRS when set.",
    inputSchema: {
      path: z.string().min(1).max(MAX_PATH).describe("Absolute path to the file"),
      metadata: z.record(z.string().max(MAX_TAG), z.unknown()).optional(),
    },
  },
  async (args: { path: string; metadata?: Record<string, unknown> }) => {
    const res = await ingestFile(args.path, { metadata: args.metadata });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

reg(
  "knowledge_ingest_dir",
  {
    description: "Recursively ingest supported source files from a directory",
    inputSchema: {
      path: z.string().min(1).max(MAX_PATH).describe("Absolute path to the directory"),
      recursive: z.boolean().optional().default(true),
      extensions: z.array(z.string().min(1).max(16)).min(1).max(64).optional().describe("File extensions to include, e.g. ['.ts', '.md']"),
    },
  },
  async (args: { path: string; recursive?: boolean; extensions?: string[] }) => {
    const res = await ingestDirectory(args.path, { recursive: args.recursive, extensions: args.extensions });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Knowledge: search / retrieve                                              */
/* ------------------------------------------------------------------ */

reg(
  "knowledge_search",
  {
    description:
      "Hybrid semantic + keyword search over stored documents. Returns chunks ranked by relevance with scores. " +
      "Set explain to see per-leg scores (vector cosine, keyword BM25, RRF contribution) and diagnose ranking. " +
      "Optional alpha (0..1) tips the balance: 0 = keyword-only, 1 = vector-only, in between blends " +
      "'alpha * cosine + (1-alpha) * BM25'. Default uses Reciprocal Rank Fusion.",
    inputSchema: {
      query: z.string().min(1).max(MAX_QUERY),
      top_k: z.number().int().min(1).max(50).optional().default(10),
      min_score: z.number().min(0).max(1).optional().default(0.08),
      doc_id: z.string().max(MAX_ID).optional().describe("Only search within this document"),
      source: z.string().max(MAX_ID).optional().describe("Only search documents with this source (e.g. 'opencode-db', 'session-log')"),
      explain: z.boolean().optional().default(false).describe("Include per-leg vector/keyword/RRF scores on every hit"),
      alpha: z.number().min(0).max(1).optional().describe("Directional blend 0..1 (0 = keyword, 1 = vector); omit for default RRF hybrid"),
    },
  },
  async (args: { query: string; top_k?: number; min_score?: number; doc_id?: string; source?: string; explain?: boolean; alpha?: number }) => {
    const hits = await searchDocs(
      args.query,
      args.top_k ?? 10,
      args.min_score ?? 0.08,
      {
        docId: args.doc_id,
        source: args.source,
      },
      args.explain ?? false,
      args.alpha
    );
    return {
      content: [{ type: "text", text: JSON.stringify(hits, null, 2) }],
    };
  }
);

reg(
  "knowledge_retrieve",
  {
    description:
      "Retrieve relevant context chunks as a ready-to-inject context block for the LLM. Prefer this over knowledge_search when the result will be used as context.",
    inputSchema: {
      query: z.string().min(1).max(MAX_QUERY),
      top_k: z.number().int().min(1).max(20).optional().default(6),
      min_score: z.number().min(0).max(1).optional().default(0.08),
      doc_id: z.string().max(MAX_ID).optional().describe("Only retrieve within this document"),
      source: z.string().max(MAX_ID).optional().describe("Only retrieve documents with this source"),
    },
  },
  async (args: { query: string; top_k?: number; min_score?: number; doc_id?: string; source?: string }) => {
    const res = await retrieve(args.query, args.top_k ?? 6, args.min_score ?? 0.08, {
      docId: args.doc_id,
      source: args.source,
    });
    if (res.chunks.length === 0) {
      return { content: [{ type: "text", text: "No relevant context found." }] };
    }
    const lines = res.chunks.map((c) => `--- [${c.docTitle}#${c.chunkIndex}] (score ${c.score.toFixed(3)}) ---\n${c.content}`);
    return {
      content: [
        {
          type: "text",
          text: `[Context block: ${res.chunks.length} chunks, ~${res.totalTokens} tokens]\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

/* ------------------------------------------------------------------ */
/* Knowledge: document management                                            */
/* ------------------------------------------------------------------ */

reg(
  "knowledge_list_documents",
  {
    description: "List stored knowledge documents (newest first, paginated)",
    inputSchema: {
      limit: z.number().int().min(1).max(1000).optional().default(100).describe("Max documents to return"),
      offset: z.number().int().min(0).optional().default(0).describe("Skip this many documents"),
    },
  },
  async (args: { limit?: number; offset?: number }) => {
    const docs = listDocuments({ limit: args.limit, offset: args.offset });
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  }
);

reg(
  "knowledge_document_stats",
  {
    description: "Document storage statistics",
    inputSchema: {},
  },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(documentStats(), null, 2) }] };
  }
);

reg(
  "knowledge_delete_document",
  {
    description: "Delete a document and all its chunks by ID",
    inputSchema: {
      doc_id: z.string().min(1).max(MAX_ID),
    },
  },
  async (args: { doc_id: string }) => {
    const res = deleteDocument(args.doc_id);
    return { content: [{ type: "text", text: JSON.stringify(res) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Context Management: memory                                          */
/* ------------------------------------------------------------------ */

reg(
  "knowledge_sync_session",
  {
    description:
      "Ingest an opencode session's user inputs (or the latest active session) into the knowledge store as searchable documents. Use with the session id from opencode, or omit session_id and pass directory to auto-pick the most recent session in that workspace.",
    inputSchema: {
      session_id: z.string().min(1).max(MAX_ID).optional().describe("opencode session id; omit to use the latest active session"),
      directory: z.string().min(1).max(MAX_PATH).optional().describe("Workspace path used to pick the latest session when session_id is omitted (defaults to the server's working directory)"),
      limit: z.number().int().min(1).max(2000).optional().describe("Only ingest the first N user messages"),
    },
  },
  async (args: { session_id?: string; directory?: string; limit?: number }) => {
    const res = args.session_id
      ? await syncSession(args.session_id, { limit: args.limit })
      : await syncLatest({ limit: args.limit, directory: args.directory ?? process.cwd() });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

reg(
  "memory_remember",
  {
    description:
      "Store a piece of long-term memory (fact, decision, preference, instruction, task, insight, conversation). Use this to persist things that should be remembered across sessions.",
    inputSchema: {
      content: z.string().min(1).max(MAX_MEMORY_CONTENT).describe("The memory content, written as a self-contained statement"),
      type: z.enum(MEMORY_TYPES).optional().default("fact"),
      importance: z.number().min(0).max(1).optional().default(0.5).describe("0..1, higher = keep longer"),
      tags: z.array(z.string().max(MAX_TAG)).max(MAX_TAGS).optional().describe("Tags for filtering"),
    },
  },
  async (args: { content: string; type?: MemoryType; importance?: number; tags?: string[] }) => {
    const rec = await remember({
      content: args.content,
      type: args.type,
      importance: args.importance,
      tags: args.tags,
    });
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  }
);

reg(
  "memory_recall",
  {
    description: "Semantically search long-term memories relevant to a query. This is how you remember past context.",
    inputSchema: {
      query: z.string().min(1).max(MAX_QUERY),
      top_k: z.number().int().min(1).max(30).optional().default(8),
      min_score: z.number().min(0).max(1).optional().default(0.1),
    },
  },
  async (args: { query: string; top_k?: number; min_score?: number }) => {
    const hits = await recall(args.query, args.top_k ?? 8, args.min_score ?? 0.1);
    return { content: [{ type: "text", text: JSON.stringify(hits, null, 2) }] };
  }
);

reg(
  "memory_list",
  {
    description: "List memories, optionally filtered by type, tag, or minimum importance",
    inputSchema: {
      type: z.enum(MEMORY_TYPES).optional(),
      tag: z.string().max(MAX_TAG).optional(),
      min_importance: z.number().min(0).max(1).optional(),
      limit: z.number().int().min(1).max(500).optional().default(100),
    },
  },
  async (args: { type?: MemoryType; tag?: string; min_importance?: number; limit?: number }) => {
    const recs = listMemories({
      type: args.type,
      tag: args.tag,
      minImportance: args.min_importance,
      limit: args.limit,
    });
    return { content: [{ type: "text", text: JSON.stringify(recs, null, 2) }] };
  }
);

reg(
  "memory_get",
  {
    description: "Get a single memory by ID",
    inputSchema: {
      id: z.string().min(1).max(MAX_ID),
    },
  },
  async (args: { id: string }) => {
    const rec = getMemory(args.id);
    if (!rec) return { content: [{ type: "text", text: `No memory found with id ${args.id}` }] };
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  }
);

reg(
  "memory_update",
  {
    description: "Update content / type / importance / tags of an existing memory",
    inputSchema: {
      id: z.string().min(1).max(MAX_ID),
      content: z.string().max(MAX_MEMORY_CONTENT).optional(),
      type: z.enum(MEMORY_TYPES).optional(),
      importance: z.number().min(0).max(1).optional(),
      tags: z.array(z.string().max(MAX_TAG)).max(MAX_TAGS).optional(),
    },
  },
  async (args: { id: string; content?: string; type?: MemoryType; importance?: number; tags?: string[] }) => {
    // An all-undefined patch used to re-embed the text and bump updated_at,
    // silently reordering the store.
    if (args.content === undefined && args.type === undefined && args.importance === undefined && args.tags === undefined) {
      return { content: [{ type: "text", text: "Nothing to update: provide content, type, importance and/or tags." }] };
    }
    const rec = await updateMemory(args.id, {
      content: args.content,
      type: args.type,
      importance: args.importance,
      tags: args.tags,
    });
    if (!rec) return { content: [{ type: "text", text: `No memory found with id ${args.id}` }] };
    return { content: [{ type: "text", text: JSON.stringify(rec, null, 2) }] };
  }
);

reg(
  "memory_forget",
  {
    description: "Delete a memory by ID",
    inputSchema: {
      id: z.string().min(1).max(MAX_ID),
    },
  },
  async (args: { id: string }) => {
    const res = forget(args.id);
    return { content: [{ type: "text", text: JSON.stringify(res) }] };
  }
);

reg(
  "memory_consolidate",
  {
    description: "Deduplicate near-identical memories, boost frequently-used ones, and optionally prune stale memories (enable with env KB_PRUNE=1)",
    inputSchema: {},
  },
  async () => {
    const res = await consolidate();
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

reg(
  "memory_stats",
  {
    description: "Long-term memory statistics (count, tokens, importance, by type)",
    inputSchema: {},
  },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(memoryStats(), null, 2) }] };
  }
);

reg(
  "memory_context",
  {
    description: "Build a compact context block from the most relevant memories for a given topic. Best for injecting memory into prompts.",
    inputSchema: {
      topic: z.string().min(1).max(MAX_TOPIC),
      top_k: z.number().int().min(1).max(20).optional().default(6),
    },
  },
  async (args: { topic: string; top_k?: number }) => {
    const { context, sources } = await contextPrompt(args.topic, args.top_k ?? 6);
    if (!context) return { content: [{ type: "text", text: "No relevant memories found." }] };
    return {
      content: [
        {
          type: "text",
          text: `[Memory context: ${sources.length} sources]\n\n${context}`,
        },
      ],
    };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Provisioning                                                */
/* ------------------------------------------------------------------ */

reg(
  "bootstrap_session",
  { description: "Bootstrap a session: detect model, provision agent & skill, record state.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => {
    const model = detectModel({ env: process.env, projectRoot: args.project_root });
    const tier = tierOf(model);
    const md = modelDecision(model, "session_start", []);
    provision(agentPath(args.project_root), agentAutoBlock(), AGENT_VERSION);
    provision(skillPath(args.project_root), skillAutoBlock(), SKILL_VERSION);
    pt.initAgentsMd(args.project_root);
    if (process.env.CORTEX_AUTO_CONSOLIDATE === "1") {
      try {
        const { consolidate } = await import("../memory/memory.js");
        await consolidate();
      } catch { /* opt-in consolidation must not break bootstrap */ }
    }
    return { content: [{ type: "text", text: JSON.stringify({ model, tier, decision: md, provisioned: true }) }] };
  }
);

reg(
  "provision_agent_skill",
  { description: "Provision or append agent & skill files (idempotent).", inputSchema: { project_root: z.string().min(1).max(MAX_PATH), force_version: z.string().optional() } },
  async (args: { project_root: string; force_version?: string }) => {
    const v = args.force_version ?? AGENT_VERSION;
    const a = provision(agentPath(args.project_root), agentAutoBlock(), v);
    const s = provision(skillPath(args.project_root), skillAutoBlock(), v);
    return { content: [{ type: "text", text: JSON.stringify({ agent: a, skill: s }) }] };
  }
);

reg(
  "list_agents_skills",
  { description: "List agent & skill files and their auto-block versions.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => {
    const { listBlocks } = await import("../provisioner/marker-block.js");
    const a = listBlocks(agentPath(args.project_root));
    const s = listBlocks(skillPath(args.project_root));
    return { content: [{ type: "text", text: JSON.stringify({ agent: a, skill: s }) }] };
  }
);

reg(
  "update_procedure_block",
  { description: "Update the auto block in agent & skill files with a new version.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH), version: z.string().min(1) } },
  async (args: { project_root: string; version: string }) => {
    const a = provision(agentPath(args.project_root), agentAutoBlock(), args.version);
    const s = provision(skillPath(args.project_root), skillAutoBlock(), args.version);
    return { content: [{ type: "text", text: JSON.stringify({ agent: a, skill: s }) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Model                                                      */
/* ------------------------------------------------------------------ */

reg(
  "detect_model",
  { description: "Detect the model in use from env/config/arg.", inputSchema: { model: z.string().optional(), project_root: z.string().max(MAX_PATH).optional() } },
  async (args: { model?: string; project_root?: string }) => {
    const m = detectModel({ arg: args.model, env: process.env, projectRoot: args.project_root });
    return { content: [{ type: "text", text: JSON.stringify({ model: m, tier: tierOf(m) }) }] };
  }
);

reg(
  "get_model_profile",
  { description: "Get model profile (tier, capabilities).", inputSchema: { model: z.string().min(1) } },
  async (args: { model: string }) => {
    return { content: [{ type: "text", text: JSON.stringify({ model: args.model, tier: tierOf(args.model), capabilities: {} }) }] };
  }
);

reg(
  "set_model",
  { description: "Override the model for this session (env-level hint).", inputSchema: { model: z.string().min(1) } },
  async (args: { model: string }) => {
    process.env.CORTEX_MODEL = args.model;
    return { content: [{ type: "text", text: JSON.stringify({ model: args.model, tier: tierOf(args.model) }) }] };
  }
);

reg(
  "get_guardrails",
  { description: "Get procedure guardrails (anti-blunder) for a task/model.", inputSchema: { task: z.string().min(1), model: z.string().optional(), project_root: z.string().max(MAX_PATH).optional() } },
  async (args: { task: string; model?: string; project_root?: string }) => {
    const m = args.model ?? detectModel({ env: process.env, projectRoot: args.project_root });
    return { content: [{ type: "text", text: getGuardrails(m, args.task) }] };
  }
);

reg(
  "model_decision",
  { description: "Internal model decision: tier/risk/route/needsVerify.", inputSchema: { model: z.string().optional(), task: z.string().min(1), files: z.array(z.string()).optional(), project_root: z.string().max(MAX_PATH).optional() } },
  async (args: { model?: string; task: string; files?: string[]; project_root?: string }) => {
    const m = args.model ?? detectModel({ env: process.env, projectRoot: args.project_root });
    return { content: [{ type: "text", text: JSON.stringify(modelDecision(m, args.task, args.files ?? [])) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Procedure / Knowledge extras                               */
/* ------------------------------------------------------------------ */

reg(
  "get_procedure",
  { description: "Get a procedure by name.", inputSchema: { name: z.string().min(1) } },
  async (args: { name: string }) => {
    const p = getProcedure(args.name);
    return { content: [{ type: "text", text: p ? JSON.stringify(p) : "Not found." }] };
  }
);

reg(
  "list_procedures",
  { description: "List all procedures.", inputSchema: {} },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(listProcedures()) }] };
  }
);

reg(
  "ingest_procedure",
  { description: "Ingest a new procedure.", inputSchema: { name: z.string().min(1), version: z.string().min(1), content: z.string().min(1), tags: z.array(z.string()).optional() } },
  async (args: { name: string; version: string; content: string; tags?: string[] }) => {
    const r = ingestProcedure(args.name, args.version, args.content, args.tags ?? []);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  }
);

reg(
  "retrieve_exemplars",
  { description: "Retrieve best exemplars for a task (optionally filtered by task_type).", inputSchema: { task: z.string().min(1), top_k: z.number().int().min(1).max(20).optional().default(5), task_type: z.string().min(1).max(MAX_TAG).optional() } },
  async (args: { task: string; top_k?: number; task_type?: string }) => {
    const r = await retrieveExemplars(args.task, args.top_k ?? 5, args.task_type);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  }
);

reg(
  "ingest_exemplar",
  { description: "Ingest a high-quality exemplar.", inputSchema: { task_type: z.string().min(1), language: z.string().min(1), title: z.string().min(1), content: z.string().min(1), outcome: z.string().min(1) } },
  async (args: { task_type: string; language: string; title: string; content: string; outcome: string }) => {
    const r = await ingestExemplar(args.task_type, args.language, args.title, args.content, args.outcome);
    return { content: [{ type: "text", text: JSON.stringify(r) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Cognitive                                                  */
/* ------------------------------------------------------------------ */

reg(
  "self_critique",
  { description: "Structured self-critique (weighted checklist + scoring + severity + verdict) without LLM.", inputSchema: { artifact: z.string().min(1), tier: z.enum(["weak", "medium", "strong"]).optional() } },
  async (args: { artifact: string; tier?: "weak" | "medium" | "strong" }) => {
    return { content: [{ type: "text", text: JSON.stringify(selfCritique(args.artifact, { tier: args.tier })) }] };
  }
);

reg(
  "score_compliance",
  { description: "Score procedure compliance of a plan/diff.", inputSchema: { plan: z.string().min(1) } },
  async (args: { plan: string }) => {
    return { content: [{ type: "text", text: JSON.stringify(scoreCompliance(args.plan)) }] };
  }
);

reg(
  "run_verification",
  { description: "Run allowlisted verification commands (test/lint/typecheck).", inputSchema: { commands: z.array(z.string()).optional(), cwd: z.string().optional(), timeout_ms: z.number().int().min(1000).max(600000).optional() } },
  async (args: { commands?: string[]; cwd?: string; timeout_ms?: number }) => {
    const allow = (process.env.CORTEX_VERIFY_ALLOWLIST ?? "npm test,npm run lint,npm run typecheck").split(",").map(s => s.trim()).filter(Boolean);
    const cmds = args.commands?.length ? args.commands.filter(c => allow.includes(c)) : allow;
    const cwd = args.cwd ?? process.env.CORTEX_VERIFY_CWD ?? process.cwd();
    const timeout = args.timeout_ms ?? Number(process.env.CORTEX_VERIFY_TIMEOUT_MS ?? 300000);
    const res = runVerification(cmds, cwd, timeout);
    return { content: [{ type: "text", text: JSON.stringify(res) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Decision                                                   */
/* ------------------------------------------------------------------ */

reg(
  "decision_classify",
  { description: "Internal decision classification (tier/risk/route/compliance).", inputSchema: { state: z.string().min(1), questions: z.any() } },
  async (args: { state: string; questions: any }) => {
    return { content: [{ type: "text", text: JSON.stringify(decisionClassify(args)) }] };
  }
);

reg(
  "decision_health",
  { description: "Health of the internal decision engine.", inputSchema: {} },
  async () => {
    return { content: [{ type: "text", text: JSON.stringify(decisionHealth()) }] };
  }
);

reg(
  "cognitive_status",
  { description: "Cognitive status summary for the current session.", inputSchema: { project_root: z.string().max(MAX_PATH).optional() } },
  async (args: { project_root?: string }) => {
    const model = detectModel({ env: process.env, projectRoot: args.project_root });
    const ts = (await import("../plantask/manager.js")).taskSummary();
    return { content: [{ type: "text", text: JSON.stringify({ model, tier: tierOf(model), status: "ok", tasks: ts }) }] };
  }
);

/* ------------------------------------------------------------------ */
/* Cortex: Plan & Task Management                                     */
/* ------------------------------------------------------------------ */

reg("init_plan", { description: "Initialize PLAN.md if missing (idempotent).", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.initPlan(args.project_root)) }] }));

reg("read_plan", { description: "Read PLAN.md content.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH), full: z.boolean().optional().default(true) } },
  async (args: { project_root: string; full?: boolean }) => ({ content: [{ type: "text", text: JSON.stringify(pt.readPlan(args.project_root, args.full ?? true)) }] }));

reg("update_plan_section", { description: "Update a PLAN.md section by heading.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH), heading: z.string().min(1), content: z.string() } },
  async (args: { project_root: string; heading: string; content: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.updatePlanSection(args.project_root, args.heading, args.content)) }] }));

reg("init_task", { description: "Initialize TASK.md if missing (idempotent).", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.initTask(args.project_root)) }] }));
reg("init_agents_md", { description: "Initialize AGENTS.md if missing (idempotent).", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.initAgentsMd(args.project_root)) }] }));

reg("task_create", { description: "Create a new task.", inputSchema: { title: z.string().min(1), plan_ref: z.string().optional(), priority: z.number().int().optional(), owner: z.string().optional() } },
  async (args: { title: string; plan_ref?: string; priority?: number; owner?: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskCreate(args.title, args.plan_ref, args.priority ?? 0, args.owner)) }] }));

reg("task_list", { description: "List tasks, optionally filtered by status/priority, with pagination.", inputSchema: { status: z.string().optional(), priority: z.number().int().optional(), limit: z.number().int().min(1).max(1000).optional(), offset: z.number().int().min(0).optional() } },
  async (args: { status?: string; priority?: number; limit?: number; offset?: number }) => {
    const filter = { status: args.status, priority: args.priority };
    const limit = args.limit ?? pt.TASK_LIST_DEFAULT;
    const items = pt.taskList({ ...filter, limit, offset: args.offset });
    return { content: [{ type: "text", text: JSON.stringify({ total: pt.taskCount(filter), limit, offset: args.offset ?? 0, items }) }] };
  });

reg("task_get", { description: "Get task by id.", inputSchema: { id: z.string().min(1) } },
  async (args: { id: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskGet(args.id)) }] }));

reg("task_start", { description: "Set task status to doing.", inputSchema: { id: z.string().min(1) } },
  async (args: { id: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskStart(args.id)) }] }));

reg("task_done", { description: "Set task status to done.", inputSchema: { id: z.string().min(1) } },
  async (args: { id: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskDone(args.id)) }] }));

reg("task_block", { description: "Set task status to blocked with reason.", inputSchema: { id: z.string().min(1), reason: z.string().min(1) } },
  async (args: { id: string; reason: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskBlock(args.id, args.reason)) }] }));

reg("task_delete", { description: "Delete a task.", inputSchema: { id: z.string().min(1) } },
  async (args: { id: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskDelete(args.id)) }] }));

reg("task_update", { description: "Update task title/priority/owner/plan_ref/notes.", inputSchema: { id: z.string().min(1), title: z.string().optional(), priority: z.number().int().optional(), owner: z.string().optional(), plan_ref: z.string().optional(), notes: z.string().optional() } },
  async (args: { id: string; title?: string; priority?: number; owner?: string; plan_ref?: string; notes?: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskUpdate(args.id, { title: args.title, priority: args.priority, owner: args.owner, plan_ref: args.plan_ref, notes: args.notes })) }] }));

reg("task_sync_md", { description: "Sync TASK.md from DB.", inputSchema: { project_root: z.string().min(1).max(MAX_PATH) } },
  async (args: { project_root: string }) => ({ content: [{ type: "text", text: JSON.stringify(pt.taskSyncMd(args.project_root)) }] }));

reg("task_summary", { description: "Summary of task statuses.", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: JSON.stringify(pt.taskSummary()) }] }));

/* ------------------------------------------------------------------ */

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`Cortex Intelligent MCP server running (db: ${path.resolve(STORAGE_DIR)})`);

/**
 * Close the SQLite handle before the process exits.
 *
 * SQLite in DELETE journal mode rolls back on an abrupt exit, so a hard kill is
 * safe, but it leaves the `-journal` file behind and skips any WAL checkpoint.
 * On a stdio MCP server the host closing the pipe is the normal way this
 * process dies, so an explicit shutdown keeps the store tidy and lets a WAL
 * database truncate instead of growing.
 *
 * Exit is forced after a grace period because the host may not respond to
 * `server.close()`, and a server that refuses to die is worse than one that
 * drops an unflushed log line.
 */
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`Cortex: ${signal} received, closing database.`);
  try {
    closeDB();
  } catch (err) {
    console.error(`Cortex: database close failed: ${String(err)}`);
  }
  void server.close().finally(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));