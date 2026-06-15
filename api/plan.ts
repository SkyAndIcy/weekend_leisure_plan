/**
 * Vercel Serverless Function: /api/plan
 * 完整行程规划：语义理解 + DAG 召回 + Mock 履约
 * 对应 supabase/functions/plan/index.ts
 */
import { buildWeekendPlanCore } from "../shared/planning/build-plan";
import { extractConstraints } from "../shared/planning/constraints";
import { parseAiSemantic } from "../shared/planning/semantic-merge";

const FRIDAY_BASE_URL =
  process.env.FRIDAY_BASE_URL?.replace(/\/$/, "") ||
  "https://aigc.sankuai.com/v1/openai/native";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed) as Record<string, unknown>; } catch { /* */ }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
}

function fridayErrorMessage(status: number, body?: string): string {
  if (status === 450) return "输入内容未通过安全审核，请调整表述后重试";
  if (status === 451) return "模型输出未通过安全审核，请调整表述后重试";
  if (status === 401) return "Friday 鉴权失败，请检查 AppId 配置";
  if (status === 403) return "Friday 请求被拒绝或额度不足";
  if (status === 429) return "Friday 请求过于频繁，请稍后再试";
  if (body && body.length < 200) return body;
  return "Friday AI 服务暂时不可用";
}

const RECOMMEND_SYSTEM = `你是美团周末本地活动规划的「语义理解」模块。根据用户自然语言与出发点，抽取结构化约束，**不要**选择具体 POI、不要编造店名。

**输出仅一段合法 JSON**，无 Markdown。字段说明：
- scenario: "family" | "friends" | "unknown"
- departureHour: 0-23，默认 14
- maxDistanceKm: 正数，默认 8；"别太远/附近"可设为 5
- durationHours: [最短小时, 最长小时]，周末半日通常 [4,6]
- childAge: 儿童年龄或 null
- partyTotal: 人数或 null
- lowCalPreferred: 是否低脂/减脂诉求
- locationBlocks: 用户提到的商圈/区域关键词数组，如 ["三里屯","望京"]
- wantExtra: 是否需要加项（citywalk/展览等），默认 true
- intentSummary: 一句话概括用户诉求

参考【规则预解析】但可修正其错误理解。`;

async function localSemanticExtract(
  appId: string,
  model: string,
  body: Record<string, unknown>,
  traceId: string,
): Promise<{ ok: true; semantics: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const userText = String(body.userText ?? "");
  const location = (body.location as Record<string, string>) || {};
  const ruleHints = body.ruleHints;

  const userPayload = [
    `【用户】${userText}`,
    `【出发点】${location.label || ""} ${location.address || ""}`,
    ruleHints ? `【规则预解析】${JSON.stringify(ruleHints)}` : "",
  ].filter(Boolean).join("\n\n");

  const fr = await fetch(`${FRIDAY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appId}`,
      "Content-Type": "application/json",
      "M-TraceId": traceId,
    },
    body: JSON.stringify({
      model,
      user: traceId,
      messages: [
        { role: "system", content: RECOMMEND_SYSTEM },
        { role: "user", content: `${userPayload}\n\n请输出合法 json 对象，包含上述语义字段。` },
      ],
      temperature: 0.1,
      stream: false,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!fr.ok) {
    const t = await fr.text();
    return {
      ok: false,
      error: fridayErrorMessage(fr.status, t),
      status: fr.status === 450 || fr.status === 451 ? 422 : 502,
    };
  }

  const data = await fr.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  const parsed = content ? parseJsonBlock(content) : null;
  if (!parsed) return { ok: false, error: "Invalid AI JSON", status: 422 };
  return { ok: true, semantics: parsed };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const appId = process.env.FRIDAY_APP_ID?.trim();
    if (!appId) {
      return new Response(
        JSON.stringify({ ok: false, error: "未配置 FRIDAY_APP_ID" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    const model = process.env.FRIDAY_MODEL?.trim() || "gpt-4o-mini";
    const { userText, location } = await req.json() as Record<string, unknown>;

    if (!userText || typeof userText !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "缺少 userText" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const ruleHints = extractConstraints(userText);
    const traceId = crypto.randomUUID();

    const plan = await buildWeekendPlanCore(
      userText,
      {
        fullAddress: String((location as Record<string, unknown>)?.address ?? (location as Record<string, unknown>)?.fullAddress ?? ""),
        displayName: String((location as Record<string, unknown>)?.label ?? (location as Record<string, unknown>)?.displayName ?? ""),
        coords: (location as Record<string, unknown>)?.coords as { lat: number; lng: number } | undefined,
      },
      async (text, loc) => {
        const result = await localSemanticExtract(
          appId,
          model,
          {
            userText: text,
            location: loc,
            ruleHints: {
              scenario: ruleHints.scenario,
              childAge: ruleHints.childAge,
              partyTotal: ruleHints.partyTotal,
              maxDistanceKm: ruleHints.maxDistanceKm,
              lowCalPreferred: ruleHints.lowCalPreferred,
              locationBlocks: ruleHints.locationBlocks,
              durationHours: ruleHints.durationHours,
            },
          },
          traceId,
        );
        if (!result.ok) throw new Error(result.error);
        const semantic = parseAiSemantic(result.semantics);
        if (!semantic) throw new Error("AI 语义 JSON 无效，请重试。");
        return {
          semantic,
          trace: {
            tool: "ai_semantic_extract",
            input: { userText: text, location: loc, ruleHints },
            output: { semantic },
          },
        };
      },
    );

    return new Response(
      JSON.stringify({ ok: true, plan }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    const isSemantic = /语义|Friday|AI|JSON|审核|鉴权|配置/.test(msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: isSemantic ? 422 : 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
}
