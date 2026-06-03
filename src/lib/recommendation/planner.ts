export { buildWeekendPlan } from "./plan-api";
import type { WeekendPlan } from "./types";

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
