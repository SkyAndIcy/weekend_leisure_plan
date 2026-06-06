/** 地图路线出发点（可独立于行程站点修改） */
export interface MapDeparturePoint {
  label: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface MapPoint {
  id: string;
  name: string;
  type: "scenic" | "food" | "hotel";
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  inRoute: boolean;
  description?: string;
  price?: string;
}
