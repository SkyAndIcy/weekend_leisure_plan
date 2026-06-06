import { POI_CATALOG } from "../../shared/planning/poi-catalog";
import type { MapDeparturePoint, MapPoint } from "@/types/map";
import { latLngToPercent, resolveHome } from "@/lib/recommendation/geo";
import type { HomeAnchor } from "../../shared/planning/types";
import type { Poi } from "../../shared/planning/types";
import type { ItineraryItem } from "@/types/itinerary";

function normalizePoiName(name: string): string {
  return name.replace(/[·\s]/g, "").trim();
}

export function findPoiByName(name: string): Poi | undefined {
  const norm = normalizePoiName(name);
  return POI_CATALOG.find((p) => normalizePoiName(p.name) === norm);
}

export function resolveHomeFromLabel(
  homeLabel?: string,
  coords?: { lat: number; lng: number },
): HomeAnchor {
  return resolveHome({
    displayName: homeLabel,
    fullAddress: homeLabel,
    coords,
  });
}

export function buildDeparturePoint(home: HomeAnchor): MapDeparturePoint {
  const { x, y } = latLngToPercent(home.lat, home.lng, home);
  return {
    label: home.label,
    x,
    y,
    lat: home.lat,
    lng: home.lng,
  };
}

export function departureFromLocation(opts: {
  displayName?: string;
  fullAddress?: string;
  coords?: { lat: number; lng: number };
}): MapDeparturePoint {
  return buildDeparturePoint(resolveHomeFromLabel(opts.displayName || opts.fullAddress, opts.coords));
}

/** 出发点变更后，按新锚点重算路线各站百分比坐标 */
/** 为旧数据补全经纬度（按店名查 catalog） */
export function enrichRoutePoints(points: MapPoint[]): MapPoint[] {
  return points.map((p) => {
    if (p.lat != null && p.lng != null) return p;
    const poi = findPoiByName(p.name);
    if (!poi) return p;
    return { ...p, lat: poi.lat, lng: poi.lng };
  });
}

export function reanchorRouteToDeparture(
  routePoints: MapPoint[],
  departure: MapDeparturePoint,
): MapPoint[] {
  const home: HomeAnchor = {
    lat: departure.lat,
    lng: departure.lng,
    label: departure.label,
  };
  return routePoints.map((p) => {
    if (p.lat == null || p.lng == null) return p;
    const { x, y } = latLngToPercent(p.lat, p.lng, home);
    return { ...p, x, y };
  });
}

/** 换店后同步地图路线对应站点坐标（按行程表下标对齐） */
export function syncRoutePointAtIndex(
  routePoints: MapPoint[] | undefined,
  itemIndex: number,
  poi: Poi,
  home: HomeAnchor,
  itemType: ItineraryItem["type"],
): MapPoint[] {
  if (!routePoints?.length || itemIndex < 0 || itemIndex >= routePoints.length) {
    return routePoints ?? [];
  }
  const { x, y } = latLngToPercent(poi.lat, poi.lng, home);
  return routePoints.map((p, i) =>
    i === itemIndex
      ? {
          ...p,
          id: poi.id,
          name: poi.name,
          type: itemType,
          x,
          y,
          lat: poi.lat,
          lng: poi.lng,
          inRoute: true,
          description: poi.description,
          price: poi.avgPrice > 0 ? `¥${poi.avgPrice}` : "免费",
        }
      : p,
  );
}
