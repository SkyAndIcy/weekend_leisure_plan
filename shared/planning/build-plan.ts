import { POI_CATALOG } from "./poi-catalog.ts";
import { runPlanningDag } from "./pipeline/dag-orchestrator.ts";
import {
  mockHoldTable,
  mockNotifyContact,
  mockPreorderBundle,
  mockQueueStatus,
} from "./mock-tools.ts";
import type { SemanticResolver } from "./semantic-types.ts";
import type { TimelineSlot, WeekendPlan } from "./types.ts";

function fmtClock(totalMin: number): string {
  const t = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

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

  const { effective, pools, combo, home, graphTrace, edges, retryCount, toolTrace } = dag;

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

  const departMin = effective.departureHour * 60;
  const playEnd = departMin + play.durationMin;
  const transit1 = 20;
  const eatEnd = playEnd + transit1 + eat.durationMin;
  const transit2 = 15;
  const extraEnd = eatEnd + transit2 + (extra?.durationMin ?? 45);

  const timeline: TimelineSlot[] = [
    {
      start: fmtClock(departMin),
      end: fmtClock(playEnd),
      phase: "play",
      poi: play,
      notes: play.description,
    },
    {
      start: fmtClock(playEnd + transit1),
      end: fmtClock(eatEnd),
      phase: "eat",
      poi: eat,
      notes:
        queue.queueMin > 0
          ? `推荐就餐，高峰约排队${queue.queueMin}分钟，请在行程表点击「立即预定」`
          : "推荐就餐，请在行程表点击「立即预定」",
    },
  ];

  if (extra) {
    timeline.push({
      start: fmtClock(eatEnd + transit2),
      end: fmtClock(extraEnd),
      phase: "extra",
      poi: extra,
      notes: extra.description,
    });
  }

  const departPhrase =
    effective.departureHour < 12
      ? `上午${effective.departureHour}点`
      : effective.departureHour === 12
        ? "中午12点"
        : `下午${effective.departureHour}点`;

  const notifyText = `搞定了，${departPhrase}出发：先去${play.name}（${fmtClock(departMin)}-${fmtClock(playEnd)}），再去${eat.name}用餐（记得在行程表点「立即预定」）${extra ? `，最后${extra.name}收尾` : ""}。`;

  toolTrace.push(mockNotifyContact(notifyText));

  const scenarioLabel = effective.scenario === "family" ? "家庭亲子" : "朋友小聚";

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
    summary: `${scenarioLabel} · ${effective.durationHours[0]}-${effective.durationHours[1]}小时 · ${effective.hardMaxDistanceKm}km内`,
    scenario: effective.scenario,
    homeLabel: home.label,
    homeLat: home.lat,
    homeLng: home.lng,
    constraints: effective,
    timeline,
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
