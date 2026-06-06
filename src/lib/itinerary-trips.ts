import type { DayPlan } from "@/types/itinerary";

export const ITINERARY_TRIPS_STORAGE_KEY = "weekendmiao_itinerary_trips";
export const ITINERARY_TRIPS_UPDATED_EVENT = "weekendmiao:itinerary-trips-updated";

export interface ItineraryTrip {
  id: string;
  title: string;
  dates: string;
  days: DayPlan[];
  active: boolean;
  favorited?: boolean;
}

export function loadItineraryTrips(): ItineraryTrip[] {
  try {
    const raw = localStorage.getItem(ITINERARY_TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ItineraryTrip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItineraryTrips(trips: ItineraryTrip[]): void {
  try {
    localStorage.setItem(ITINERARY_TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch {
    /* quota / private mode */
  }
}

function notifyItineraryTripsUpdated(): void {
  window.dispatchEvent(new CustomEvent(ITINERARY_TRIPS_UPDATED_EVENT));
}

/** 同步 active trip 的 days（用于 chat 侧预定/换店/删除后反向更新） */
export function syncActiveTripDays(days: DayPlan[]): void {
  const trips = loadItineraryTrips();
  const activeIdx = trips.findIndex((t) => t.active);
  if (activeIdx < 0) return;
  const updated = [...trips];
  updated[activeIdx] = { ...updated[activeIdx], days: structuredClone(days) };
  saveItineraryTrips(updated);
  notifyItineraryTripsUpdated();
}

/** 将问小喵当前规划写入行程 Tab，并设为 active */
export function addChatPlanToItineraryTrips(opts: {
  days: DayPlan[];
  title?: string;
  dates?: string;
}): ItineraryTrip {
  const days = structuredClone(opts.days);
  const trip: ItineraryTrip = {
    id: `chat-${Date.now()}`,
    title: opts.title?.trim() || days[0]?.period || "周末半日行程",
    dates: opts.dates?.trim() || days[0]?.date || "今天",
    days,
    active: true,
    favorited: false,
  };

  const prev = loadItineraryTrips().map((t) => ({ ...t, active: false }));
  const withoutDup = prev.filter((t) => t.id !== trip.id);
  saveItineraryTrips([trip, ...withoutDup]);
  notifyItineraryTripsUpdated();
  return trip;
}
