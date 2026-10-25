import { getDB } from "../db/database.js";
import { tierOf } from "./resolver.js";

export type ModelTier = "weak" | "medium" | "strong";

export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  tier: ModelTier;
  capabilities: string[];
  blunderPatterns: string[];
  updatedAt: number;
}

function safeJson(raw: unknown, fallback: unknown): unknown {
  if (raw === null || raw === undefined) return fallback;
  try {
    const v = JSON.parse(String(raw));
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

const TIER_CAPS: Record<ModelTier, string[]> = {
  weak: ["basic"],
  medium: ["code", "tools"],
  strong: ["code", "tools", "long_context"],
};

const TIER_BLUNDERS: Record<ModelTier, string[]> = {
  weak: ["edit without read", "skip tests"],
  medium: ["skip verification"],
  strong: [],
};

/**
 * Look up (or synthesize + seed) a model profile. The store is the source of
 * truth; when no row exists we compute a heuristic profile from the model name
 * and persist it so later calls are stable and the table stays populated.
 */
export function getModelProfile(model: string): ModelProfile {
  const db = getDB();
  const row = db
    .prepare("SELECT id, provider, model, tier, capabilities, blunder_patterns, updated_at FROM model_profiles WHERE model = ? LIMIT 1")
    .get(model) as
    | {
        id: string;
        provider: string | null;
        model: string | null;
        tier: string | null;
        capabilities: string | null;
        blunder_patterns: string | null;
        updated_at: number | null;
      }
    | undefined;

  if (row) {
    const tier = (row.tier === "weak" || row.tier === "medium" || row.tier === "strong" ? row.tier : tierOf(row.model ?? model)) as ModelTier;
    return {
      id: row.id,
      provider: row.provider ?? "",
      model: row.model ?? model,
      tier,
      capabilities: (safeJson(row.capabilities, TIER_CAPS[tier]) as string[]) ?? TIER_CAPS[tier],
      blunderPatterns: (safeJson(row.blunder_patterns, TIER_BLUNDERS[tier]) as string[]) ?? TIER_BLUNDERS[tier],
      updatedAt: row.updated_at ?? 0,
    };
  }

  const tier = tierOf(model) as ModelTier;
  const caps = TIER_CAPS[tier];
  const blunders = TIER_BLUNDERS[tier];
  const id = `auto:${model}`.slice(0, 200);
  try {
    db.prepare(
      "INSERT OR IGNORE INTO model_profiles (id, provider, model, tier, capabilities, blunder_patterns, updated_at) VALUES (?,?,?,?,?,?,?)"
    ).run(id, "auto", model, tier, JSON.stringify(caps), JSON.stringify(blunders), Date.now());
  } catch {
    /* seed failure must not break the call */
  }
  return { id, provider: "auto", model, tier, capabilities: caps, blunderPatterns: blunders, updatedAt: Date.now() };
}

export function listModelProfiles(): ModelProfile[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT id, provider, model, tier, capabilities, blunder_patterns, updated_at FROM model_profiles ORDER BY updated_at DESC")
    .all() as Array<{
    id: string;
    provider: string | null;
    model: string | null;
    tier: string | null;
    capabilities: string | null;
    blunder_patterns: string | null;
    updated_at: number | null;
  }>;
  return rows.map((r) => {
    const tier = (r.tier === "weak" || r.tier === "medium" || r.tier === "strong" ? r.tier : "medium") as ModelTier;
    return {
      id: r.id,
      provider: r.provider ?? "",
      model: r.model ?? "",
      tier,
      capabilities: (safeJson(r.capabilities, TIER_CAPS[tier]) as string[]) ?? TIER_CAPS[tier],
      blunderPatterns: (safeJson(r.blunder_patterns, TIER_BLUNDERS[tier]) as string[]) ?? TIER_BLUNDERS[tier],
      updatedAt: r.updated_at ?? 0,
    };
  });
}