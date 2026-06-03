import type { Constraints, Poi, Scenario } from "../types";
import { straightLineKm } from "../geo";
import type { DimensionScores, RankedCandidate } from "./types";

function scenarioRelevance(scenario: Scenario, tags: string[]): number {
  if (scenario === "family") {
    if (tags.includes("family_child")) return 28;
    if (tags.includes("family_diet")) return 18;
    if (tags.includes("outdoor")) return 10;
    if (tags.includes("low_cal")) return 8;
    return 4;
  }
  if (scenario === "friends") {
    if (tags.includes("friends_social")) return 28;
    if (tags.includes("exhibition") || tags.includes("citywalk")) return 16;
    if (tags.includes("share_plates")) return 12;
    return 4;
  }
  return 8;
}

function areaMatchScore(poi: Poi, blocks: string[]): number {
  if (!blocks.length) return 0;
  return blocks.some((b) => poi.area.includes(b) || poi.district.includes(b)) ? 18 : 0;
}

function feasibilityScore(poi: Poi): number {
  if (poi.category !== "restaurant") return 12;
  let s = 12;
  if (poi.tablesLeft === 0) s -= 30;
  else if (poi.tablesLeft > 0) s += 10;
  if (poi.queueMin > 30) s -= 12;
  else if (poi.queueMin > 0) s -= 4;
  return s;
}

function distanceScore(km: number, hardMax: number): number {
  let s = 100 - km * 4;
  if (km > hardMax) s -= 80;
  else if (km > hardMax * 0.85) s -= 12;
  return s;
}

export function rankWithDimensions(
  pois: Poi[],
  homeLat: number,
  homeLng: number,
  c: Constraints & { hardMaxDistanceKm: number },
): RankedCandidate[] {
  return pois
    .map((poi) => {
      const distanceKm = straightLineKm(homeLat, homeLng, poi.lat, poi.lng);
      const dimensions: DimensionScores = {
        relevance:
          scenarioRelevance(c.scenario, poi.tags) +
          (c.lowCalPreferred && poi.tags.includes("low_cal") ? 15 : 0) +
          (c.childAge !== null && c.childAge <= 6 && poi.tags.includes("family_child") ? 10 : 0) +
          (c.scenario === "family" && poi.tags.includes("kids_menu") ? 8 : 0),
        distance: distanceScore(distanceKm, c.hardMaxDistanceKm),
        feasibility: feasibilityScore(poi),
        areaMatch: areaMatchScore(poi, c.softLocationBlocks ?? c.locationBlocks),
      };
      const totalScore =
        dimensions.relevance * 0.35 +
        dimensions.distance * 0.3 +
        dimensions.feasibility * 0.2 +
        dimensions.areaMatch * 0.15;
      return { poi, totalScore, distanceKm, dimensions };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/** 场景相关性总分（用于召回门槛，与精排相关维一致） */
export function relevanceGateScore(poi: Poi, scenario: Scenario): number {
  let score = scenarioRelevance(scenario, poi.tags);
  if (scenario === "family") {
    if (poi.tags.includes("kids_menu")) score += 8;
    if (poi.tags.includes("family_diet")) score += 10;
    if (poi.tags.includes("low_cal")) score += 6;
  }
  if (scenario === "friends") {
    if (poi.tags.includes("share_plates")) score += 8;
    if (poi.tags.includes("photo")) score += 6;
  }
  return score;
}
