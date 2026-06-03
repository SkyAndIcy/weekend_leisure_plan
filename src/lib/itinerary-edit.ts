import { POI_CATALOG } from "../../shared/planning/poi-catalog";
import type { Poi } from "../../shared/planning/types";
import type { DayPlan, ItineraryItem } from "@/types/itinerary";

/** 用户要把地点写进行程表（非重新规划、非纯聊天追问） */
export function isItineraryEditRequest(text: string, hasExistingPlan: boolean): boolean {
  if (!hasExistingPlan) return false;
  const t = text.trim();
  return (
    /加上|加入|插入|纳入|并入|加到|放进|写进|并入/.test(t) &&
    (/行程|半日|路线|安排|完整/.test(t) || /艺术区|公园|博物馆|商场|乐园|步行街|小馆|餐厅|\d{2,}/.test(t))
  ) || /更新.*行程|行程.*更新|给我完整行程|完整行程表/.test(t);
}

/** 从用户句子里抽出想加的 POI 关键词 */
export function extractPoiQuery(text: string): string | null {
  const t = text.trim();
  const m1 = t.match(
    /(?:加上|加入|插入|纳入|并入|加到|放进|写进)(?:行程|路线|安排)?[：:\s]*([^，。,\n]+?)(?:艺术区|公园|博物馆|商场|乐园|步行街)?/,
  );
  if (m1?.[1]) return m1[1].replace(/给我.*/, "").trim();

  const m2 = t.match(/(798\s*艺术区?|[^\s，。]{2,12}(?:艺术区|公园|博物馆|商场|乐园))/);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

export function findPoiInCatalog(query: string): Poi | null {
  const q = query.replace(/\s/g, "").toLowerCase();
  if (!q) return null;

  let best: Poi | null = null;
  let bestScore = 0;

  for (const p of POI_CATALOG) {
    const name = p.name.replace(/\s/g, "").toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q) || q.includes(name)) score = 80;
    else if (/798/.test(q) && (/798/.test(name) || p.area.includes("798") || p.description.includes("798"))) {
      score = 75;
    } else if (q.length >= 2 && (name.includes(q.slice(0, 4)) || p.area.includes(query))) {
      score = 50;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 50 ? best : null;
}

function parseClock(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatClock(totalMin: number): string {
  const t = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function poiToItem(poi: Poi, time: string): ItineraryItem {
  return {
    id: `${poi.id}-${Date.now()}`,
    time,
    name: poi.name,
    type: poi.category === "restaurant" ? "food" : poi.category === "extra" ? "scenic" : "scenic",
    description: poi.description,
    price: poi.avgPrice > 0 ? `人均¥${poi.avgPrice}` : "免费/步行",
    status: poi.category === "restaurant" ? "unbooked" : "unbooked",
  };
}

/** 在首个「吃」之前插入景点；并顺移后续时刻 */
export function insertPoiIntoItinerary(days: DayPlan[], poi: Poi): DayPlan[] {
  return days.map((day) => {
    const items = [...day.items];
    const exists = items.some((i) => i.name === poi.name || i.id.startsWith(poi.id));
    if (exists) return day;

    const foodIdx = items.findIndex((i) => i.type === "food");
    const insertAt = foodIdx >= 0 ? foodIdx : items.length;

    let insertMin: number;
    if (insertAt === 0) {
      insertMin = parseClock("14:00");
    } else if (insertAt >= items.length) {
      insertMin = parseClock(items[items.length - 1].time) + 80;
    } else {
      const prev = parseClock(items[insertAt - 1].time);
      const next = parseClock(items[insertAt].time);
      insertMin = Math.floor((prev + next) / 2);
      if (next - insertMin < 45) {
        insertMin = prev + 70;
      }
    }

    const newItem = poiToItem(poi, formatClock(insertMin));
    items.splice(insertAt, 0, newItem);

    let cursor = parseClock(items[0].time);
    const resequenced = items.map((item, idx) => {
      if (idx > 0) {
        const gap = items[idx - 1].type === "food" ? 65 : 75;
        cursor = Math.max(cursor + gap, parseClock(item.time));
      }
      return { ...item, time: formatClock(cursor) };
    });

    return { ...day, items: resequenced };
  });
}

export function appendPoiToPlanContext(planContext: string, poi: Poi, time: string): string {
  const line = `- EXTRA ${time} | ${poi.name} | ${poi.description}`;
  if (planContext.includes(poi.name)) return planContext;
  if (planContext.includes("时间轴:")) {
    return planContext.replace("时间轴:", `时间轴:\n${line}`);
  }
  return `${planContext}\n时间轴增补:\n${line}`;
}

export function buildItineraryEditReply(poi: Poi, days: DayPlan[]): string {
  const lines = days[0]?.items.map((i) => `- **${i.time}** ${i.name}`).join("\n") ?? "";
  return [
    `# 周末半日 · 已加入${poi.name}`,
    "",
    `已把 **${poi.name}** 写进当前行程（插在用餐前的一站）。请在下方的**行程表**查看、改时间或「换一个」。`,
    "",
    "**今日顺序：**",
    lines,
    "",
    "### 一键安排",
    "- 订座/排队：以行程表中餐厅状态为准",
    "- 发给同行：可在行程表点「添加到我的行程」后分享",
  ].join("\n");
}
