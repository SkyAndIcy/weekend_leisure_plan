import { fridayTracePayload } from "@/lib/friday-trace";
import {
  mergeConstraints,
  parseAiSemantic,
} from "../../../shared/planning/semantic-merge";
import type { AiSemanticExtract } from "../../../shared/planning/semantic-types";
import type { Constraints, ToolTraceEntry } from "./types";
import { extractConstraints } from "./constraints";

export type { AiSemanticExtract } from "../../../shared/planning/semantic-types";
export { mergeConstraints } from "../../../shared/planning/semantic-merge";

export class AiSemanticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiSemanticError";
  }
}

/** 开发态走 Vite 本地代理；生产走 Supabase Edge */
const EXTRACT_URL = import.meta.env.DEV
  ? "/functions/v1/recommend"
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend`;

/**
 * 调用 Edge `recommend`（Friday / Lovable）做 **语义抽取**。
 * 召回与选店由 DAG 规则流水线完成（或由 plan 接口一并完成）。
 */
export async function fetchAiSemanticExtract(
  userText: string,
  location: { label?: string; address?: string },
): Promise<{ semantic: AiSemanticExtract; trace: ToolTraceEntry }> {
  const ruleHints = extractConstraints(userText);

  let resp: Response;
  try {
    resp = await fetch(EXTRACT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        ...fridayTracePayload(),
        userText,
        location,
        ruleHints: {
          scenario: ruleHints.scenario,
          childAge: ruleHints.childAge,
          partyTotal: ruleHints.partyTotal,
          maxDistanceKm: ruleHints.maxDistanceKm,
          lowCalPreferred: ruleHints.lowCalPreferred,
          locationBlocks: ruleHints.locationBlocks,
          durationHours: ruleHints.durationHours,
        },
      }),
    });
  } catch {
    throw new AiSemanticError(
      "无法连接 AI 语义服务。请检查网络，并确认已部署 recommend/plan 且配置 FRIDAY_APP_ID。",
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await resp.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }

  if (!resp.ok || !data.ok) {
    const detail =
      typeof data.error === "string" ? data.error : `服务返回 ${resp.status}`;
    throw new AiSemanticError(
      `${detail}。请部署 recommend/plan 并配置 FRIDAY_APP_ID（或 LOVABLE_API_KEY）。`,
    );
  }

  const raw =
    (data.semantics as Record<string, unknown> | undefined) ??
    (data.recommendation as Record<string, unknown> | undefined);
  const semantic = raw ? parseAiSemantic(raw) : null;
  if (!semantic) {
    throw new AiSemanticError("AI 语义 JSON 无效，请重试。");
  }

  return {
    semantic,
    trace: {
      tool: "ai_semantic_extract",
      input: { userText, location, ruleHints },
      output: { semantic },
    },
  };
}
