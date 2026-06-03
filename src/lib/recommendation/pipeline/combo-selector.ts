import type {
  ComboCandidate,
  ComboFailReason,
  EffectiveConstraints,
  PipelineStageLog,
  RankedCandidate,
} from "./types";

const TRANSIT_PLAY_EAT = 20;
const TRANSIT_EAT_EXTRA = 15;
const MAX_PLAY = 6;
const MAX_EAT = 6;
const MAX_EXTRA = 4;

function routeKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function timePenalty(totalMin: number, budget: { min: number; max: number }): number {
  if (totalMin < budget.min) return (budget.min - totalMin) * 0.15;
  if (totalMin > budget.max) return (totalMin - budget.max) * 0.35;
  return 0;
}

function diversityBonus(
  play: { area: string },
  eat: { area: string },
  extra: { area: string } | null,
): number {
  const areas = new Set([play.area, eat.area]);
  if (extra) areas.add(extra.area);
  if (areas.size >= 3) return 6;
  if (areas.size === 2) return 3;
  return 0;
}

export function scoreCombo(
  play: RankedCandidate,
  eat: RankedCandidate,
  extra: RankedCandidate | null,
  c: EffectiveConstraints,
): ComboCandidate {
  const leg1 = routeKm(play.poi, eat.poi);
  const leg2 = extra ? routeKm(eat.poi, extra.poi) : 0;
  const routePenalty = leg1 * 2.8 + leg2 * 2.2;

  const timeTotalMin =
    play.poi.durationMin +
    TRANSIT_PLAY_EAT +
    eat.poi.durationMin +
    (extra ? TRANSIT_EAT_EXTRA + extra.poi.durationMin : 0);

  const tPen = timePenalty(timeTotalMin, c.timeBudgetMin);
  const divBonus = diversityBonus(play.poi, eat.poi, extra?.poi ?? null);

  const comboScore =
    play.totalScore * 0.42 +
    eat.totalScore * 0.38 +
    (extra ? extra.totalScore * 0.12 : 0) -
    routePenalty * 0.08 -
    tPen +
    divBonus;

  return {
    play,
    eat,
    extra,
    comboScore,
    routeKm: leg1 + leg2,
    timeTotalMin,
    breakdown: {
      playScore: play.totalScore,
      eatScore: eat.totalScore,
      extraScore: extra?.totalScore ?? 0,
      routePenalty,
      timePenalty: tPen,
      diversityBonus: divBonus,
    },
  };
}

/**
 * 联合行程优选：景点×餐厅×加项 笛卡尔组合打分，取最优；满座护栏换餐厅
 */
export function evaluateComboRound(
  pools: {
    attraction: RankedCandidate[];
    restaurant: RankedCandidate[];
    extra: RankedCandidate[];
  },
  c: EffectiveConstraints,
): {
  combo: ComboCandidate | null;
  combos: ComboCandidate[];
  failReason?: ComboFailReason;
  stages: PipelineStageLog[];
} {
  const plays = pools.attraction.slice(0, MAX_PLAY);
  const eats = pools.restaurant.slice(0, MAX_EAT);
  const extras = c.wantExtra ? pools.extra.slice(0, MAX_EXTRA) : [];

  if (!plays.length || !eats.length) {
    return {
      combo: null,
      combos: [],
      failReason: "empty_pool",
      stages: [
        {
          stage: "combo_search",
          nameZh: "组合搜索",
          inputCount: 0,
          outputCount: 0,
          note: "玩池或吃池为空",
        },
      ],
    };
  }

  const combos: ComboCandidate[] = [];
  for (const play of plays) {
    for (const eat of eats) {
      if (c.wantExtra && extras.length > 0) {
        for (const ex of extras) {
          if (ex.poi.id === play.poi.id) continue;
          combos.push(scoreCombo(play, eat, ex, c));
        }
        combos.push(scoreCombo(play, eat, null, c));
      } else {
        combos.push(scoreCombo(play, eat, null, c));
      }
    }
  }

  combos.sort((a, b) => b.comboScore - a.comboScore);
  let best = combos[0] ?? null;

  let failReason: ComboFailReason | undefined;
  if (best && best.breakdown.timePenalty > 25) {
    failReason = "time_overflow";
  }

  const stages: PipelineStageLog[] = [
    {
      stage: "combo_search",
      nameZh: "联合行程组合搜索",
      inputCount: plays.length * eats.length * Math.max(extras.length || 1, 1),
      outputCount: combos.length,
      note: `候选 ${plays.length}玩×${eats.length}吃${c.wantExtra ? `×${extras.length}加项` : ""}，共 ${combos.length} 组`,
    },
  ];

  return { combo: best, combos, failReason, stages };
}

/** 满座护栏 + 最终选定 */
export function finalizeCombo(
  round: ReturnType<typeof evaluateComboRound>,
  eats: RankedCandidate[],
  c: EffectiveConstraints,
): { combo: ComboCandidate; stages: PipelineStageLog[] } {
  let best = round.combo;
  if (!best) {
    throw new Error("召回池为空，无法生成行程组合");
  }

  if (best.eat.poi.tablesLeft === 0) {
    const altEat = eats.find((e) => e.poi.tablesLeft !== 0 && e.poi.id !== best!.play.poi.id);
    if (altEat) {
      best = scoreCombo(best.play, altEat, best.extra, c);
    }
  }

  const stages = [
    ...round.stages,
    {
      stage: "combo_pick",
      nameZh: "最优组合选定",
      inputCount: round.combos.length,
      outputCount: 1,
      sampleIds: [best.play.poi.id, best.eat.poi.id, best.extra?.poi.id].filter(Boolean) as string[],
      note: `得分 ${best.comboScore.toFixed(1)}，路程 ${best.routeKm.toFixed(1)}km，耗时 ${best.timeTotalMin}min`,
    },
  ];

  return { combo: best, stages };
}
