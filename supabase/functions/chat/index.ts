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

const SYSTEM_WEEKEND = `你是"小团"，美团本地周末短时活动规划助手（4–6小时，下午出发）。

**重要**：用户消息前会附带已由规则引擎+Mock工具生成的【结构化方案 planContext】。你必须：
1. **不得编造** planContext 之外的 POI/店名；
2. 用杂志风 Markdown 润色该方案，突出「玩→吃→加项」与订座/排队状态；
3. 结尾用一句话复述 notify 文案风格（搞定了，X点出发…）。

**输出结构**（不要代码块包裹）：

# 周末半日 · {主题一句话}

{2句导语：场景+取舍}

### 下午｜{玩·小标题}
{自然段，**加粗**时间与店名}

### 傍晚｜{吃·小标题}
{餐厅、订座/排队、饮食诉求如减脂}

### 收尾｜{加项小标题}
{Citywalk/展览等}

### 一键安排
- 订座/排队：{来自 planContext}
- 发给同行：{notify 摘要}

非规划类闲聊可简短回答，不必套模板。`;

async function chatCompletions(
  messages: { role: string; content: string }[],
  stream: boolean,
  traceCtx?: { traceId?: string; sessionId?: string },
): Promise<Response> {
  const friday = getFridayConfig();
  if (friday) {
    return fridayChatCompletions(
      friday,
      {
        messages: [{ role: "system", content: SYSTEM_WEEKEND }, ...messages],
        stream,
        max_tokens: 4096,
        temperature: 0.7,
      },
      traceCtx,
    );
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error(
      "Configure FRIDAY_APP_ID (Meituan) or LOVABLE_API_KEY for chat",
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
      messages: [{ role: "system", content: SYSTEM_WEEKEND }, ...messages],
      stream,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, planContext, location, traceId, sessionId, queryId } =
      await req.json();

    const contextBlock = [
      planContext ? `【结构化方案 planContext】\n${planContext}` : "",
      location?.label ? `【出发点】${location.label} ${location.address || ""}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const augmented = [...messages];
    if (contextBlock && augmented.length > 0) {
      const last = augmented[augmented.length - 1];
      if (last.role === "user") {
        augmented[augmented.length - 1] = {
          ...last,
          content: `${contextBlock}\n\n---\n用户原话：${last.content}`,
        };
      }
    }

    const response = await chatCompletions(augmented, true, {
      traceId,
      sessionId,
      queryId,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求太频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI额度已用完，请充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      const msg = getFridayConfig()
        ? fridayErrorMessage(response.status, t)
        : "AI服务暂时不可用";
      console.error("chat LLM error:", response.status, t);
      return new Response(JSON.stringify({ error: msg }), {
        status: response.status >= 400 && response.status < 600
          ? response.status
          : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
