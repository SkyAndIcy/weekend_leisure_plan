import { fridayTracePayload } from "@/lib/friday-trace";
import { buildWeekendPlanCore } from "../../../shared/planning/build-plan";
import { AiSemanticError, fetchAiSemanticExtract } from "./ai-semantic";
import type { WeekendPlan } from "./types";

const PLAN_URL = import.meta.env.DEV
  ? "/functions/v1/plan"
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan`;

/** 规则 DAG / 召回失败（非 AI 语义问题） */
export class PlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningError";
  }
}

function classifyPlanError(detail: string): Error {
  if (/召回池|行程组合|时间超标|empty_pool|time_overflow/i.test(detail)) {
    return new PlanningError(
      `${detail}。可尝试放宽「别太远」或换北京市内其他出发点。`,
    );
  }
  if (/语义|Friday|JSON|审核|AppId|Invalid AI/i.test(detail)) {
    return new AiSemanticError(
      `${detail}。请部署 plan/recommend 并配置 FRIDAY_APP_ID（本地开发需 .env 中 FRIDAY_APP_ID）。`,
    );
  }
  if (/无法连接|网络|fetch/i.test(detail)) {
    return new AiSemanticError(
      "无法连接行程规划服务。请检查网络，并确认已部署 plan 且配置 FRIDAY_APP_ID。",
    );
  }
  return new PlanningError(detail);
}

/**
 * 默认走服务端 plan（DAG + 语义 + Mock 履约一次完成）。
 * 调试时可设 VITE_PLAN_MODE=client 在浏览器内跑 DAG。
 */
export async function buildWeekendPlan(
  userText: string,
  location: { fullAddress?: string; displayName?: string; coords?: { lat: number; lng: number } },
): Promise<WeekendPlan> {
  const mode = import.meta.env.VITE_PLAN_MODE ?? "server";

  if (mode === "client") {
    try {
      return await buildWeekendPlanCore(userText, location, fetchAiSemanticExtract);
    } catch (e) {
      throw e instanceof Error ? classifyPlanError(e.message) : new PlanningError("行程规划失败");
    }
  }

  let resp: Response;
  try {
    resp = await fetch(PLAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        ...fridayTracePayload(),
        userText,
        location: {
          label: location.displayName || location.fullAddress,
          address: location.fullAddress,
          displayName: location.displayName,
          fullAddress: location.fullAddress,
          coords: location.coords,
        },
      }),
    });
  } catch {
    throw new AiSemanticError(
      "无法连接行程规划服务。请检查网络，并确认已部署 plan 且配置 FRIDAY_APP_ID。",
    );
  }

  let data: { ok?: boolean; plan?: WeekendPlan; error?: string } = {};
  try {
    data = await resp.json();
  } catch {
    /* empty */
  }

  if (!resp.ok || !data.ok || !data.plan) {
    const detail = data.error ?? `服务返回 ${resp.status}`;
    throw classifyPlanError(detail);
  }

  return data.plan;
}
