import type { Constraints, Scenario } from "./types";
import { BEIJING_ZONES } from "./beijing-zones.ts";

const BLOCK_PATTERNS: [RegExp, string][] = BEIJING_ZONES.flatMap((z) => [
  [new RegExp(z.keywords.join("|")), z.area] as [RegExp, string],
]);

function normalizeNl(text: string): string {
  return text
    .trim()
    .replace(/别离家太(?![远近])/g, "别离家太远")
    .replace(/离家太(?![远近])/g, "离家太远");
}

export function extractConstraints(text: string): Constraints {
  const rawGoal = normalizeNl(text);
  const t = rawGoal;

  const hasFam = /老婆|孩子|亲子|家庭|减脂|减肥|低脂|轻食|小孩|宝宝|娃|儿子|女儿/.test(t);
  const hasChildAge = /\d+\s*岁/.test(t);
  const hasFr = /朋友|闺蜜|小聚|聚餐|四人|4个人|四个|两男两女|2男2女|哥们|姐妹/.test(t);

  let scenario: Scenario = "unknown";
  if (hasFam || hasChildAge) scenario = "family";
  else if (hasFr) scenario = "friends";

  const childM = t.match(/(\d+)\s*岁/);
  const childAge = childM ? parseInt(childM[1], 10) : null;

  let partyTotal: number | null = null;
  if (/四人|4个人|四个/.test(t)) partyTotal = 4;
  else {
    const pm = t.match(/(\d+)\s*个?人/);
    if (pm) partyTotal = Math.max(2, Math.min(20, parseInt(pm[1], 10)));
  }
  if (scenario === "friends" && !partyTotal) partyTotal = 4;

  let departureHour = 14;
  const pmMatch = t.match(/下午\s*(\d{1,2})\s*点?/);
  const amMatch = t.match(/上午\s*(\d{1,2})\s*点?/);
  const noonMatch = t.match(/中午|正午/);
  const eveMatch = t.match(/晚上|傍晚/);
  const hmMatch = t.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (pmMatch) departureHour = parseInt(pmMatch[1], 10);
  else if (amMatch) departureHour = parseInt(amMatch[1], 10);
  else if (noonMatch) departureHour = 11;
  else if (eveMatch) departureHour = 17;
  else if (hmMatch) departureHour = parseInt(hmMatch[1], 10);
  else if (/早饭|早餐|早上出发/.test(t)) departureHour = 9;
  else if (/午饭|午餐/.test(t) && !/下午|晚上/.test(t)) departureHour = 11;
  else if (/晚饭|晚餐/.test(t)) departureHour = 17;

  departureHour = Math.max(8, Math.min(20, departureHour));

  let maxDistanceKm = 8;
  if (/别太远|不远|附近|就近|离家近/.test(t)) maxDistanceKm = 5;
  if (/5\s*公里|五公里/.test(t)) maxDistanceKm = 5;

  let durationHours: [number, number] = [4, 6];
  const durRange = t.match(/(\d+)\s*[-~到至]\s*(\d+)\s*小时/);
  if (durRange) {
    const a = parseInt(durRange[1], 10);
    const b = parseInt(durRange[2], 10);
    durationHours = [Math.min(a, b), Math.max(a, b)];
  } else {
    const durSingle = t.match(/(\d+)\s*小时/);
    if (durSingle) {
      const h = parseInt(durSingle[1], 10);
      durationHours = [Math.max(2, h - 1), Math.min(8, h + 1)];
    }
  }

  const lowCalPreferred = /减脂|减肥|低脂|轻食/.test(t);

  const locationBlocks: string[] = [];
  for (const [re, block] of BLOCK_PATTERNS) {
    if (re.test(t) && !locationBlocks.includes(block)) locationBlocks.push(block);
  }

  return {
    rawGoal,
    scenario,
    departureHour,
    durationHours,
    maxDistanceKm,
    childAge,
    partyTotal,
    lowCalPreferred,
    locationBlocks,
  };
}
