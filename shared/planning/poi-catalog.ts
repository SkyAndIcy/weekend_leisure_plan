import { buildBeijingPoiCatalog } from "./beijing-zones.ts";

/** Mock 北京全城 POI（16 区主要商圈）；生产环境替换为 LBS / 美团检索 API */
export const POI_CATALOG = buildBeijingPoiCatalog();
