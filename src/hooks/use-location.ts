import { useState, useCallback } from "react";
import {
  nearestAreaAnchor,
  resolveAnchorFromText,
  shortAreaLabel,
} from "@/lib/recommendation/geo";

export interface SavedAddress {
  id: string;
  label: string;
  name: string;
  detail: string;
  tag?: "家" | "公司" | string;
  lat?: number;
  lng?: number;
}

export type LocationStatus = "idle" | "locating" | "located" | "denied" | "manual";

export interface LocationState {
  status: LocationStatus;
  displayName: string;
  fullAddress: string;
  coords?: { lat: number; lng: number };
}

const STORAGE_KEY = "zhoumoumiao_location";
const ADDRESSES_KEY = "zhoumoumiao_saved_addresses";

const DEFAULT_ADDRESSES: SavedAddress[] = [
  {
    id: "home",
    label: "家",
    name: "三里屯太古里",
    detail: "北京市朝阳区三里屯路19号",
    tag: "家",
    lat: 39.9345,
    lng: 116.4543,
  },
  {
    id: "work",
    label: "公司",
    name: "中关村创业大街",
    detail: "北京市海淀区中关村大街18号",
    tag: "公司",
    lat: 39.983,
    lng: 116.316,
  },
];

function isValidSavedLocation(saved: LocationState | null): saved is LocationState {
  if (!saved) return false;
  if (saved.status !== "located" && saved.status !== "manual") return false;
  return Boolean(saved.displayName?.trim() || saved.fullAddress?.trim() || saved.coords);
}

function loadLocation(): LocationState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocationState) : null;
    return isValidSavedLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocation(loc: LocationState) {
  try {
    if (loc.status === "located" || loc.status === "manual") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    }
  } catch {
    /* ignore */
  }
}

export function loadSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ADDRESSES;
  } catch {
    return DEFAULT_ADDRESSES;
  }
}

export function saveAddresses(addresses: SavedAddress[]) {
  try {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  } catch {
    /* ignore */
  }
}

function locationFromGps(lat: number, lng: number): LocationState {
  const anchor = nearestAreaAnchor(lat, lng);
  if (anchor) {
    return {
      status: "located",
      displayName: shortAreaLabel(anchor),
      fullAddress: anchor.label,
      coords: { lat, lng },
    };
  }
  return {
    status: "located",
    displayName: "当前位置",
    fullAddress: `当前位置（${lat.toFixed(4)}, ${lng.toFixed(4)}）`,
    coords: { lat, lng },
  };
}

function locationFromPick(
  name: string,
  detail: string,
  coords?: { lat: number; lng: number },
): LocationState {
  const blob = `${name}${detail}`;
  const anchor = coords
    ? nearestAreaAnchor(coords.lat, coords.lng) ?? resolveAnchorFromText(blob)
    : resolveAnchorFromText(blob);

  if (coords) {
    return {
      status: "manual",
      displayName: name,
      fullAddress: detail || name,
      coords,
    };
  }

  if (anchor) {
    return {
      status: "manual",
      displayName: name,
      fullAddress: detail || anchor.label,
      coords: { lat: anchor.lat, lng: anchor.lng },
    };
  }

  return {
    status: "manual",
    displayName: name,
    fullAddress: detail || name,
  };
}

/** 弹窗里「家附近 / 公司附近」等快捷文案 → 已保存地址或商圈 */
export function resolveManualInput(text: string): {
  name: string;
  detail: string;
  coords?: { lat: number; lng: number };
} {
  const t = text.trim();
  const saved = loadSavedAddresses();

  if (/家/.test(t) && !/公司/.test(t)) {
    const home = saved.find((a) => a.tag === "家");
    if (home) {
      return {
        name: home.name,
        detail: home.detail,
        coords:
          home.lat != null && home.lng != null
            ? { lat: home.lat, lng: home.lng }
            : undefined,
      };
    }
  }

  if (/公司|上班|工位/.test(t)) {
    const work = saved.find((a) => a.tag === "公司");
    if (work) {
      return {
        name: work.name,
        detail: work.detail,
        coords:
          work.lat != null && work.lng != null
            ? { lat: work.lat, lng: work.lng }
            : undefined,
      };
    }
  }

  const anchor = resolveAnchorFromText(t);
  if (anchor) {
    return {
      name: shortAreaLabel(anchor),
      detail: anchor.label,
      coords: { lat: anchor.lat, lng: anchor.lng },
    };
  }

  return { name: t, detail: t };
}

export function useLocation() {
  const [location, setLocationState] = useState<LocationState>(() => {
    const saved = loadLocation();
    return saved ?? { status: "idle", displayName: "", fullAddress: "" };
  });

  const updateLocation = useCallback((loc: LocationState) => {
    setLocationState(loc);
    saveLocation(loc);
  }, []);

  /** 用户点击后触发 GPS（避免页面加载时静默请求被浏览器拒绝） */
  const requestGPS = useCallback(() => {
    updateLocation({ status: "locating", displayName: "定位中…", fullAddress: "" });

    if (!navigator.geolocation) {
      updateLocation({
        status: "denied",
        displayName: "浏览器不支持定位",
        fullAddress: "",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(
          locationFromGps(pos.coords.latitude, pos.coords.longitude),
        );
      },
      (err) => {
        const hint =
          err.code === 1
            ? "未授权定位，请手动选点"
            : err.code === 3
              ? "定位超时，请手动选点"
              : "定位失败，请手动选点";
        updateLocation({ status: "denied", displayName: hint, fullAddress: "" });
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 60_000 },
    );
  }, [updateLocation]);

  const selectAddress = useCallback(
    (
      name: string,
      detail: string,
      coords?: { lat: number; lng: number },
    ) => {
      updateLocation(locationFromPick(name, detail, coords));
    },
    [updateLocation],
  );

  const selectManualText = useCallback(
    (text: string) => {
      const pick = resolveManualInput(text);
      updateLocation(locationFromPick(pick.name, pick.detail, pick.coords));
    },
    [updateLocation],
  );

  return { location, requestGPS, selectAddress, selectManualText, updateLocation };
}
