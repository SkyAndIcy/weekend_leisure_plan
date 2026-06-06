import { POI_CATALOG } from "./poi-catalog.ts";
import { runPlanningDag } from "./pipeline/dag-orchestrator.ts";
import { routePatternLabel } from "./route-pattern.ts";
import {
  buildNotifyText,
  buildTimeline,
  pickSecondPlay,
} from "./timeline-builder.ts";
import {
  mockHoldTable,
  mockNotifyContact,
  mockPreorderBundle,
  mockQueueStatus,
} from "./mock-tools.ts";
import type { SemanticResolver } from "./semantic-types.ts";
import type { RoutePattern } from "./route-pattern.ts";
import type { WeekendPlan } from "./types.ts";

/** 规则 DAG + Mock 履约，生成 WeekendPlan（语义由 resolveSemantic 注入） */
export async function buildWeekendPlanCore(
  userText: string,
  location: { fullAddress?: string; displayName?: string; coords?: { lat: number; lng: number } },
  resolveSemantic: SemanticResolver,
): Promise<WeekendPlan> {
  const dag = await runPlanningDag(
    userText,
    location,
    {
      attractions: POI_CATALOG.filter((p) => p.category === "attraction"),
      restaurants: POI_CATALOG.filter((p) => p.category === "restaurant"),
      extras: POI_CATALOG.filter((p) => p.category === "extra"),
    },
    resolveSemantic,
  );

  const { effective, pools, combo, home, graphTrace, edges, toolTrace } = dag;

  const play = combo.play.poi;
  const eat = combo.eat.poi;
  const extra = combo.extra?.poi ?? null;
  const bookings = [];
  const queue = mockQueueStatus(eat);
  toolTrace.push(queue.trace);

  const party = effective.partyTotal ?? (effective.scenario === "friends" ? 4 : 3);
  const hold = mockHoldTable(eat, party);
  toolTrace.push(hold.trace);

  if (effective.scenario === "family" && /蛋糕|鲜花|生日/.test(userText)) {
    const pre = mockPreorderBundle(eat.name);
    bookings.push(pre.booking);
    toolTrace.push(pre.trace);
  }

  let pattern: RoutePattern = effective.routePattern;
  let play2 = null;
  if (pattern === "play_eat_play" || pattern === "eat_play_play") {
    play2 = pickSecondPlay(pools.attraction, play.id);
    if (!play2) {
      pattern =
        pattern === "eat_play_play"
          ? "eat_play"
          : effective.wantExtra
            ? "play_eat_extra"
            : "play_eat";
    }
  }

  const useExtra = pattern === "play_eat_extra" ? extra : null;

  const departMin = effective.departureHour * 60;
  const timelineFixed = buildTimeline({
    pattern,
    mealKind: effective.mealKind,
    departMin,
    play,
    eat,
    extra: useExtra,
    play2,
    queueMin: queue.queueMin,
  });

  const patternLabel = routePatternLabel(pattern);
  const notifyText = buildNotifyText(timelineFixed, effective.mealKind, patternLabel);
  toolTrace.push(mockNotifyContact(notifyText));

  const scenarioLabel = effective.scenario === "family" ? "家庭亲子" : "朋友小聚";
  const mealLabel = effective.mealKind === "lunch" ? "午餐" : "晚餐";

  const pipelineTrace = graphTrace.map((n) => ({
    stage: n.stage,
    nameZh: n.nameZh,
    inputCount: n.inputCount,
    outputCount: n.outputCount,
    note: `[${n.kind}/${n.status}] deps=${n.deps.join(",")} ${n.note ?? ""}`.trim(),
    sampleIds: n.sampleIds,
    dropped: n.dropped,
  }));

  return {
    summary: `${scenarioLabel} · ${patternLabel} · ${mealLabel} · ${effective.durationHours[0]}-${effective.durationHours[1]}小时 · ${effective.hardMaxDistanceKm}km内`,
    scenario: effective.scenario,
    homeLabel: home.label,
    homeLat: home.lat,
    homeLng: home.lng,
    constraints: effective,
    timeline: timelineFixed,
    bookings,
    toolTrace,
    notifyText,
    recalledCount: {
      attraction: pools.attraction.length,
      restaurant: pools.restaurant.length,
      extra: pools.extra.length,
    },
    recommendMode: "semantic+dag-recall+combo",
    aiRationale: effective.intentSummary,
    pipelineTrace,
    dagEdges: edges,
    comboBreakdown: combo.breakdown,
  };
}
