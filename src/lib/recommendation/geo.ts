import type { HomeAnchor } from "./types";

const AREA_ANCHORS: Record<string, HomeAnchor> = {
  三里屯: { label: "北京市朝阳区·三里屯", lat: 39.9345, lng: 116.4543 },
  望京: { label: "北京市朝阳区·望京", lat: 39.988, lng: 116.492 },
  中关村: { label: "北京市海淀区·中关村", lat: 39.983, lng: 116.316 },
  回龙观: { label: "北京市昌平区·回龙观", lat: 40.07, lng: 116.33 },
  奥森: { label: "北京市朝阳区·奥森", lat: 40.0178, lng: 116.3972 },
};

const DEFAULT_HOME: HomeAnchor = { label: "北京市朝阳区·三里屯", lat: 39.9345, lng: 116.4543 };

const AREA_ENTRIES = Object.entries(AREA_ANCHORS);

/** 从地址文案匹配已知商圈锚点 */
export function resolveAnchorFromText(blob: string): HomeAnchor | null {
  for (const [key, anchor] of AREA_ENTRIES) {
    if (blob.includes(key)) return anchor;
  }
  return null;
}

/** GPS 坐标吸附到最近商圈（演示用，15km 内） */
export function nearestAreaAnchor(lat: number, lng: number, maxKm = 15): HomeAnchor | null {
  let best: HomeAnchor | null = null;
  let bestKm = Infinity;
  for (const [, anchor] of AREA_ENTRIES) {
    const d = straightLineKm(lat, lng, anchor.lat, anchor.lng);
    if (d < bestKm) {
      bestKm = d;
      best = anchor;
    }
  }
  return bestKm <= maxKm ? best : null;
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
  if (opts.coords) {
    const label = opts.displayName || opts.fullAddress || "当前位置";
    return { label, lat: opts.coords.lat, lng: opts.coords.lng };
  }
  const blob = `${opts.fullAddress || ""}${opts.displayName || ""}`;
  return resolveAnchorFromText(blob) ?? DEFAULT_HOME;
}

/** Map lat/lng to 0–100 SVG percent relative to home + spread. */
export function latLngToPercent(
  lat: number,
  lng: number,
  home: HomeAnchor,
  spreadKm = 6,
): { x: number; y: number } {
  const dx = (lng - home.lng) * 85;
  const dy = (home.lat - lat) * 110;
  const x = Math.max(8, Math.min(92, 50 + (dx / spreadKm) * 40));
  const y = Math.max(8, Math.min(92, 50 + (dy / spreadKm) * 40));
  return { x, y };
}
