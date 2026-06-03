import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  fridayChatCompletions,
  fridayErrorMessage,
  getFridayConfig,
} from "../_shared/friday_llm.ts";
import { augmentChatMessages } from "../_shared/chat_augment.ts";
import { CHAT_FOLLOWUP_SYSTEM, CHAT_SYSTEM } from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function chatCompletions(
  messages: { role: string; content: string }[],
  stream: boolean,
  systemPrompt: string,
  traceCtx?: { traceId?: string; sessionId?: string; queryId?: string },
): Promise<Response> {
  const friday = getFridayConfig();
  if (friday) {
    return fridayChatCompletions(
      friday,
      {
        messages: [{ role: "system", content: systemPrompt }, ...messages],
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
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, planContext, location, followUp, followUpMemory, traceId, sessionId, queryId } =
      await req.json();

    const augmented = augmentChatMessages(
      messages ?? [],
      planContext,
      location,
      !!followUp,
      followUpMemory as string | undefined,
    );
    const systemPrompt = followUp ? CHAT_FOLLOWUP_SYSTEM : CHAT_SYSTEM;

    const response = await chatCompletions(augmented, true, systemPrompt, {
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
