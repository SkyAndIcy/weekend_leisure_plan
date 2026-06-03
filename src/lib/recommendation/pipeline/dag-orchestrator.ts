import { fetchAiSemanticExtract } from "../ai-semantic";
import { extractConstraints } from "../constraints";
import { resolveHome } from "../geo";
import {
  mockAttractionsNearby,
  mockRestaurantsSearch,
} from "../mock-tools";
import type { HomeAnchor, Poi, ToolTraceEntry } from "../types";
import { buildEffectiveConstraints } from "./constraint-pipeline";
import { boostRestaurantsByPlayAnchors } from "./cross-link";
import { evaluateComboRound, finalizeCombo } from "./combo-selector";
import type { DagEdge, DagNodeLog, DagRunResult } from "./types";
import { runParallelPoolRecall } from "./recall-pipeline";
import type { EffectiveConstraints, PipelineStageLog, RecallPools } from "./types";
import { SCENARIO_MIN_RELEVANCE } from "./types";

const MAX_DAG_RETRY = 2;

function logNode(
  trace: DagNodeLog[],
  node: Omit<DagNodeLog, "kind"> & { kind: DagNodeLog["kind"] },
  stage?: PipelineStageLog,
): void {
  trace.push(node);
  if (stage) {
    trace[trace.length - 1].inputCount = stage.inputCount;
    trace[trace.length - 1].outputCount = stage.outputCount;
    trace[trace.length - 1].note = [trace[trace.length - 1].note, stage.note].filter(Boolean).join("；");
    trace[trace.length - 1].sampleIds = stage.sampleIds;
    trace[trace.length - 1].dropped = stage.dropped;
  }
}

function relaxConstraints(c: EffectiveConstraints, reason: string): EffectiveConstraints {
  return {
    ...c,
    hardMaxDistanceKm: c.hardMaxDistanceKm + 2,
    maxDistanceKm: c.maxDistanceKm + 2,
    timeBudgetMin: {
      min: Math.max(120, c.timeBudgetMin.min - 30),
      max: c.timeBudgetMin.max + 45,
    },
    intentSummary: `${c.intentSummary} [DAG放宽:${reason}]`,
  };
}

function mergeStagesIntoNode(base: DagNodeLog, stages: PipelineStageLog[]): void {
  const last = stages[stages.length - 1];
  if (last) {
    base.inputCount = stages[0]?.inputCount ?? last.inputCount;
    base.outputCount = last.outputCount;
    base.note = stages.map((s) => s.nameZh).join(" → ");
  }
}

/**
 * DAG 编排：并行理解 → 并行召回 → 跨池联动 → 组合评估 → 条件反馈环 → 履约修补
 */
export async function runPlanningDag(
  userText: string,
  location: { fullAddress?: string; displayName?: string; coords?: { lat: number; lng: number } },
  catalog: { attractions: Poi[]; restaurants: Poi[]; extras: Poi[] },
): Promise<DagRunResult & { home: HomeAnchor; toolTrace: ToolTraceEntry[] }> {
  const edges: DagEdge[] = [];
  const graphTrace: DagNodeLog[] = [];
  const toolTrace: ToolTraceEntry[] = [];

  const edge = (from: string, to: string, label?: string) => {
    edges.push({ from, to, label });
  };

  edge("开始", "并行理解");

  // ── 并行分叉：规则 / 地理 / AI 语义 ──
  const [ruleConstraints, home, aiResult] = await Promise.all([
    Promise.resolve(extractConstraints(userText)),
    Promise.resolve(resolveHome(location)),
    fetchAiSemanticExtract(userText, {
      label: location.displayName || location.fullAddress,
      address: location.fullAddress,
    }),
  ]);

  if (ruleConstraints.scenario === "unknown") ruleConstraints.scenario = "family";
  toolTrace.push(aiResult.trace);

  logNode(graphTrace, {
    nodeId: "fork_understand",
    kind: "并行分叉",
    deps: ["开始"],
    status: "完成",
    stage: "fork_understand",
    nameZh: "并行理解（规则 ∥ 地理锚点 ∥ AI语义）",
    inputCount: 3,
    outputCount: 3,
    note: `规则场景=${ruleConstraints.scenario}；锚点=${home.label}`,
  });
  edge("并行理解", "约束汇聚");

  const { effective: baseEffective, stages: cStages } = buildEffectiveConstraints(
    ruleConstraints,
    aiResult.semantic,
  );
  let effective = { ...baseEffective };
  if (effective.scenario === "unknown") effective.scenario = "family";

  logNode(
    graphTrace,
    {
      nodeId: "join_constraints",
      kind: "汇聚",
      deps: ["fork_understand"],
      status: "完成",
      stage: "join_constraints",
      nameZh: "约束汇聚（融合+硬软拆分+冲突裁决）",
      inputCount: 2,
      outputCount: 1,
      note: cStages.map((s) => s.note).join("；"),
    },
    cStages[cStages.length - 1],
  );
  // 设计文档 2.2：约束汇聚后 mock attractions_nearby
  toolTrace.push(
    mockAttractionsNearby(home.lat, home.lng, effective.hardMaxDistanceKm, 8),
  );
  logNode(graphTrace, {
    nodeId: "mock_attractions_nearby",
    kind: "任务",
    deps: ["join_constraints"],
    status: "完成",
    stage: "mock_attractions_nearby",
    nameZh: "Mock·附近景点检索",
    inputCount: 1,
    outputCount: 1,
    note: `radius=${effective.hardMaxDistanceKm}km`,
  });
  edge("约束汇聚", "mock_attractions_nearby");
  edge("mock_attractions_nearby", "并行召回");

  let pools: RecallPools = {
    attraction: [],
    restaurant: [],
    extra: [],
  };
  let comboRound = evaluateComboRound(
    { attraction: [], restaurant: [], extra: [] },
    effective,
  );
  let retryCount = 0;

  for (let round = 0; round <= MAX_DAG_RETRY; round++) {
    const isRetry = round > 0;
    const recallNodeId = isRetry ? `反馈召回_${round}` : "并行召回";

    if (isRetry) {
      edge("组合评估", recallNodeId, "池空/超时");
      logNode(graphTrace, {
        nodeId: `loop_relax_${round}`,
        kind: "反馈环",
        deps: ["组合评估"],
        status: "重试",
        stage: `loop_relax_${round}`,
        nameZh: `反馈环·放宽约束（第${round}轮）`,
        inputCount: 1,
        outputCount: 1,
        note: `原因=${comboRound.failReason}；距离+2km，时间上限+45min`,
      });
      effective = relaxConstraints(effective, comboRound.failReason ?? "retry");
      edge(`loop_relax_${round}`, recallNodeId);
    }

    // ── 并行分叉：三池召回（加项池按 wantExtra 条件执行）──
    const parallel = await runParallelPoolRecall(
      catalog.attractions,
      catalog.restaurants,
      catalog.extras,
      home.lat,
      home.lng,
      effective,
      effective.wantExtra,
    );

    logNode(graphTrace, {
      nodeId: recallNodeId,
      kind: isRetry ? "反馈环" : "并行分叉",
      deps: isRetry ? [`loop_relax_${round}`, "mock_attractions_nearby"] : ["mock_attractions_nearby"],
      status: isRetry ? "重试" : "完成",
      stage: recallNodeId,
      nameZh: isRetry ? `并行召回·重试第${round}轮` : "并行召回（景点 ∥ 餐厅 ∥ 加项?）",
      inputCount: catalog.attractions.length + catalog.restaurants.length,
      outputCount:
        parallel.attraction.length + parallel.restaurant.length + parallel.extra.length,
      note: effective.wantExtra ? "三池全开" : "加项池跳过",
    });
    mergeStagesIntoNode(graphTrace[graphTrace.length - 1], parallel.stages);

    // 设计文档 2.2：并行召回后 mock restaurants_search
    toolTrace.push(
      mockRestaurantsSearch({
        scenario: effective.scenario,
        low_cal: effective.lowCalPreferred,
        party: effective.partyTotal,
        recall_round: round,
      }),
    );
    logNode(graphTrace, {
      nodeId: `mock_restaurants_${round}`,
      kind: "任务",
      deps: [recallNodeId],
      status: "完成",
      stage: `mock_restaurants_${round}`,
      nameZh: round > 0 ? `Mock·餐厅检索（重试${round}）` : "Mock·餐厅检索",
      inputCount: parallel.restaurant.length,
      outputCount: parallel.restaurant.length,
    });
    edge(recallNodeId, `mock_restaurants_${round}`);
    edge(`mock_restaurants_${round}`, "跨池联动");

    // ── 跨池联动（吃池依赖玩池 Top 锚点，非独立线性）──
    const cross = boostRestaurantsByPlayAnchors(parallel.attraction, parallel.restaurant);
    logNode(
      graphTrace,
      {
        nodeId: "cross_link",
        kind: "任务",
        deps: [`mock_restaurants_${round}`],
        status: "完成",
        stage: "cross_link",
        nameZh: "跨池联动（玩锚点 → 餐厅顺路加权）",
        inputCount: parallel.restaurant.length,
        outputCount: cross.boosted.length,
      },
      cross.stage,
    );
    edge("跨池联动", "组合评估");

    pools = {
      attraction: parallel.attraction,
      restaurant: cross.boosted,
      extra: parallel.extra,
    };

    comboRound = evaluateComboRound(pools, effective);
    retryCount = round;

    logNode(
      graphTrace,
      {
        nodeId: "combo_eval",
        kind: "条件分支",
        deps: ["cross_link"],
        status: "完成",
        stage: "combo_eval",
        nameZh: "组合评估（玩×吃×加项 搜索）",
        inputCount: comboRound.combos.length,
        outputCount: comboRound.combo ? 1 : 0,
        note: comboRound.failReason
          ? `未通过：${comboRound.failReason}`
          : `通过，Top 得分 ${comboRound.combo?.comboScore.toFixed(1)}`,
      },
      comboRound.stages[0],
    );

    const needRetry =
      round < MAX_DAG_RETRY &&
      (comboRound.failReason === "empty_pool" || comboRound.failReason === "time_overflow");

    if (!needRetry) {
      if (comboRound.failReason === "empty_pool" || !comboRound.combo) {
        throw new Error("召回池为空，无法生成行程组合");
      }
      edge("组合评估", "履约修补", comboRound.failReason ? "降级通过" : "通过");
      break;
    }
  }

  edge("组合评估", "履约修补");

  const { combo, stages: pickStages } = finalizeCombo(
    comboRound,
    pools.restaurant,
    effective,
  );

  logNode(
    graphTrace,
    {
      nodeId: "feasibility_repair",
      kind: "任务",
      deps: ["combo_eval"],
      status: "完成",
      stage: "feasibility_repair",
      nameZh: "履约修补（满座换店+最终选定）",
      inputCount: comboRound.combos.length,
      outputCount: 1,
      note: pickStages[pickStages.length - 1]?.note,
      sampleIds: pickStages[pickStages.length - 1]?.sampleIds,
    },
    pickStages[pickStages.length - 1],
  );

  edge("履约修补", "结束");

  logNode(graphTrace, {
    nodeId: "end",
    kind: "汇聚",
    deps: ["feasibility_repair"],
    status: "完成",
    stage: "end",
    nameZh: "DAG 结束",
    inputCount: 1,
    outputCount: 1,
    note: `共 ${retryCount} 次反馈，场景门槛=${SCENARIO_MIN_RELEVANCE[effective.scenario]}`,
  });

  return {
    effective,
    pools,
    combo,
    graphTrace,
    edges,
    retryCount,
    home,
    toolTrace,
  };
}
