import type { DayPlan, ItineraryItem } from "@/types/itinerary";

function parseClock(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function insertItemByTime(items: ItineraryItem[], item: ItineraryItem): ItineraryItem[] {
  return [...items, item].sort((a, b) => parseClock(a.time) - parseClock(b.time));
}

/** 软删除：移入 removedItems，可随时加回 */
export function removeItineraryItem(
  days: DayPlan[],
  dayIdx: number,
  itemId: string,
): DayPlan[] | null {
  const day = days[dayIdx];
  const item = day?.items.find((i) => i.id === itemId);
  if (!day || !item) return null;

  return days.map((d, i) => {
    if (i !== dayIdx) return d;
    const removed = [...(d.removedItems ?? []), item];
    return {
      ...d,
      items: d.items.filter((it) => it.id !== itemId),
      removedItems: removed,
    };
  });
}

/** 从 removedItems 加回行程表（按时刻排序插入） */
export function restoreItineraryItem(
  days: DayPlan[],
  dayIdx: number,
  itemId: string,
): DayPlan[] | null {
  const day = days[dayIdx];
  const item = day?.removedItems?.find((i) => i.id === itemId);
  if (!day || !item) return null;

  return days.map((d, i) => {
    if (i !== dayIdx) return d;
    return {
      ...d,
      items: insertItemByTime(d.items, item),
      removedItems: (d.removedItems ?? []).filter((it) => it.id !== itemId),
    };
  });
}
