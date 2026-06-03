import type { HomeAnchor } from "./types.ts";
import {
  BEIJING_ZONES,
  isInGreaterBeijing,
  nearestBeijingZone,
  resolveZoneFromText,
  zoneAnchor,
} from "./beijing-zones.ts";

const DEFAULT_ZONE = BEIJING_ZONES[0];
const DEFAULT_HOME: HomeAnchor = zoneAnchor(DEFAULT_ZONE);

/** 从地址文案匹配已知商圈锚点 */
export function resolveAnchorFromText(blob: string): HomeAnchor | null {
  const z = resolveZoneFromText(blob);
  return z ? zoneAnchor(z) : null;
}

/** GPS 坐标吸附到最近商圈（北京全城） */
export function nearestAreaAnchor(lat: number, lng: number, maxKm = 35): HomeAnchor | null {
  const z = nearestBeijingZone(lat, lng, maxKm);
  return z ? zoneAnchor(z) : null;
}

export function shortAreaLabel(anchor: HomeAnchor): string {
  const parts = anchor.label.split("·");
  return parts.length > 1 ? parts[parts.length - 1] : anchor.label;
}

/** Straight-line distance in km (demo; production: routing ETA). */
export function straightLineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function resolveHome(opts: {
  fullAddress?: string;
  displayName?: string;
  coords?: { lat: number; lng: number };
}): HomeAnchor {
  const blob = `${opts.fullAddress || ""}${opts.displayName || ""}`;
  const textZone = resolveZoneFromText(blob);

  if (opts.coords) {
    const { lat, lng } = opts.coords;
    const label = opts.displayName || opts.fullAddress || "当前位置";
    const inBeijing = isInGreaterBeijing(lat, lng);

    if (inBeijing) {
      const nearest = nearestBeijingZone(lat, lng, 40);
      if (textZone) {
        return { label: zoneAnchor(textZone).label, lat, lng };
      }
      if (nearest) {
        return {
          label: `${label}（${nearest.district}·${nearest.area}附近）`,
          lat,
          lng,
        };
      }
      return { label: `北京市·${label}`, lat, lng };
    }

    const snapped = nearestAreaAnchor(lat, lng, 50);
    if (snapped) {
      return { label: `${label}（近${shortAreaLabel(snapped)}）`, lat, lng };
    }
    return { label, lat, lng };
  }

  if (textZone) return zoneAnchor(textZone);
  return DEFAULT_HOME;
}

/** Map lat/lng to 0–100 SVG percent relative to home + spread. */
export function latLngToPercent(
  lat: number,
  lng: number,
  home: HomeAnchor,
  spreadKm = 8,
): { x: number; y: number } {
  const dx = (lng - home.lng) * 85;
  const dy = (home.lat - lat) * 110;
  const x = Math.max(8, Math.min(92, 50 + (dx / spreadKm) * 40));
  const y = Math.max(8, Math.min(92, 50 + (dy / spreadKm) * 40));
  return { x, y };
}
