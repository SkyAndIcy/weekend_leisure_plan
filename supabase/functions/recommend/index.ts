import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  fridayChatCompletions,
  fridayErrorMessage,
  getFridayConfig,
} from "../_shared/friday_llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `你是美团周末本地活动规划的「语义理解」模块。根据用户自然语言与出发点，抽取结构化约束，**不要**选择具体 POI、不要编造店名。

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

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function extractCompletion(
  userPayload: string,
  traceCtx?: { traceId?: string; sessionId?: string; queryId?: string },
): Promise<Response> {
  const friday = getFridayConfig();
  const messages = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `${userPayload}\n\n请输出合法 json 对象，包含上述语义字段。`,
    },
  ];

  if (friday) {
    return fridayChatCompletions(
      friday,
      {
        messages,
        temperature: 0.1,
        stream: false,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      },
      traceCtx,
    );
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error(
      "Configure FRIDAY_APP_ID (Meituan) or LOVABLE_API_KEY for recommend",
    );
  }

  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      temperature: 0.1,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userText, location, ruleHints, traceId, sessionId, queryId } =
      await req.json();

    const userPayload = [
      `【用户】${userText}`,
      `【出发点】${location?.label || ""} ${location?.address || ""}`,
      ruleHints ? `【规则预解析】${JSON.stringify(ruleHints)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await extractCompletion(userPayload, {
      traceId,
      sessionId,
      queryId,
    });

    if (!response.ok) {
      const t = await response.text();
      const errMsg = getFridayConfig()
        ? fridayErrorMessage(response.status, t)
        : "AI semantic extract unavailable";
      console.error("semantic LLM error:", response.status, t);
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: response.status === 450 || response.status === 451 ? 422 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    const parsed = content ? parseJsonBlock(content) : null;
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid AI JSON" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, semantics: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : "Unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
