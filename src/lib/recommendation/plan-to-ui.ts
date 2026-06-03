import type { MapPoint } from "@/components/chat/ChatRouteMap";
import type { DayPlan } from "@/types/itinerary";
import { latLngToPercent } from "./geo";
import type { WeekendPlan } from "./types";

const phaseToType = (phase: string): "scenic" | "food" | "hotel" =>
  phase === "eat" ? "food" : "scenic";

export function planToUi(plan: WeekendPlan): {
  days: DayPlan[];
  routePoints: MapPoint[];
  nearbyPoints: MapPoint[];
} {
  const home = { lat: plan.homeLat, lng: plan.homeLng, label: plan.homeLabel };

  const items = plan.timeline.map((slot, i) => ({
    id: slot.poi.id,
    time: slot.start,
    name: slot.poi.name,
    type: phaseToType(slot.phase),
    description: slot.notes,
    price: slot.poi.avgPrice > 0 ? `人均¥${slot.poi.avgPrice}` : "免费/步行",
    status:
      slot.phase === "eat" && plan.bookings.some((b) => b.type === "hold_table")
        ? ("pending" as const)
        : ("unbooked" as const),
    code: i === 1 ? "订座单 MOCK" : undefined,
  }));

  const days: DayPlan[] = [
    {
      day: 1,
      date: "今天",
      period: plan.summary,
      items,
    },
  ];

  const routePoints: MapPoint[] = plan.timeline.map((slot) => {
    const { x, y } = latLngToPercent(slot.poi.lat, slot.poi.lng, home);
    return {
      id: slot.poi.id,
      name: slot.poi.name,
      type: phaseToType(slot.phase),
      x,
      y,
      inRoute: true,
      description: slot.notes,
      price: slot.poi.avgPrice > 0 ? `¥${slot.poi.avgPrice}` : "免费",
    };
  });

  return { days, routePoints, nearbyPoints: [] };
}
