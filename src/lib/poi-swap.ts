import { POI_CATALOG } from "../../shared/planning/poi-catalog";
import type { Poi, PoiCategory } from "../../shared/planning/types";
import type { DayPlan, ItineraryItem, SwapHistoryEntry } from "@/types/itinerary";

export type SwapDirection = "next" | "prev";

const MAX_SWAP_HISTORY = 30;

export function zoneKeyword(homeLabel?: string): string {
  if (!homeLabel) return "";
  const m = homeLabel.match(
    /(望京|中关村|三里屯|国贸|奥森|朝阳|海淀|西城|东城|丰台|通州|昌平|大兴|顺义|房山|门头沟|石景山|怀柔|密云|平谷|延庆|亦庄|回龙观|天通苑|五道口|西单|王府井|798)/,
  );
  return m?.[1] ?? "";
}

function itemTypeToCategories(type: ItineraryItem["type"]): PoiCategory[] {
  if (type === "food") return ["restaurant"];
  if (type === "hotel") return ["extra"];
  return ["attraction", "extra"];
}

function normalizePoiName(name: string): string {
  return name.replace(/[·\s]/g, "").trim();
}

export function findPoiInCatalog(name: string): Poi | undefined {
  const norm = normalizePoiName(name);
  return POI_CATALOG.find((p) => normalizePoiName(p.name) === norm);
}

function findPoiByHistoryEntry(entry: SwapHistoryEntry): Poi | undefined {
  const byId = POI_CATALOG.find((p) => p.id === entry.poiId);
  if (byId) return byId;
  return findPoiInCatalog(entry.name);
}

export function collectItineraryPoiNames(days: DayPlan[]): string[] {
  const names = new Set<string>();
  for (const day of days) {
    for (const item of day.items) names.add(item.name.trim());
  }
  return [...names];
}

/** 仅排除同类型其他站点，避免餐厅占满玩法候选池 */
export function collectOtherSlotPoiNames(
  days: DayPlan[],
  opts: { itemId: string; itemType: ItineraryItem["type"] },
): string[] {
  const names: string[] = [];
  for (const day of days) {
    for (const item of day.items) {
      if (item.id === opts.itemId) continue;
      if (item.type !== opts.itemType) continue;
      const n = item.name.trim();
      if (n) names.push(n);
    }
  }
  return names;
}

export function poiToItineraryFields(
  poi: Poi,
): Pick<ItineraryItem, "name" | "description" | "price"> {
  return {
    name: poi.name,
    description: poi.description,
    price: poi.avgPrice > 0 ? `人均¥${poi.avgPrice}` : "免费/步行",
  };
}

function poolHasAlternative(pool: Poi[], currentName: string): boolean {
  const cur = normalizePoiName(currentName);
  return pool.some((p) => normalizePoiName(p.name) !== cur);
}

/** 全城同类型候选池（均匀随机，全连接） */
export function buildOrderedSwapPool(opts: {
  homeLabel?: string;
  itemType: ItineraryItem["type"];
  otherSlotNames: string[];
  currentName: string;
}): Poi[] {
  const categories = itemTypeToCategories(opts.itemType);
  const blocked = new Set(opts.otherSlotNames.map((s) => s.trim()).filter(Boolean));

  return POI_CATALOG.filter((p) => {
    if (!categories.includes(p.category)) return false;
    if (blocked.has(p.name)) return false;
    return true;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function snapshotFromItem(item: ItineraryItem): SwapHistoryEntry {
  const poi = findPoiInCatalog(item.name);
  return {
    poiId: poi?.id ?? item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    swapCycleIndex: item.swapCycleIndex,
  };
}

function pickUniformRandom(candidates: Poi[]): Poi {
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export type SwapPickResult = { poi: Poi; cycleIndex: number; fromHistory?: boolean };

/** 上一家：弹出本站的换店历史栈顶（真实回到刚才那家） */
export function pickSwapPrev(item: ItineraryItem): SwapPickResult | null {
  const history = item.swapHistory ?? [];
  if (history.length === 0) return null;

  const entry = history[history.length - 1];
  const poi = findPoiByHistoryEntry(entry);
  if (!poi) return null;

  return {
    poi,
    cycleIndex: entry.swapCycleIndex ?? 0,
    fromHistory: true,
  };
}

/** 换一家：全城均匀随机 */
export function pickSwapNext(opts: {
  homeLabel?: string;
  itemType: ItineraryItem["type"];
  otherSlotNames?: string[];
  currentName: string;
}): SwapPickResult | null {
  const current = opts.currentName.trim();
  const curNorm = normalizePoiName(current);
  const otherSlotNames = opts.otherSlotNames ?? [];

  const pool = buildOrderedSwapPool({
    homeLabel: opts.homeLabel,
    itemType: opts.itemType,
    otherSlotNames,
    currentName: current,
  });

  if (pool.length === 0 || !poolHasAlternative(pool, current)) return null;

  const candidates = pool.filter((p) => normalizePoiName(p.name) !== curNorm);
  const poi = pickUniformRandom(candidates);
  const cycleIndex = pool.findIndex((p) => p.id === poi.id);
  return { poi, cycleIndex: cycleIndex >= 0 ? cycleIndex : 0 };
}

/** @deprecated 请用 pickSwapPrev / pickSwapNext */
export function pickSwapPoi(opts: {
  homeLabel?: string;
  itemType: ItineraryItem["type"];
  otherSlotNames?: string[];
  lockedNames?: string[];
  currentName: string;
  cycleIndex?: number;
  direction?: SwapDirection;
  item?: ItineraryItem;
}): SwapPickResult | null {
  if (opts.direction === "prev" && opts.item) {
    return pickSwapPrev(opts.item);
  }
  const current = opts.currentName.trim();
  const otherSlotNames =
    opts.otherSlotNames ??
    (opts.lockedNames ?? []).filter((n) => n.trim() && n.trim() !== current);
  return pickSwapNext({
    homeLabel: opts.homeLabel,
    itemType: opts.itemType,
    otherSlotNames,
    currentName: opts.currentName,
  });
}

export function applySwapToItem(
  item: ItineraryItem,
  pick: SwapPickResult,
  direction: SwapDirection,
): ItineraryItem {
  const fields = poiToItineraryFields(pick.poi);

  if (direction === "prev" && pick.fromHistory) {
    const history = [...(item.swapHistory ?? [])];
    history.pop();
    return {
      ...item,
      ...fields,
      id: `${pick.poi.id}-${Date.now()}`,
      status: "unbooked",
      code: undefined,
      swapCycleIndex: pick.cycleIndex,
      swapHistory: history,
      swapExclude: undefined,
    };
  }

  const history = [...(item.swapHistory ?? []), snapshotFromItem(item)].slice(-MAX_SWAP_HISTORY);

  return {
    ...item,
    ...fields,
    id: `${pick.poi.id}-${Date.now()}`,
    status: "unbooked",
    code: undefined,
    swapCycleIndex: pick.cycleIndex,
    swapHistory: history,
    swapExclude: undefined,
  };
}
