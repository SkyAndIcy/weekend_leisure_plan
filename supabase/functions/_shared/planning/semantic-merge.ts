import type { Constraints, Scenario } from "./types.ts";
import type { AiSemanticExtract } from "./semantic-types.ts";

function asScenario(v: unknown): Scenario {
  return v === "friends" ? "friends" : v === "family" ? "family" : "unknown";
}

function parseDuration(v: unknown): [number, number] {
  if (Array.isArray(v) && v.length >= 2) {
    const a = Number(v[0]);
    const b = Number(v[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return [Math.min(a, b), Math.max(a, b)];
    }
  }
  return [4, 6];
}

function parseLocationBlocks(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(String).filter(Boolean))];
}

export function parseAiSemantic(raw: Record<string, unknown>): AiSemanticExtract | null {
  const scenario = asScenario(raw.scenario);
  const departureHour =
    typeof raw.departureHour === "number" && raw.departureHour >= 0 && raw.departureHour <= 23
      ? raw.departureHour
      : null;
  const maxDistanceKm =
    typeof raw.maxDistanceKm === "number" && raw.maxDistanceKm > 0 ? raw.maxDistanceKm : null;
  if (departureHour === null || maxDistanceKm === null) return null;

  return {
    scenario,
    departureHour,
    maxDistanceKm,
    durationHours: parseDuration(raw.durationHours),
    childAge: typeof raw.childAge === "number" ? raw.childAge : null,
    partyTotal: typeof raw.partyTotal === "number" ? raw.partyTotal : null,
    lowCalPreferred: Boolean(raw.lowCalPreferred),
    locationBlocks: parseLocationBlocks(raw.locationBlocks),
    wantExtra: raw.wantExtra !== false,
    intentSummary: String(raw.intentSummary ?? raw.rationale ?? "").trim(),
  };
}

/** 将 AI 语义合并进规则 baseline */
export function mergeConstraints(base: Constraints, ai: AiSemanticExtract): Constraints {
  const blocks = [...base.locationBlocks];
  for (const b of ai.locationBlocks) {
    if (!blocks.includes(b)) blocks.push(b);
  }
  return {
    ...base,
    scenario: ai.scenario !== "unknown" ? ai.scenario : base.scenario,
    departureHour: ai.departureHour,
    maxDistanceKm: ai.maxDistanceKm,
    durationHours: ai.durationHours,
    childAge: ai.childAge ?? base.childAge,
    partyTotal: ai.partyTotal ?? base.partyTotal,
    lowCalPreferred: ai.lowCalPreferred || base.lowCalPreferred,
    locationBlocks: blocks,
  };
}
