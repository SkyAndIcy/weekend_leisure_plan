/**
 * Vercel Edge Function: /api/chat
 * 流式文案润色（SSE），注入 planContext，不改 POI
 * 对应 supabase/functions/chat/index.ts
 */
export const config = { runtime: "edge" };

import { augmentChatMessages } from "../supabase/functions/_shared/chat_augment";
import { CHAT_FOLLOWUP_SYSTEM, CHAT_SYSTEM } from "../supabase/functions/_shared/prompts";

const FRIDAY_BASE_URL =
  process.env.FRIDAY_BASE_URL?.replace(/\/$/, "") ||
  "https://aigc.sankuai.com/v1/openai/native";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function fridayErrorMessage(status: number, body?: string): string {
  if (status === 450) return "输入内容未通过安全审核，请调整表述后重试";
  if (status === 451) return "模型输出未通过安全审核，请调整表述后重试";
  if (status === 401) return "Friday 鉴权失败，请检查 AppId 配置";
  if (status === 403) return "Friday 请求被拒绝或额度不足";
  if (status === 429) return "Friday 请求过于频繁，请稍后再试";
  if (body && body.length < 200) return body;
  return "Friday AI 服务暂时不可用";
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
    const { messages, planContext, location, followUp, followUpMemory } =
      await req.json() as Record<string, unknown>;

    const augmented = augmentChatMessages(
      (messages as { role: string; content: string }[]) ?? [],
      planContext as string | undefined,
      location as { label?: string; address?: string } | undefined,
      !!followUp,
      followUpMemory as string | undefined,
    );
    const systemPrompt = followUp ? CHAT_FOLLOWUP_SYSTEM : CHAT_SYSTEM;
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
        messages: [{ role: "system", content: systemPrompt }, ...augmented],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!fr.ok || !fr.body) {
      const t = await fr.text();
      return new Response(
        JSON.stringify({ ok: false, error: fridayErrorMessage(fr.status, t) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 直接透传 SSE 流
    return new Response(fr.body, {
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
}
