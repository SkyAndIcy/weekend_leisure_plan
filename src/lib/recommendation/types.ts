export type Scenario = "family" | "friends" | "unknown";

export type PoiCategory = "attraction" | "restaurant" | "extra";

export interface Constraints {
  rawGoal: string;
  scenario: Scenario;
  departureHour: number;
  durationHours: [number, number];
  maxDistanceKm: number;
  childAge: number | null;
  partyTotal: number | null;
  lowCalPreferred: boolean;
  locationBlocks: string[];
}

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  district: string;
  area: string;
  tags: string[];
  avgPrice: number;
  durationMin: number;
  description: string;
  /** Mock: tables left; -1 = walk-in only */
  tablesLeft: number;
  queueMin: number;
}

export interface TimelineSlot {
  start: string;
  end: string;
  phase: "play" | "eat" | "extra";
  poi: Poi;
  notes: string;
}

export interface MockBooking {
  type: "hold_table" | "preorder" | "notify";
  placeId: string;
  placeName: string;
  status: "ok" | "queued" | "pending";
  detail: string;
}

export interface ToolTraceEntry {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface WeekendPlan {
  summary: string;
  scenario: Scenario;
  homeLabel: string;
  homeLat: number;
  homeLng: number;
  constraints: Constraints;
  timeline: TimelineSlot[];
  bookings: MockBooking[];
  toolTrace: ToolTraceEntry[];
  notifyText: string;
  recalledCount: { attraction: number; restaurant: number; extra: number };
  /** AI 语义 + DAG 编排（并行/分支/反馈环）+ 联合组合优选 */
  recommendMode: "semantic+dag-recall+combo";
  aiRationale?: string;
  /** DAG 节点执行日志 */
  pipelineTrace?: { stage: string; nameZh: string; inputCount: number; outputCount: number; note?: string }[];
  /** DAG 有向边（非线性拓扑） */
  dagEdges?: { from: string; to: string; label?: string }[];
  /** 最终选中组合的多目标得分拆解 */
  comboBreakdown?: Record<string, number>;
}

export interface HomeAnchor {
  label: string;
  lat: number;
  lng: number;
}
