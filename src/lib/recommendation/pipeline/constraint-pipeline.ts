import type { AiSemanticExtract } from "../ai-semantic";
import { mergeConstraints } from "../ai-semantic";
import type { Constraints } from "../types";
import type { EffectiveConstraints, PipelineStageLog } from "./types";

/** 规则与 AI 冲突时的裁决（记录到 trace，不静默覆盖用户显式「别太远」） */
function resolveDistanceConflict(
  ruleKm: number,
  aiKm: number,
  rawGoal: string,
): { km: number; note?: string } {
  const userWantsNear = /别太远|不远|附近|就近|离家近/.test(rawGoal);
  if (userWantsNear && aiKm > ruleKm) {
    return { km: ruleKm, note: "用户强调就近，采用更紧的硬距离上限" };
  }
  return { km: aiKm };
}

/**
 * 阶段 0：约束融合与硬/软拆分
 */
export function buildEffectiveConstraints(
  ruleBase: Constraints,
  semantic: AiSemanticExtract,
): { effective: EffectiveConstraints; stages: PipelineStageLog[] } {
  const merged = mergeConstraints(ruleBase, semantic);
  const dist = resolveDistanceConflict(
    ruleBase.maxDistanceKm,
    semantic.maxDistanceKm,
    merged.rawGoal,
  );

  const [hMin, hMax] = semantic.durationHours;
  const timeBudgetMin = {
    min: hMin * 60,
    max: hMax * 60,
  };

  const effective: EffectiveConstraints = {
    ...merged,
    maxDistanceKm: dist.km,
    hardMaxDistanceKm: dist.km,
    softLocationBlocks: [...merged.locationBlocks],
    wantExtra: semantic.wantExtra,
    timeBudgetMin,
    intentSummary: semantic.intentSummary,
  };

  const stages: PipelineStageLog[] = [
    {
      stage: "constraint_merge",
      nameZh: "约束融合（规则 baseline + AI 语义）",
      inputCount: 2,
      outputCount: 1,
      note: dist.note ?? `硬距离 ${effective.hardMaxDistanceKm}km，时间 ${hMin}-${hMax}h，加项=${effective.wantExtra}`,
    },
    {
      stage: "constraint_split",
      nameZh: "硬/软约束拆分",
      inputCount: 1,
      outputCount: 1,
      note: `硬：距离≤${effective.hardMaxDistanceKm}km；软：商圈[${effective.softLocationBlocks.join("、") || "无"}]`,
    },
  ];

  return { effective, stages };
}
