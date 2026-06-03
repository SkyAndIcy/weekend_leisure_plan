import type { HomeAnchor, Poi } from "./types.ts";

/** 北京市大致范围（含郊区 Mock 演示） */
export const BEIJING_BOUNDS = {
  minLat: 39.42,
  maxLat: 40.45,
  minLng: 115.42,
  maxLng: 117.12,
};

export interface BeijingZone {
  id: string;
  area: string;
  district: string;
  lat: number;
  lng: number;
  /** 地址/口语关键词，用于出发点与话术匹配 */
  keywords: string[];
}

/** 覆盖北京 16 区及主要商圈（Mock 演示；生产接 LBS/美团检索） */
export const BEIJING_ZONES: BeijingZone[] = [
  { id: "slt", area: "三里屯", district: "朝阳区", lat: 39.9345, lng: 116.4543, keywords: ["三里屯", "太古里", "工体"] },
  { id: "wj", area: "望京", district: "朝阳区", lat: 39.988, lng: 116.492, keywords: ["望京", "酒仙桥", "798"] },
  { id: "gm", area: "国贸", district: "朝阳区", lat: 39.909, lng: 116.46, keywords: ["国贸", "CBD", "大望路", "建外"] },
  { id: "cyp", area: "朝阳公园", district: "朝阳区", lat: 39.9342, lng: 116.4734, keywords: ["朝阳公园", "蓝色港湾"] },
  { id: "sj", area: "双井", district: "朝阳区", lat: 39.895, lng: 116.46, keywords: ["双井", "富力城", "九龙山"] },
  { id: "cy", area: "常营", district: "朝阳区", lat: 39.925, lng: 116.6, keywords: ["常营", "管庄", "传媒大学"] },
  { id: "as", area: "奥森", district: "朝阳区", lat: 40.0178, lng: 116.3972, keywords: ["奥森", "奥林匹克森林公园", "北苑"] },
  { id: "zgc", area: "中关村", district: "海淀区", lat: 39.983, lng: 116.316, keywords: ["中关村", "创业大街", "海淀黄庄"] },
  { id: "wdk", area: "五道口", district: "海淀区", lat: 39.992, lng: 116.338, keywords: ["五道口", "清华", "北大"] },
  { id: "gzf", area: "公主坟", district: "海淀区", lat: 39.907, lng: 116.31, keywords: ["公主坟", "万寿路", "翠微"] },
  { id: "sd", area: "上地", district: "海淀区", lat: 40.03, lng: 116.31, keywords: ["上地", "西二旗", "清河"] },
  { id: "wjf", area: "王府井", district: "东城区", lat: 39.914, lng: 116.41, keywords: ["王府井", "东单", "灯市口"] },
  { id: "yhg", area: "雍和宫", district: "东城区", lat: 39.947, lng: 116.417, keywords: ["雍和宫", "东四", "北新桥"] },
  { id: "tt", area: "天坛", district: "东城区", lat: 39.883, lng: 116.407, keywords: ["天坛", "永定门", "蒲黄榆"] },
  { id: "xd", area: "西单", district: "西城区", lat: 39.913, lng: 116.374, keywords: ["西单", "复兴门", "灵境胡同"] },
  { id: "jrx", area: "金融街", district: "西城区", lat: 39.915, lng: 116.36, keywords: ["金融街", "阜成门", "车公庄"] },
  { id: "sch", area: "什刹海", district: "西城区", lat: 39.94, lng: 116.386, keywords: ["什刹海", "后海", "鼓楼"] },
  { id: "dwy", area: "动物园", district: "西城区", lat: 39.942, lng: 116.34, keywords: ["动物园", "西直门", "新街口"] },
  { id: "lz", area: "丽泽", district: "丰台区", lat: 39.867, lng: 116.32, keywords: ["丽泽", "菜户营", "丰台科技园"] },
  { id: "fz", area: "方庄", district: "丰台区", lat: 39.866, lng: 116.44, keywords: ["方庄", "蒲黄榆", "宋家庄"] },
  { id: "ftz", area: "丰台站", district: "丰台区", lat: 39.85, lng: 116.38, keywords: ["丰台", "丰台站", "看丹桥"] },
  { id: "sg", area: "首钢", district: "石景山区", lat: 39.91, lng: 116.14, keywords: ["首钢", "石景山", "八角", "古城"] },
  { id: "tz", area: "通州运河", district: "通州区", lat: 39.91, lng: 116.66, keywords: ["通州", "运河", "梨园", "北关"] },
  { id: "hlg", area: "回龙观", district: "昌平区", lat: 40.07, lng: 116.33, keywords: ["回龙观", "霍营", "龙泽"] },
  { id: "tty", area: "天通苑", district: "昌平区", lat: 40.07, lng: 116.41, keywords: ["天通苑", "立水桥", "北七家"] },
  { id: "yz", area: "亦庄", district: "大兴区", lat: 39.8, lng: 116.51, keywords: ["亦庄", "荣京东街", "开发区"] },
  { id: "hc", area: "黄村", district: "大兴区", lat: 39.74, lng: 116.34, keywords: ["黄村", "大兴", "枣园"] },
  { id: "sy", area: "顺义城区", district: "顺义区", lat: 40.13, lng: 116.66, keywords: ["顺义", "后沙峪", "天竺"] },
  { id: "lx", area: "良乡", district: "房山区", lat: 39.735, lng: 116.14, keywords: ["良乡", "房山", "长阳"] },
  { id: "mtg", area: "门头沟城区", district: "门头沟区", lat: 39.94, lng: 116.1, keywords: ["门头沟", "永定", "上岸"] },
  { id: "hr", area: "怀柔城区", district: "怀柔区", lat: 40.32, lng: 116.63, keywords: ["怀柔", "雁栖湖"] },
  { id: "pg", area: "平谷城区", district: "平谷区", lat: 40.14, lng: 117.12, keywords: ["平谷"] },
  { id: "my", area: "密云城区", district: "密云区", lat: 40.37, lng: 116.84, keywords: ["密云"] },
  { id: "yq", area: "延庆城区", district: "延庆区", lat: 40.46, lng: 115.97, keywords: ["延庆"] },
];

export function isInGreaterBeijing(lat: number, lng: number): boolean {
  return (
    lat >= BEIJING_BOUNDS.minLat &&
    lat <= BEIJING_BOUNDS.maxLat &&
    lng >= BEIJING_BOUNDS.minLng &&
    lng <= BEIJING_BOUNDS.maxLng
  );
}

export function zoneAnchor(z: BeijingZone): HomeAnchor {
  return { label: `北京市${z.district}·${z.area}`, lat: z.lat, lng: z.lng };
}

/** 从地址/地点文案匹配商圈（优先最长关键词，避免「丰台」误匹配） */
export function resolveZoneFromText(blob: string): BeijingZone | null {
  let best: BeijingZone | null = null;
  let bestLen = 0;
  for (const z of BEIJING_ZONES) {
    for (const kw of z.keywords) {
      if (blob.includes(kw) && kw.length > bestLen) {
        best = z;
        bestLen = kw.length;
      }
    }
    if (blob.includes(z.area) && z.area.length > bestLen) {
      best = z;
      bestLen = z.area.length;
    }
  }
  if (best) return best;
  for (const z of BEIJING_ZONES) {
    if (blob.includes(z.district.replace("区", ""))) return z;
  }
  if (/北京/.test(blob)) return BEIJING_ZONES[0];
  return null;
}

/** 坐标吸附最近商圈（全城） */
export function nearestBeijingZone(lat: number, lng: number, maxKm = 35): BeijingZone | null {
  let best: BeijingZone | null = null;
  let bestKm = Infinity;
  for (const z of BEIJING_ZONES) {
    const d = haversineKm(lat, lng, z.lat, z.lng);
    if (d < bestKm) {
      bestKm = d;
      best = z;
    }
  }
  return bestKm <= maxKm ? best : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** 按区域生成 Mock POI（每区至少 1 玩 + 1 吃，部分有加项） */
export function buildBeijingPoiCatalog(): Poi[] {
  const pois: Poi[] = [];
  for (let i = 0; i < BEIJING_ZONES.length; i++) {
    const z = BEIJING_ZONES[i];
    const familyBias = i % 2 === 0;
    pois.push({
      id: `a-${z.id}`,
      name: `${z.area}城市公园`,
      category: "attraction",
      lat: z.lat + 0.003,
      lng: z.lng - 0.004,
      district: z.district,
      area: z.area,
      tags: familyBias ? ["family_child", "outdoor", "light_walk"] : ["friends_social", "photo", "indoor_outdoor"],
      avgPrice: 0,
      durationMin: 70 + (i % 3) * 10,
      description: `${z.district}${z.area}附近散步遛娃/小聚`,
      tablesLeft: -1,
      queueMin: 0,
    });
    pois.push({
      id: `r-${z.id}`,
      name: `${z.area}·本地小馆`,
      category: "restaurant",
      lat: z.lat - 0.002,
      lng: z.lng + 0.003,
      district: z.district,
      area: z.area,
      tags: familyBias
        ? ["family_child", "kids_menu"]
        : ["friends_social", "share_plates"],
      avgPrice: 60 + (i % 5) * 20,
      durationMin: 55 + (i % 4) * 5,
      description: `${z.area}商圈聚餐，支持订座`,
      tablesLeft: (i % 5) + 1,
      queueMin: (i % 3) * 8,
    });
    if (z.id === "wj") {
      pois.push({
        id: "a-wj-798",
        name: "798艺术区",
        category: "attraction",
        lat: z.lat + 0.002,
        lng: z.lng + 0.006,
        district: z.district,
        area: z.area,
        tags: ["family_child", "photo", "art", "indoor_outdoor"],
        avgPrice: 0,
        durationMin: 90,
        description: "艺术区涂鸦与户外装置，适合亲子拍照探索",
        tablesLeft: -1,
        queueMin: 0,
      });
    }
    if (i % 4 === 0) {
      pois.push({
        id: `e-${z.id}`,
        name: `${z.area}步行街`,
        category: "extra",
        lat: z.lat + 0.001,
        lng: z.lng + 0.005,
        district: z.district,
        area: z.area,
        tags: ["citywalk", "snack", familyBias ? "family_child" : "friends_social"],
        avgPrice: 35,
        durationMin: 45,
        description: `餐后${z.area}闲逛收尾`,
        tablesLeft: -1,
        queueMin: 0,
      });
    }
  }
  return pois;
}

/** 地点选择页：全城可搜商圈 */
export function zonesAsPickList(): { id: string; name: string; detail: string; lat: number; lng: number }[] {
  return BEIJING_ZONES.map((z) => ({
    id: z.id,
    name: z.area,
    detail: `北京市${z.district}${z.area}`,
    lat: z.lat,
    lng: z.lng,
  }));
}
