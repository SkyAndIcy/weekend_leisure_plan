import { straightLineKm } from "../geo";
import type { PipelineStageLog, RankedCandidate } from "./types";

/**
 * 跨池联动：用景点 Top 锚点，对餐厅池做顺路加权（非线性的池间耦合）
 */
export function boostRestaurantsByPlayAnchors(
  plays: RankedCandidate[],
  restaurants: RankedCandidate[],
  anchorCount = 3,
): { boosted: RankedCandidate[]; stage: PipelineStageLog } {
  const anchors = plays.slice(0, anchorCount);
  if (!anchors.length) {
    return {
      boosted: restaurants,
      stage: {
        stage: "cross_link",
        nameZh: "跨池联动·玩锚点→吃加权",
        inputCount: restaurants.length,
        outputCount: restaurants.length,
        note: "无玩锚点，跳过",
      },
    };
  }

  const boosted = restaurants
    .map((r) => {
      let bonus = 0;
      for (const a of anchors) {
        const d = straightLineKm(a.poi.lat, a.poi.lng, r.poi.lat, r.poi.lng);
        if (d < 3) bonus += 14;
        else if (d < 5) bonus += 8;
        else if (d < 8) bonus += 3;
      }
      return bonus > 0
        ? { ...r, totalScore: r.totalScore + bonus * 0.35, dimensions: { ...r.dimensions } }
        : r;
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return {
    boosted,
    stage: {
      stage: "cross_link",
      nameZh: "跨池联动·玩锚点→吃加权",
      inputCount: restaurants.length,
      outputCount: boosted.length,
      note: `锚点 ${anchors.map((a) => a.poi.id).join(",")}，3/5/8km 梯度加分`,
      sampleIds: boosted.slice(0, 3).map((r) => r.poi.id),
    },
  };
}
