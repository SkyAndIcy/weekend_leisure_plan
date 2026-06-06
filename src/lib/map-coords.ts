import gcoord from "gcoord";

/** 行程 POI 存 WGS84；国内中文底图（高德等）使用 GCJ-02，展示前需转换 */
export function wgs84ToGcj02LatLng(lat: number, lng: number): [number, number] {
  const [gcjLng, gcjLat] = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.GCJ02);
  return [gcjLat, gcjLng];
}
