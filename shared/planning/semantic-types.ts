import type { Constraints, Scenario } from "./types.ts";

/** AI 语义抽取结果（不负责选店） */
export interface AiSemanticExtract {
  scenario: Scenario;
  departureHour: number;
  maxDistanceKm: number;
  durationHours: [number, number];
  childAge: number | null;
  partyTotal: number | null;
  lowCalPreferred: boolean;
  locationBlocks: string[];
  wantExtra: boolean;
  intentSummary: string;
}

export type SemanticResolver = (
  userText: string,
  location: { label?: string; address?: string },
) => Promise<{
  semantic: AiSemanticExtract;
  trace: import("./types.ts").ToolTraceEntry;
}>;
