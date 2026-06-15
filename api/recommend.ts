/**
 * Vercel Edge Function: /api/recommend
 * 语义理解：把自然语言 + 出发点提取为结构化约束 JSON
 * 对应 supabase/functions/recommend/index.ts
 */
export const config = { runtime: "edge" };

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
    const { userText, location, ruleHints } = await req.json() as Record<string, unknown>;

    const userPayload = [
      `【用户】${userText}`,
      `【出发点】${(location as Record<string,string>)?.label || ""} ${(location as Record<string,string>)?.address || ""}`,
      ruleHints ? `【规则预解析】${JSON.stringify(ruleHints)}` : "",
    ].filter(Boolean).join("\n\n");

    const traceId = crypto.randomUUID();
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
      const status = fr.status === 450 || fr.status === 451 ? 422 : 502;
      return new Response(
        JSON.stringify({ ok: false, error: fridayErrorMessage(fr.status, t) }),
        { status, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const data = await fr.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const parsed = content ? parseJsonBlock(content) : null;
    if (!parsed) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid AI JSON" }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, semantics: parsed }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
}
