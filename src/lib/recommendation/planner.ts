import { POI_CATALOG } from "@/data/poi-catalog";
import { runPlanningDag } from "./pipeline/dag-orchestrator";
import {
  mockHoldTable,
  mockNotifyContact,
  mockPreorderBundle,
  mockQueueStatus,
} from "./mock-tools";
import type { TimelineSlot, WeekendPlan } from "./types";

function fmtClock(totalMin: number): string {
  const t = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export async function buildWeekendPlan(
  userText: string,
  location: { fullAddress?: string; displayName?: string; coords?: { lat: number; lng: number } },
): Promise<WeekendPlan> {
  const dag = await runPlanningDag(userText, location, {
    attractions: POI_CATALOG.filter((p) => p.category === "attraction"),
    restaurants: POI_CATALOG.filter((p) => p.category === "restaurant"),
    extras: POI_CATALOG.filter((p) => p.category === "extra"),
  });

  const { effective, pools, combo, home, graphTrace, edges, retryCount, toolTrace } = dag;

  const play = combo.play.poi;
  const eat = combo.eat.poi;
  const extra = combo.extra?.poi ?? null;
  const ruleNote = "（DAG编排·并行召回+跨池联动+反馈环）";

  const bookings = [];
  const queue = mockQueueStatus(eat);
  toolTrace.push(queue.trace);

  const party = effective.partyTotal ?? (effective.scenario === "friends" ? 4 : 3);
  const hold = mockHoldTable(eat, party);
  bookings.push(hold.booking);
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
      notes: `${play.description}${ruleNote}，直线约${combo.play.distanceKm.toFixed(1)}km`,
    },
    {
      start: fmtClock(playEnd + transit1),
      end: fmtClock(eatEnd),
      phase: "eat",
      poi: eat,
      notes:
        hold.booking.status === "ok"
          ? `已订座；${queue.queueMin > 0 ? `预计排队${queue.queueMin}分钟` : "无需排队"}${ruleNote}，顺路${combo.routeKm.toFixed(1)}km`
          : `${hold.booking.detail}${ruleNote}`,
    },
  ];

  if (extra) {
    timeline.push({
      start: fmtClock(eatEnd + transit2),
      end: fmtClock(extraEnd),
      phase: "extra",
      poi: extra,
      notes: `${extra.description}${ruleNote}`,
    });
  }

  const departPhrase =
    effective.departureHour < 12
      ? `上午${effective.departureHour}点`
      : effective.departureHour === 12
        ? "中午12点"
        : `下午${effective.departureHour}点`;

  const notifyText = `搞定了，${departPhrase}出发：先去${play.name}（${fmtClock(departMin)}-${fmtClock(playEnd)}），再去${eat.name}吃饭（${hold.booking.detail}）${extra ? `，最后${extra.name}收尾` : ""}。`;

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
    summary: `${scenarioLabel} · ${effective.durationHours[0]}-${effective.durationHours[1]}小时 · ${effective.hardMaxDistanceKm}km内 · DAG编排（反馈${retryCount}次）`,
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

/** Structured context for LLM polish layer (must not invent POIs outside this list). */
export function planContextForLlm(plan: WeekendPlan): string {
  const slots = plan.timeline
    .map(
      (s) =>
        `- ${s.phase.toUpperCase()} ${s.start}-${s.end} | ${s.poi.name} | ${s.notes} | tags:${s.poi.tags.join(",")}`,
    )
    .join("\n");
  const books = plan.bookings.map((b) => `- ${b.type}: ${b.placeName} → ${b.detail}`).join("\n");
  const pipeline = plan.pipelineTrace
    ?.map((s) => `- [${s.nameZh}] ${s.inputCount}→${s.outputCount} ${s.note ?? ""}`)
    .join("\n");
  const dag = plan.dagEdges?.map((e) => `- ${e.from} → ${e.to}${e.label ? ` (${e.label})` : ""}`).join("\n");
  const combo = plan.comboBreakdown
    ? `组合得分拆解: 玩${plan.comboBreakdown.playScore?.toFixed(1)} 吃${plan.comboBreakdown.eatScore?.toFixed(1)} 路程罚${plan.comboBreakdown.routePenalty?.toFixed(1)} 时间罚${plan.comboBreakdown.timePenalty?.toFixed(1)}`
    : "";
  return [
    `推荐模式: ${plan.recommendMode}`,
    plan.aiRationale ? `AI语义理解: ${plan.aiRationale}` : "",
    `场景: ${plan.scenario}`,
    `出发点: ${plan.homeLabel}`,
    `约束: ${plan.constraints.rawGoal}`,
    `召回池: 景点${plan.recalledCount.attraction} 餐厅${plan.recalledCount.restaurant} 加项${plan.recalledCount.extra}`,
    combo,
    dag ? `DAG边:\n${dag}` : "",
    pipeline ? `DAG节点:\n${pipeline}` : "",
    "时间轴:",
    slots,
    "Mock执行:",
    books,
    `通知文案: ${plan.notifyText}`,
  ]
    .filter(Boolean)
    .join("\n");
}
