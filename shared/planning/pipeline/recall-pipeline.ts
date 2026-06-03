import type { Poi } from "../types.ts";
import { straightLineKm } from "../geo.ts";
import { rankWithDimensions, relevanceGateScore } from "./rank-dimensions";
import type { EffectiveConstraints, PipelineStageLog, RankedCandidate, RecallPools } from "./types";
import { SCENARIO_MIN_RELEVANCE } from "./types";

const MMR_TOP_K = 8;
const GEO_BUFFER_KM = 2;
const CITYWIDE_FALLBACK_K = 12;

function pushStage(
  stages: PipelineStageLog[],
  log: PipelineStageLog,
  pool: RankedCandidate[],
) {
  stages.push({
    ...log,
    sampleIds: pool.slice(0, 5).map((r) => r.poi.id),
  });
}

/** 阶段 1：地理围栏粗召回 */
function stageGeoFilter(
  pois: Poi[],
  homeLat: number,
  homeLng: number,
  hardMax: number,
): { kept: Poi[]; dropped: Record<string, number> } {
  const dropped: Record<string, number> = { 超出地理围栏: 0 };
  const limit = hardMax + GEO_BUFFER_KM;
  const kept = pois.filter((p) => {
    const d = straightLineKm(homeLat, homeLng, p.lat, p.lng);
    if (d > limit) {
      dropped["超出地理围栏"]++;
      return false;
    }
    return true;
  });
  return { kept, dropped };
}

/** 围栏内无候选时：取全城直线距离最近的 POI（保证北京任意出发点可出方案） */
function stageCitywideNearest(
  pool: Poi[],
  homeLat: number,
  homeLng: number,
  k: number,
): Poi[] {
  return [...pool]
    .map((p) => ({ p, d: straightLineKm(homeLat, homeLng, p.lat, p.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.p);
}

/** 阶段 2：场景意图门槛（弱相关剔除） */
function stageScenarioGate(
  pois: Poi[],
  c: EffectiveConstraints,
): { kept: Poi[]; dropped: Record<string, number> } {
  const minRel = SCENARIO_MIN_RELEVANCE[c.scenario];
  const dropped: Record<string, number> = { 场景相关性不足: 0 };
  const kept = pois.filter((p) => {
    const rel = relevanceGateScore(p, c.scenario);
    if (rel < minRel && p.category !== "extra") {
      dropped["场景相关性不足"]++;
      return false;
    }
    return true;
  });
  return { kept, dropped };
}

/**
 * 阶段 4：MMR 多样性截断 — 在高分候选中打散商圈，避免 TopK 全在同一 area
 */
function stageMmrTruncate(
  ranked: RankedCandidate[],
  k: number,
): RankedCandidate[] {
  if (ranked.length <= k) return ranked;
  const selected: RankedCandidate[] = [];
  const lambda = 0.72;
  const remaining = [...ranked];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let maxSim = 0;
      for (const s of selected) {
        const sameArea = s.poi.area === cand.poi.area ? 1 : 0;
        const sameDistrict = s.poi.district === cand.poi.district ? 0.5 : 0;
        maxSim = Math.max(maxSim, sameArea + sameDistrict);
      }
      const mmr = lambda * cand.totalScore - (1 - lambda) * maxSim * 20;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

function runPoolRecall(
  pool: Poi[],
  homeLat: number,
  homeLng: number,
  c: EffectiveConstraints,
  poolName: string,
): { candidates: RankedCandidate[]; stages: PipelineStageLog[] } {
  const stages: PipelineStageLog[] = [];

  const geo = stageGeoFilter(pool, homeLat, homeLng, c.hardMaxDistanceKm);
  let geoKept = geo.kept;
  let geoNote = "";
  if (geoKept.length === 0 && pool.length > 0) {
    geoKept = stageCitywideNearest(pool, homeLat, homeLng, CITYWIDE_FALLBACK_K);
    geoNote = "围栏内无候选，已用全城最近门店兜底";
  }
  pushStage(stages, {
    stage: `${poolName}_geo`,
    nameZh: `${poolName}·地理围栏召回`,
    inputCount: pool.length,
    outputCount: geoKept.length,
    dropped: geo.dropped,
    note: geoNote || undefined,
  }, []);

  const gateResult = stageScenarioGate(geoKept, c);
  let gateKept = gateResult.kept;
  if (gateKept.length === 0 && geoKept.length > 0) {
    gateKept = geoKept;
  }
  const gate = { kept: gateKept, dropped: gateResult.dropped };
  pushStage(stages, {
    stage: `${poolName}_scenario`,
    nameZh: `${poolName}·场景意图过滤`,
    inputCount: geo.kept.length,
    outputCount: gate.kept.length,
    dropped: gate.dropped,
    note: `门槛分≥${SCENARIO_MIN_RELEVANCE[c.scenario]}`,
  }, []);

  const ranked = rankWithDimensions(gate.kept, homeLat, homeLng, c);
  pushStage(stages, {
    stage: `${poolName}_rank`,
    nameZh: `${poolName}·多目标精排`,
    inputCount: gate.kept.length,
    outputCount: ranked.length,
    note: "相关0.35+距离0.3+履约0.2+商圈0.15",
  }, ranked);

  const mmr = stageMmrTruncate(ranked, MMR_TOP_K);
  pushStage(stages, {
    stage: `${poolName}_mmr`,
    nameZh: `${poolName}·MMR多样性截断`,
    inputCount: ranked.length,
    outputCount: mmr.length,
    note: `Top ${MMR_TOP_K}，λ=0.72`,
  }, mmr);

  return { candidates: mmr, stages };
}

/** 三池并行召回（DAG 汇聚前） */
export async function runParallelPoolRecall(
  attractions: Poi[],
  restaurants: Poi[],
  extras: Poi[],
  homeLat: number,
  homeLng: number,
  c: EffectiveConstraints,
  includeExtra: boolean,
): Promise<Pick<RecallPools, "attraction" | "restaurant" | "extra"> & { stages: PipelineStageLog[] }> {
  const [attr, rest, ext] = await Promise.all([
    Promise.resolve(runPoolRecall(attractions, homeLat, homeLng, c, "景点")),
    Promise.resolve(runPoolRecall(restaurants, homeLat, homeLng, c, "餐厅")),
    includeExtra
      ? Promise.resolve(runPoolRecall(extras, homeLat, homeLng, c, "加项"))
      : Promise.resolve({ candidates: [] as RankedCandidate[], stages: [] as PipelineStageLog[] }),
  ]);

  return {
    attraction: attr.candidates,
    restaurant: rest.candidates,
    extra: ext.candidates,
    stages: [...attr.stages, ...rest.stages, ...ext.stages],
  };
}

