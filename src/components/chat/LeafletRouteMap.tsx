import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { enrichRoutePoints } from "@/lib/itinerary-route-sync";
import { wgs84ToGcj02LatLng } from "@/lib/map-coords";
import type { MapDeparturePoint, MapPoint } from "@/types/map";
import "leaflet/dist/leaflet.css";

const BEIJING_CENTER_GCJ: L.LatLngExpression = wgs84ToGcj02LatLng(39.9042, 116.4074);

/** 高德中文路网（演示用；生产建议申请正式 Key） */
const GAODE_TILE = {
  url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  subdomains: "1234",
  attribution:
    '&copy; <a href="https://www.amap.com/">高德地图</a>',
};

function FitBounds({ positions }: { positions: L.LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 14 });
  }, [positions, map]);
  return null;
}

function divIcon(html: string, size = 30): L.DivIcon {
  return L.divIcon({
    html,
    className: "leaflet-custom-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const typeDotColor = {
  scenic: "#3b82f6",
  food: "#f97316",
  hotel: "#a855f7",
};

type Props = {
  departurePoint?: MapDeparturePoint;
  routePoints: MapPoint[];
  selectedPointId?: string | null;
  onSelectPoint?: (point: MapPoint | null) => void;
};

const LeafletRouteMap = ({
  departurePoint,
  routePoints,
  selectedPointId,
  onSelectPoint,
}: Props) => {
  const routeWithCoords = useMemo(() => {
    const enriched = enrichRoutePoints(routePoints);
    return enriched.filter(
      (p): p is MapPoint & { lat: number; lng: number } =>
        typeof p.lat === "number" && typeof p.lng === "number",
    );
  }, [routePoints]);

  const polylinePositions = useMemo(() => {
    const pts: L.LatLngExpression[] = [];
    if (departurePoint) {
      pts.push(wgs84ToGcj02LatLng(departurePoint.lat, departurePoint.lng));
    }
    for (const p of routeWithCoords) {
      pts.push(wgs84ToGcj02LatLng(p.lat, p.lng));
    }
    return pts;
  }, [departurePoint, routeWithCoords]);

  const mapCenter = useMemo((): L.LatLngExpression => {
    if (departurePoint) return wgs84ToGcj02LatLng(departurePoint.lat, departurePoint.lng);
    if (routeWithCoords[0]) return wgs84ToGcj02LatLng(routeWithCoords[0].lat, routeWithCoords[0].lng);
    return BEIJING_CENTER_GCJ;
  }, [departurePoint, routeWithCoords]);

  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);

  useEffect(() => {
    if (polylinePositions.length < 2) {
      setRoadPolyline([]);
      return;
    }
    const pts = polylinePositions as [number, number][];
    // pts are [lat, lng] in GCJ02; Amap API expects "lng,lat"
    const toAmapCoord = ([lat, lng]: [number, number]) => `${lng},${lat}`;
    const origin = toAmapCoord(pts[0]);
    const destination = toAmapCoord(pts[pts.length - 1]);
    const middle = pts.slice(1, -1).map(toAmapCoord).join(";");
    const params = new URLSearchParams({ origin, destination });
    if (middle) params.set("waypoints", middle);

    let cancelled = false;
    fetch(`/api/amap-route?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; polyline?: string }) => {
        if (cancelled || !data.ok || !data.polyline) return;
        const coords = data.polyline.split(";").map((pair) => {
          const [lng, lat] = pair.split(",").map(Number);
          return [lat, lng] as [number, number];
        });
        setRoadPolyline(coords);
      })
      .catch(() => setRoadPolyline([]));
    return () => { cancelled = true; };
  }, [polylinePositions]);

  return (
    <div className="relative w-full overflow-hidden rounded-b-xl" style={{ height: 280 }}>
      <MapContainer
        center={mapCenter}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full z-0"
        attributionControl
      >
        <TileLayer
          attribution={GAODE_TILE.attribution}
          url={GAODE_TILE.url}
          subdomains={GAODE_TILE.subdomains}
          maxZoom={18}
        />
        <FitBounds positions={polylinePositions} />

        {(roadPolyline.length >= 2 ? roadPolyline : polylinePositions).length >= 2 && (
          <Polyline
            positions={roadPolyline.length >= 2 ? roadPolyline : polylinePositions}
            pathOptions={{
              color: "#f59e0b",
              weight: 4,
              opacity: 0.9,
              dashArray: roadPolyline.length >= 2 ? undefined : "8 6",
            }}
          />
        )}

        {departurePoint && (
          <Marker
            position={wgs84ToGcj02LatLng(departurePoint.lat, departurePoint.lng)}
            icon={divIcon(
              '<div style="width:28px;height:28px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">起</div>',
              28,
            )}
          >
            <Popup>
              <span className="text-xs font-semibold">出发点</span>
              <br />
              <span className="text-[11px]">{departurePoint.label}</span>
            </Popup>
          </Marker>
        )}

        {routeWithCoords.map((point, idx) => {
          const color = typeDotColor[point.type];
          const isSelected = selectedPointId === point.id;
          const ring = isSelected ? "outline:2px solid #f59e0b;outline-offset:2px;" : "";
          return (
            <Marker
              key={point.id}
              position={wgs84ToGcj02LatLng(point.lat, point.lng)}
              icon={divIcon(
                `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;${ring}">${idx + 1}</div>`,
                28,
              )}
              eventHandlers={{
                click: () => onSelectPoint?.(point.id === selectedPointId ? null : point),
              }}
            >
              <Popup>
                <span className="text-xs font-semibold">{point.name}</span>
                {point.description && (
                  <>
                    <br />
                    <span className="text-[11px] text-muted-foreground">{point.description}</span>
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-card/90 px-2 py-1 text-[9px] text-muted-foreground shadow-sm pointer-events-none max-w-[85%]">
        高德中文地图 · 起/1/2/3 为行程点
      </div>
    </div>
  );
};

export default LeafletRouteMap;
