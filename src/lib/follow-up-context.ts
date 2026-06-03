import { POI_CATALOG } from "../../shared/planning/poi-catalog";
import type { DayPlan } from "@/types/itinerary";

/** 从 planContext 时间轴 + 行程表提取已锁定 POI */
export function extractPlannedPoiNames(
  planContext: string,
  itinerary?: DayPlan[],
): string[] {
  const names = new Set<string>();
  itinerary?.forEach((d) => d.items.forEach((i) => names.add(i.name.trim())));

  for (const line of planContext.split("\n")) {
    if (!line.includes("|")) continue;
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length >= 3 && /^-?\s*(PLAY|EAT|EXTRA)\b/i.test(parts[0])) {
      names.add(parts[1]);
    }
  }
  return [...names];
}

function zoneKeyword(homeLabel?: string): string {
  if (!homeLabel) return "";
  const m = homeLabel.match(
    /(望京|中关村|三里屯|国贸|奥森|朝阳|海淀|西城|东城|丰台|通州|昌平|大兴|顺义|房山|门头沟|石景山|怀柔|密云|平谷|延庆|亦庄|回龙观|天通苑|五道口|西单|王府井)/,
  );
  return m?.[1] ?? "";
}

function isTooSimilarToLocked(name: string, locked: Set<string>): boolean {
  for (const L of locked) {
    if (name === L || name.includes(L) || L.includes(name)) return true;
    const a = name.replace(/[·\s]/g, "");
    const b = L.replace(/[·\s]/g, "");
    if (a.length >= 4 && b.length >= 4 && (a.includes(b.slice(0, 4)) || b.includes(a.slice(0, 4)))) {
      if (/公园|乐园|广场|商场|餐厅|小馆/.test(name) && /公园|乐园|广场|商场|餐厅|小馆/.test(L)) {
        return true;
      }
    }
  }
  return false;
}

/** 同商圈召回池内、未入选的候选（供加项追问，避免幻觉店名） */
export function pickAlternatePois(
  homeLabel: string | undefined,
  lockedNames: string[],
  limit = 8,
): string[] {
  const locked = new Set(lockedNames);
  const zone = zoneKeyword(homeLabel);
  const pool = POI_CATALOG.filter((p) => {
    if (locked.has(p.name) || isTooSimilarToLocked(p.name, locked)) return false;
    if (
      zone &&
      !p.area.includes(zone) &&
      !p.district.includes(zone) &&
      !p.description.includes(zone)
    ) {
      return false;
    }
    return p.category === "attraction" || p.category === "extra";
  });
  return pool.slice(0, limit).map((p) => p.name);
}

/** 追问时注入：行程锁定 + 对话记忆 + 候选池 */
export function buildFollowUpMemoryBlock(opts: {
  planContext: string;
  itinerary?: DayPlan[];
  messages: { role: string; content: string }[];
  planMessageIndex: number;
  homeLabel?: string;
}): string {
  const locked = extractPlannedPoiNames(opts.planContext, opts.itinerary);
  const alternates = pickAlternatePois(opts.homeLabel, locked);
  const thread = opts.messages.slice(opts.planMessageIndex + 1);
  const recentDialogue = thread
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => `${m.role === "user" ? "用户" : "小喵"}：${m.content.slice(0, 400)}`)
    .join("\n");

  return [
    `【已有行程·禁止重复或「换名同类」推荐】${locked.join("、")}`,
    alternates.length > 0
      ? `【加项/备选候选·只能从下列名称中选，不得编造新店】\n${alternates.join("、")}`
      : "【加项】无额外候选时，只给选型原则，不要编造具体店名。",
    recentDialogue ? `【多轮对话记忆·须阅读并避免与上文矛盾、重复】\n${recentDialogue}` : "",
    "【输出要求】2 个备选，每条用「**名称**」起头，并写清：①与已有行程的差异 ②预计时长 ③5岁娃/亲子友好点；合计 150–280 字。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function findPlanAnchorIndex(
  messages: { role: string; planContext?: string; itinerary?: DayPlan[] }[],
): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext && m.itinerary?.length) return i;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext) return i;
  }
  return -1;
}
