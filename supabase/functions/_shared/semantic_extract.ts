import {
  fridayChatCompletions,
  fridayErrorMessage,
  getFridayConfig,
  type FridayCallContext,
} from "./friday_llm.ts";
import { RECOMMEND_SYSTEM } from "./prompts.ts";
import { parseAiSemantic } from "./planning/semantic-merge.ts";

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

async function llmExtract(
  userPayload: string,
  traceCtx?: FridayCallContext,
): Promise<Response> {
  const friday = getFridayConfig();
  const messages = [
    { role: "system", content: RECOMMEND_SYSTEM },
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
      "Configure FRIDAY_APP_ID (Meituan) or LOVABLE_API_KEY for semantic extract",
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

export type SemanticExtractInput = {
  userText: string;
  location?: { label?: string; address?: string };
  ruleHints?: Record<string, unknown>;
  traceId?: string;
  sessionId?: string;
  queryId?: string;
};

export async function extractSemantic(
  input: SemanticExtractInput,
): Promise<{ ok: true; semantics: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const userPayload = [
    `【用户】${input.userText}`,
    `【出发点】${input.location?.label || ""} ${input.location?.address || ""}`,
    input.ruleHints ? `【规则预解析】${JSON.stringify(input.ruleHints)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await llmExtract(userPayload, {
    traceId: input.traceId,
    sessionId: input.sessionId,
    queryId: input.queryId,
  });

  if (!response.ok) {
    const t = await response.text();
    const errMsg = getFridayConfig()
      ? fridayErrorMessage(response.status, t)
      : "AI semantic extract unavailable";
    return {
      ok: false,
      error: errMsg,
      status: response.status === 450 || response.status === 451 ? 422 : 502,
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;
  const parsed = content ? parseJsonBlock(content) : null;
  if (!parsed) {
    return { ok: false, error: "Invalid AI JSON", status: 422 };
  }

  return { ok: true, semantics: parsed };
}

export { parseAiSemantic };
