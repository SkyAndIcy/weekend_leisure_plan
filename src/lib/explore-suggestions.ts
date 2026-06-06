import { POI_CATALOG } from "../../shared/planning/poi-catalog";
import { extractPlannedPoiNames, pickAlternatePois } from "@/lib/follow-up-context";
import { zoneKeyword } from "@/lib/poi-swap";
import type { DayPlan } from "@/types/itinerary";

export type PlanLinkedMessage = {
  role: string;
  planContext?: string;
};

/** 引导型继续探索：展示文案 + 点击后发给小喵的追问 */
export type ExploreGuide = {
  id: string;
  label: string;
  hint: string;
  prompt: string;
};

export type BuildExploreGuidesOpts = {
  planContext: string;
  locationLabel?: string;
  userHint?: string;
  itinerary?: DayPlan[];
  /** 规划锚点消息下标，用于识别已点过的引导 */
  messages?: { role: string; content: string }[];
  planMessageIndex?: number;
};

/** 当前消息关联的方案上下文（本条或向前找最近一条带行程的方案） */
export function findLinkedPlanContext(
  messages: (PlanLinkedMessage & { itinerary?: unknown[] })[],
  index: number,
): string | undefined {
  const cur = messages[index];
  if (cur?.planContext && cur.itinerary?.length) return cur.planContext;
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext && m.itinerary?.length) return m.planContext;
  }
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext) return m.planContext;
  }
  return undefined;
}

export function lastAssistantMessageIndex(messages: PlanLinkedMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

/** 触发本次规划的那条用户原话（用于判断半日/亲子等） */
export function findPlanningUserHint(
  messages: { role: string; content: string; planContext?: string }[],
  fromIndex: number,
): string | undefined {
  let planOwner = -1;
  for (let i = fromIndex; i >= 0; i--) {
    if (messages[i].role === "assistant" && messages[i].planContext) {
      planOwner = i;
      break;
    }
  }
  const searchBefore = planOwner >= 0 ? planOwner : fromIndex;
  for (let i = searchBefore - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return undefined;
}

/** 是否是对已有方案的追问（不应重新跑 DAG 规划） */
export function isFollowUpQuery(text: string, hasExistingPlan: boolean): boolean {
  if (!hasExistingPlan) return false;
  const t = text.trim();
  return (
    /住宿|酒店|民宿|住哪|过夜|房型/.test(t) ||
    /美食|吃什么|餐厅|饭店|换.*餐厅/.test(t) ||
    /打卡|景点|好玩|值得|逛逛|展览|加项|加点|延长|备选|顺路/.test(t) ||
    /基于当前行程|当前方案|planContext|帮我看看|还有什么/.test(t) ||
    (/怎么选|推荐|有其他/.test(t) && t.length < 80)
  );
}

function homeAreaFromPlanContext(planContext: string): string {
  const m = planContext.match(/出发点:\s*(.+)/);
  return m?.[1]?.trim() || "出发地附近";
}

function isHalfDayPlan(planContext: string, userHint?: string): boolean {
  if (userHint && /2-3\s*小时|2～3\s*小时|半日|别太远|下午.*玩/.test(userHint)) return true;
  if (/半日|2-3\s*小时|2～3\s*小时/.test(planContext)) return true;
  return false;
}

function isFamilyPlan(planContext: string, userHint?: string): boolean {
  return (
    planContext.includes("family") ||
    /亲子|带娃|孩子|\d+岁|宝宝|娃/.test(userHint ?? "") ||
    /家庭亲子/.test(planContext)
  );
}

function isFriendsPlan(planContext: string, userHint?: string): boolean {
  return (
    planContext.includes("friends") ||
    /朋友|闺蜜|聚会|小聚/.test(userHint ?? "") ||
    /朋友小聚/.test(planContext)
  );
}

type SlotKind = "play" | "eat" | "extra";

function slotsFromPlan(
  planContext: string,
  itinerary?: DayPlan[],
): { kind: SlotKind; name: string; time?: string }[] {
  const slots: { kind: SlotKind; name: string; time?: string }[] = [];
  if (itinerary?.length) {
    for (const d of itinerary) {
      for (const item of d.items) {
        slots.push({
          kind: item.type === "food" ? "eat" : "extra",
          name: item.name,
          time: item.time,
        });
      }
    }
    if (slots.length) return slots;
  }
  for (const line of planContext.split("\n")) {
    if (!line.includes("|")) continue;
    const parts = line.split("|").map((s) => s.trim());
    const head = parts[0] ?? "";
    const name = parts[1];
    if (!name) continue;
    const timeM = head.match(/(\d{1,2}:\d{2})/);
    if (/EAT/i.test(head)) slots.push({ kind: "eat", name, time: timeM?.[1] });
    else if (/EXTRA/i.test(head)) slots.push({ kind: "extra", name, time: timeM?.[1] });
    else if (/PLAY/i.test(head)) slots.push({ kind: "play", name, time: timeM?.[1] });
  }
  return slots;
}

function routePatternFromSummary(planContext: string): string {
  const m = planContext.match(/推荐模式:[^\n]*\n?([^\n·]+·[^\n]+)/);
  const summary = m?.[1] ?? planContext.split("\n").find((l) => /玩|吃/.test(l)) ?? "";
  if (/吃 → 玩 → 玩|吃.*玩.*玩/.test(summary)) return "eat_play_play";
  if (/吃 → 玩|先吃/.test(summary)) return "eat_play";
  if (/玩 → 吃 → 玩/.test(summary)) return "play_eat_play";
  if (/玩 → 吃 → 加项|加项/.test(summary)) return "play_eat_extra";
  return "play_eat";
}

function mealLabelFromPlan(planContext: string): "午餐" | "晚餐" | "正餐" {
  if (/午餐|lunch/i.test(planContext)) return "午餐";
  if (/晚餐|dinner/i.test(planContext)) return "晚餐";
  return "正餐";
}

function pickAlternateRestaurants(
  homeLabel: string | undefined,
  lockedNames: string[],
  limit = 4,
): string[] {
  const locked = new Set(lockedNames);
  const zone = zoneKeyword(homeLabel);
  return POI_CATALOG.filter((p) => {
    if (p.category !== "restaurant" || locked.has(p.name)) return false;
    if (
      zone &&
      !p.area.includes(zone) &&
      !p.district.includes(zone) &&
      !p.description.includes(zone)
    ) {
      return false;
    }
    return true;
  })
    .slice(0, limit)
    .map((p) => p.name);
}

function namesHint(names: string[], emptyFallback: string): string {
  if (names.length === 0) return emptyFallback;
  if (names.length === 1) return `例如：${names[0]}`;
  return `例如：${names.slice(0, 2).join("、")}${names.length > 2 ? " 等" : ""}`;
}

/** 本会话在规划锚点之后是否已聊过某类引导 */
function exploredTopics(
  messages: { role: string; content: string }[] | undefined,
  planMessageIndex: number | undefined,
): Set<string> {
  const done = new Set<string>();
  if (!messages || planMessageIndex === undefined || planMessageIndex < 0) return done;
  for (const m of messages.slice(planMessageIndex + 1)) {
    if (m.role !== "user") continue;
    const t = m.content;
    if (/美食|餐厅|吃什么|换.*餐/.test(t)) done.add("food");
    if (/加点|玩法|打卡|景点|顺路|逛/.test(t)) done.add("play");
    if (/傍晚|收尾|延长|还能做/.test(t)) done.add("extend");
    if (/住宿|酒店|过夜/.test(t)) done.add("stay");
  }
  return done;
}

function childNote(family: boolean, userHint?: string): string {
  const age = userHint?.match(/(\d+)\s*岁/)?.[1];
  if (family && age) return `适合${age}岁娃、`;
  if (family) return "适合带娃、";
  return "";
}

/** 结合当前方案生成引导型「继续探索」（文案随行程变） */
export function buildExploreGuides(
  planContextOrOpts: string | BuildExploreGuidesOpts,
  locationLabel?: string,
  userHint?: string,
): ExploreGuide[] {
  const opts: BuildExploreGuidesOpts =
    typeof planContextOrOpts === "string"
      ? { planContext: planContextOrOpts, locationLabel, userHint }
      : planContextOrOpts;

  const {
    planContext,
    locationLabel: locLabel,
    userHint: hint,
    itinerary,
    messages,
    planMessageIndex,
  } = opts;

  const area = locLabel?.trim() || homeAreaFromPlanContext(planContext);
  const zone = zoneKeyword(area) || area.slice(0, 6);
  const halfDay = isHalfDayPlan(planContext, hint);
  const family = isFamilyPlan(planContext, hint);
  const friends = isFriendsPlan(planContext, hint);
  const locked = extractPlannedPoiNames(planContext, itinerary);
  const slots = slotsFromPlan(planContext, itinerary);
  const playNames = slots.filter((s) => s.kind === "play").map((s) => s.name);
  const eatNames = slots.filter((s) => s.kind === "eat").map((s) => s.name);
  const extraNames = slots.filter((s) => s.kind === "extra").map((s) => s.name);
  const route = routePatternFromSummary(planContext);
  const meal = mealLabelFromPlan(planContext);
  const playAlts = pickAlternatePois(area, locked, 5);
  const eatAlts = pickAlternateRestaurants(area, locked, 4);
  const done = exploredTopics(messages, planMessageIndex);

  const playPromptExtra = family
    ? "每条写差异+时长+亲子友好点，适合5岁娃的可玩性。"
    : friends
      ? "每条写氛围/时长/适合朋友小聚的点。"
      : "每条写差异+时长+体力消耗。";

  const guides: ExploreGuide[] = [];

  // —— 加玩法 / 加站点 ——
  if (!done.has("play")) {
    if (route === "play_eat_play" && playNames.length >= 2) {
      guides.push({
        id: "play-more",
        label: "换个第二段玩法",
        hint: namesHint(
          playAlts,
          `已排「${playNames[1]}」，可在${zone}换同类更轻松的点`,
        ),
        prompt: `当前行程已是玩→吃→玩，第二段玩法是${playNames[1]}。请推荐 2 个可替换的${family ? "亲子" : ""}备选（不得与${locked.join("、")}重复），${playPromptExtra}`,
      });
    } else if (route === "eat_play" || route === "eat_play_play") {
      const afterEat = eatNames[0] ?? "餐厅";
      guides.push({
        id: "play-more",
        label: family ? "午饭后加点亲子玩法" : "正餐后附近再逛",
        hint: namesHint(
          playAlts,
          `${meal}在「${afterEat}」之后，${zone}步行可达的打卡`,
        ),
        prompt: `当前动线是先吃再玩，已订「${afterEat}」。请推荐 2 个饭后可加的${family ? "亲子" : ""}玩法备选（勿与${locked.join("、")}重复），${playPromptExtra}`,
      });
    } else {
      const anchor = playNames[0] ?? locked[0] ?? "当前景点";
      guides.push({
        id: "play-more",
        label: family ? "加点亲子玩法" : friends ? "加点顺路打卡" : "再加一处玩法",
        hint: namesHint(
          playAlts,
          `在「${anchor}」与${meal}之间，${zone}1 小时内可往返`,
        ),
        prompt: `基于当前行程（已含${locked.join("、")}），推荐 2 个可加的${family ? "亲子" : ""}玩法备选，必须不同于已有地点，${playPromptExtra}`,
      });
    }
  } else {
    guides.push({
      id: "play-more-2",
      label: "再要不同风格玩法",
      hint: namesHint(playAlts, `${zone}还有未入选的景点可对比`),
      prompt: `在之前推荐基础上，再给 2 个风格不同的${zone}玩法备选，不得与${locked.join("、")}重复。${playPromptExtra}`,
    });
  }

  // —— 换餐厅 ——
  if (!done.has("food") && eatNames.length > 0) {
    const curEat = eatNames[0];
    const lowCal = /减脂|低脂|轻食|减肥/.test(hint ?? "") || /低脂/.test(planContext);
    guides.push({
      id: "food-alt",
      label: lowCal ? "换家轻食/低脂餐" : friends ? "换家聚餐餐厅" : "换家餐厅试试",
      hint: namesHint(
        eatAlts,
        `行程里是「${curEat}」，${meal}时段可对比排队/人均`,
      ),
      prompt: `当前${meal}餐厅是「${curEat}」。请再推荐 2 家${zone}附近美食备选（不得重复），说明口味/排队/人均差异及${childNote(family, hint)}是否适合当前动线。`,
    });
  } else if (!done.has("food")) {
    guides.push({
      id: "food-alt",
      label: "定一家餐厅",
      hint: namesHint(eatAlts, `${zone}${meal}时段可选`),
      prompt: `请在${zone}推荐 2 家适合当前动线的${meal}餐厅备选，${childNote(family, hint)}说明差异。`,
    });
  } else {
    guides.push({
      id: "food-alt-2",
      label: "小吃或下午茶备选",
      hint: namesHint(eatAlts.slice(0, 3), `与「${eatNames[0] ?? "已选餐厅"}」错开`),
      prompt: `已讨论过餐厅，请补充 2 个小吃/下午茶备选，不要与${locked.join("、")}重复。`,
    });
  }

  // —— 第三项：随动线/时段变化 ——
  if (halfDay && !done.has("extend")) {
    const lastPlay = playNames[playNames.length - 1] ?? playNames[0];
    const eatTime = slots.find((s) => s.kind === "eat")?.time;
    if (route === "play_eat_play") {
      guides.push({
        id: "extend-lite",
        label: "动线还能怎么微调",
        hint: `现为玩→吃→玩；${eatTime ? `${meal}约${eatTime}` : meal}后看是否加轻量收尾`,
        prompt: `当前是玩→吃→玩，${meal}在${eatTime ?? "正餐窗口"}。请建议是否调整顺序或替换其中一站（仍用候选池店名），并说明理由。`,
      });
    } else if (meal === "晚餐") {
      guides.push({
        id: "extend-lite",
        label: "饭后还能顺路做什么",
        hint: lastPlay
          ? `吃完「${eatNames[0] ?? "餐厅"}」后，${lastPlay}附近轻量收尾`
          : `${zone}晚饭后 1 小时内可结束的活动`,
        prompt: `晚餐后时间有限，基于${locked.join("、")}，推荐 1–2 个轻松收尾活动（勿与已有重复），说明时长与路程。`,
      });
    } else {
      guides.push({
        id: "extend-lite",
        label: family ? "午后还能带娃玩什么" : "傍晚前还能做什么",
        hint: extraNames.length
          ? `已含加项「${extraNames[0]}」，可对比是否换成${playAlts[0] ?? "其他点"}`
          : namesHint(playAlts.slice(0, 2), `${meal}后、${zone}顺路轻活动`),
        prompt: `在当前半日行程（${locked.join("→")}）基础上，${meal}后还能顺路做的 1–2 个轻量活动，${childNote(family, hint)}说明别绕路。`,
      });
    }
  } else if (!halfDay && !done.has("stay")) {
    guides.push({
      id: "stay",
      label: "若要过夜怎么选",
      hint: `${zone}住宿原则（当日半日可忽略）`,
      prompt: `若计划在${area}过夜，${family ? "亲子" : friends ? "朋友" : ""}出行各给 2 条选酒店原则，不要重排玩吃时间轴。`,
    });
  } else if (!done.has("extend")) {
    guides.push({
      id: "extend-lite",
      label: "延长半日还能加什么",
      hint: namesHint(playAlts, `在${zone}与现有${playNames.length}站玩法互补`),
      prompt: `若延长 1–2 小时，基于当前方案还能加什么？给 2 个备选并说明与${locked.join("、")}的差异。`,
    });
  }

  return guides.slice(0, 3);
}
