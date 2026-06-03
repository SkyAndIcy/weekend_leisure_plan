import type { Constraints, Poi, Scenario } from "../types";

/** 流水线各阶段审计日志 */
export interface PipelineStageLog {
  stage: string;
  nameZh: string;
  inputCount: number;
  outputCount: number;
  dropped?: Record<string, number>;
  sampleIds?: string[];
  note?: string;
}

/** 合并 AI 语义后的有效约束（含硬/软拆分） */
export interface EffectiveConstraints extends Constraints {
  wantExtra: boolean;
  /** 硬约束：超出则直接剔除 */
  hardMaxDistanceKm: number;
  /** 软约束：商圈偏好，仅加分不剔除 */
  softLocationBlocks: string[];
  /** 全程时间预算（分钟） */
  timeBudgetMin: { min: number; max: number };
  intentSummary: string;
}

/** 多维度打分明细 */
export interface DimensionScores {
  relevance: number;
  distance: number;
  feasibility: number;
  areaMatch: number;
}

export interface RankedCandidate {
  poi: Poi;
  totalScore: number;
  distanceKm: number;
  dimensions: DimensionScores;
}

export interface ComboCandidate {
  play: RankedCandidate;
  eat: RankedCandidate;
  extra: RankedCandidate | null;
  comboScore: number;
  routeKm: number;
  timeTotalMin: number;
  breakdown: {
    playScore: number;
    eatScore: number;
    extraScore: number;
    routePenalty: number;
    timePenalty: number;
    diversityBonus: number;
  };
}

export interface RecallPools {
  attraction: RankedCandidate[];
  restaurant: RankedCandidate[];
  extra: RankedCandidate[];
}

/** 场景门槛：须 ≤ relevanceGateScore 可达上限（主标签 family_child / friends_social 为 28） */
export const SCENARIO_MIN_RELEVANCE: Record<Scenario, number> = {
  family: 25,
  friends: 25,
  unknown: 12,
};

export type ComboFailReason = "empty_pool" | "time_overflow";

export type DagNodeKind = "并行分叉" | "汇聚" | "任务" | "条件分支" | "反馈环";

export interface DagEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DagNodeLog extends PipelineStageLog {
  nodeId: string;
  kind: DagNodeKind;
  deps: string[];
  status: "完成" | "跳过" | "重试";
}

export interface DagRunResult {
  effective: EffectiveConstraints;
  pools: RecallPools;
  combo: ComboCandidate;
  graphTrace: DagNodeLog[];
  edges: DagEdge[];
  retryCount: number;
}
