import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SAVED_GUIDES_STORAGE_KEY = "weekendmiao_saved_guides";
const FAVORITE_TRIPS_STORAGE_KEY = "weekendmiao_favorite_trips";

function loadSavedGuidesFromStorage(): SavedGuide[] {
  try {
    const raw = localStorage.getItem(SAVED_GUIDES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedGuide[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadFavoriteTripsFromStorage(): FavoriteTrip[] {
  try {
    const raw = localStorage.getItem(FAVORITE_TRIPS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as FavoriteTrip[];
      return Array.isArray(parsed) ? parsed : [];
    }
    return INITIAL_FAVORITE_TRIPS;
  } catch {
    return INITIAL_FAVORITE_TRIPS;
  }
}

/** 探索页收藏的攻略 */
export interface SavedGuide {
  id: string;
  title: string;
  author: string;
  image: string;
  tags: string[];
}

/** 行程页收藏的行程方案 */
export interface FavoriteTrip {
  id: string;
  title: string;
  dates: string;
  days: {
    day: number;
    date: string;
    period: string;
    items: {
      id: string;
      time: string;
      name: string;
      type: "scenic" | "food" | "hotel";
      description: string;
      price: string;
      status: "unbooked" | "pending" | "completed" | "expired";
      code?: string;
    }[];
  }[];
  active: boolean;
  favorited: boolean;
}

const INITIAL_FAVORITE_TRIPS: FavoriteTrip[] = [
  {
    id: "f1",
    title: "上周末亲子游方案",
    dates: "周六下午，共3小时",
    active: false,
    favorited: true,
    days: [
      {
        day: 1,
        date: "周六下午",
        period: "亲子半日",
        items: [
          {
            id: "f1-1",
            time: "14:00",
            name: "朝阳公园",
            type: "scenic",
            description: "草坪+儿童游乐",
            price: "免费",
            status: "completed",
          },
          {
            id: "f1-2",
            time: "17:00",
            name: "西贝莜面村",
            type: "food",
            description: "儿童椅+亲子餐",
            price: "人均¥110",
            status: "pending",
            code: "MT20250501-1201",
          },
        ],
      },
    ],
  },
  {
    id: "f2",
    title: "朋友聚会包吹方案",
    dates: "周日下午，共4人",
    active: false,
    favorited: true,
    days: [
      {
        day: 1,
        date: "周日下午",
        period: "朋友小聚",
        items: [
          {
            id: "f2-1",
            time: "15:00",
            name: "798艺术区",
            type: "scenic",
            description: "展览+街拍",
            price: "免费",
            status: "completed",
          },
          {
            id: "f2-2",
            time: "18:30",
            name: "云海肴（云南菜）",
            type: "food",
            description: "汽锅鸡，四人分享",
            price: "人均¥120",
            status: "unbooked",
          },
        ],
      },
    ],
  },
];

type CollectionsContextValue = {
  favoriteTrips: FavoriteTrip[];
  savedGuides: SavedGuide[];
  totalFavoriteCount: number;
  isGuideSaved: (id: string) => boolean;
  toggleGuideSave: (guide: SavedGuide) => boolean;
  removeFavoriteTrip: (tripId: string) => void;
  removeSavedGuide: (guideId: string) => void;
};

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [favoriteTrips, setFavoriteTrips] = useState<FavoriteTrip[]>(loadFavoriteTripsFromStorage);
  const [savedGuides, setSavedGuides] = useState<SavedGuide[]>(loadSavedGuidesFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITE_TRIPS_STORAGE_KEY, JSON.stringify(favoriteTrips));
    } catch {
      /* ignore */
    }
  }, [favoriteTrips]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_GUIDES_STORAGE_KEY, JSON.stringify(savedGuides));
    } catch {
      /* ignore */
    }
  }, [savedGuides]);

  const isGuideSaved = useCallback(
    (id: string) => savedGuides.some((g) => g.id === id),
    [savedGuides],
  );

  const toggleGuideSave = useCallback((guide: SavedGuide) => {
    let nowSaved = false;
    setSavedGuides((prev) => {
      const exists = prev.some((g) => g.id === guide.id);
      if (exists) {
        nowSaved = false;
        return prev.filter((g) => g.id !== guide.id);
      }
      nowSaved = true;
      return [...prev, guide];
    });
    return nowSaved;
  }, []);

  const removeFavoriteTrip = useCallback((tripId: string) => {
    setFavoriteTrips((prev) => prev.filter((t) => t.id !== tripId));
  }, []);

  const removeSavedGuide = useCallback((guideId: string) => {
    setSavedGuides((prev) => prev.filter((g) => g.id !== guideId));
  }, []);

  const totalFavoriteCount = favoriteTrips.length + savedGuides.length;

  const value = useMemo(
    () => ({
      favoriteTrips,
      savedGuides,
      totalFavoriteCount,
      isGuideSaved,
      toggleGuideSave,
      removeFavoriteTrip,
      removeSavedGuide,
    }),
    [
      favoriteTrips,
      savedGuides,
      totalFavoriteCount,
      isGuideSaved,
      toggleGuideSave,
      removeFavoriteTrip,
      removeSavedGuide,
    ],
  );

  return (
    <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(CollectionsContext);
  if (!ctx) {
    throw new Error("useCollections must be used within CollectionsProvider");
  }
  return ctx;
}
