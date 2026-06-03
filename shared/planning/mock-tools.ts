import type { MockBooking, Poi, ToolTraceEntry } from "./types";

export function mockAttractionsNearby(
  homeLat: number,
  homeLng: number,
  radiusKm: number,
  count: number,
): ToolTraceEntry {
  return {
    tool: "attractions_nearby",
    input: { lat: homeLat, lng: homeLng, radius_km: radiusKm, limit: count },
    output: { ok: true, count },
  };
}

export function mockRestaurantsSearch(filters: Record<string, unknown>): ToolTraceEntry {
  return {
    tool: "restaurants_search",
    input: filters,
    output: { ok: true },
  };
}

export function mockQueueStatus(poi: Poi): { trace: ToolTraceEntry; queueMin: number } {
  return {
    queueMin: poi.queueMin,
    trace: {
      tool: "queue_status",
      input: { place_id: poi.id, name: poi.name },
      output: { queue_min: poi.queueMin, tables_left: poi.tablesLeft },
    },
  };
}

export function mockHoldTable(poi: Poi, party: number): { booking: MockBooking; trace: ToolTraceEntry } {
  const ok = poi.tablesLeft !== 0;
  return {
    booking: {
      type: "hold_table",
      placeId: poi.id,
      placeName: poi.name,
      status: ok ? "ok" : "queued",
      detail: ok ? `已为${party}人预留座位` : `需排队约${poi.queueMin}分钟，已取号`,
    },
    trace: {
      tool: "hold_table",
      input: { place_id: poi.id, party },
      output: { success: ok, tables_left: poi.tablesLeft },
    },
  };
}

export function mockPreorderBundle(poiName: string): { booking: MockBooking; trace: ToolTraceEntry } {
  return {
    booking: {
      type: "preorder",
      placeId: "preorder-cake",
      placeName: poiName,
      status: "pending",
      detail: "生日蛋糕/鲜花可送至餐厅（Mock 已创建预购单）",
    },
    trace: {
      tool: "preorder_bundle",
      input: { delivery: "restaurant" },
      output: { order_id: "MOCK-PO-001" },
    },
  };
}

export function mockNotifyContact(text: string, contact = "老婆"): ToolTraceEntry {
  return {
    tool: "notify_contact",
    input: { contact },
    output: { message: text },
  };
}
