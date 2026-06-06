import { buildDeparturePoint } from "@/lib/itinerary-route-sync";
import type { MapDeparturePoint, MapPoint } from "@/types/map";
import type { DayPlan } from "@/types/itinerary";
import { latLngToPercent } from "./geo";
import type { WeekendPlan } from "./types";

const phaseToType = (phase: string): "scenic" | "food" | "hotel" =>
  phase === "eat" ? "food" : "scenic";

/** 去掉引擎/Debug 文案，只保留用户可读描述 */
function forDisplay(text: string): string {
  return text
    .replace(/（DAG编排[^）]*）/g, "")
    .replace(/DAG编排（反馈\d+次）/g, "")
    .replace(/，?直线约[\d.]+km/g, "")
    .replace(/，?顺路[\d.]+km/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function planToUi(plan: WeekendPlan): {
  days: DayPlan[];
  routePoints: MapPoint[];
  nearbyPoints: MapPoint[];
  departurePoint: MapDeparturePoint;
} {
  const home = { lat: plan.homeLat, lng: plan.homeLng, label: plan.homeLabel };
  const departurePoint = buildDeparturePoint(home);

  const items = plan.timeline.map((slot) => ({
    id: slot.poi.id,
    time: slot.start,
    name: slot.poi.name,
    type: phaseToType(slot.phase),
    description: forDisplay(slot.notes).replace(/^已订座[；;]\s*/, ""),
    price: slot.poi.avgPrice > 0 ? `人均¥${slot.poi.avgPrice}` : "免费/步行",
    status: "unbooked" as const,
  }));

  const days: DayPlan[] = [
    {
      day: 1,
      date: "今天",
      period: forDisplay(plan.summary),
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
      lat: slot.poi.lat,
      lng: slot.poi.lng,
      inRoute: true,
      description: forDisplay(slot.notes),
      price: slot.poi.avgPrice > 0 ? `¥${slot.poi.avgPrice}` : "免费",
    };
  });

  return { days, routePoints, nearbyPoints: [], departurePoint };
}
