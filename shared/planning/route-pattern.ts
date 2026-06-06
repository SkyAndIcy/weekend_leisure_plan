/** 行程站点顺序模板 */
export type RoutePattern =
  | "play_eat"
  | "play_eat_extra"
  | "play_eat_play"
  | "eat_play"
  | "eat_play_play";

export type MealKind = "lunch" | "dinner";

const LUNCH_START = 11 * 60;
const LUNCH_END = 13 * 60;
const DINNER_START = 17 * 60;
const DINNER_END = 20 * 60;

export function inferRoutePattern(text: string, wantExtra: boolean): RoutePattern {
  const t = text;
  const multiPlay = /多个|多处|几家|两处|两个景点|再逛|逛.*再|玩.*再玩/.test(t);

  if (/先吃|吃完.*再玩|饭后.*玩|午餐.*再玩|早餐.*再|早饭.*再/.test(t)) {
    return multiPlay ? "eat_play_play" : "eat_play";
  }
  if (/玩.*吃.*玩|先玩.*吃.*再玩|玩.+再.+吃.+再.+玩/.test(t)) {
    return "play_eat_play";
  }
  if (multiPlay && !/先吃/.test(t)) {
    return "play_eat_play";
  }
  if (wantExtra) return "play_eat_extra";
  return "play_eat";
}

export function inferMealKind(text: string, departureHour: number): MealKind {
  if (/晚饭|晚餐|晚上吃|夜宵|宵夜/.test(text)) return "dinner";
  if (/午饭|午餐|中午吃|正午|早点/.test(text)) return "lunch";
  if (departureHour < 12) return "lunch";
  if (departureHour >= 17) return "dinner";
  if (departureHour >= 11 && departureHour <= 13) return "lunch";
  // 下午出发的半日：正餐按晚餐 17:00–20:00
  return "dinner";
}

export function mealWindowMin(kind: MealKind): { start: number; end: number; label: string } {
  if (kind === "lunch") {
    return { start: LUNCH_START, end: LUNCH_END, label: "午餐 11:00–13:00" };
  }
  return { start: DINNER_START, end: DINNER_END, label: "晚餐 17:00–20:00" };
}

export function routePatternLabel(p: RoutePattern): string {
  const map: Record<RoutePattern, string> = {
    play_eat: "玩 → 吃",
    play_eat_extra: "玩 → 吃 → 加项",
    play_eat_play: "玩 → 吃 → 玩",
    eat_play: "吃 → 玩",
    eat_play_play: "吃 → 玩 → 玩",
  };
  return map[p];
}
