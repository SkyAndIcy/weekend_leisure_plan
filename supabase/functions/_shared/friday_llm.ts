/**
 * 美团 Friday One-API（OpenAI Chat Completions 兼容）
 * 文档: https://km.sankuai.com/collabpage/1580139661
 * 接口: POST {baseUrl}/chat/completions
 * 鉴权: Authorization: Bearer {AppId}
 */
export type FridayConfig = {
  appId: string;
  baseUrl: string;
  model: string;
};

/** Agent / 排查用上下文（文档 4.1.4 header + user 字段） */
export type FridayCallContext = {
  traceId?: string;
  userId?: string;
  sessionId?: string;
  queryId?: string;
  agentId?: string;
};

export function newTraceId(): string {
  return crypto.randomUUID();
}

export function getFridayConfig(): FridayConfig | null {
  const appId = Deno.env.get("FRIDAY_APP_ID")?.trim();
  if (!appId) return null;
  const baseUrl =
    Deno.env.get("FRIDAY_BASE_URL")?.trim() ||
    "https://aigc.sankuai.com/v1/openai/native";
  const model = Deno.env.get("FRIDAY_MODEL")?.trim() || "gpt-4o-mini";
  return { appId, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

export function buildFridayContext(
  overrides?: Partial<FridayCallContext>,
): FridayCallContext {
  const traceId = overrides?.traceId?.trim() || newTraceId();
  const userId =
    overrides?.userId?.trim() ||
    Deno.env.get("FRIDAY_MT_USER_ID")?.trim() ||
    "weekendmiao-demo";
  return {
    traceId,
    userId,
    sessionId: overrides?.sessionId?.trim() || traceId,
    queryId: overrides?.queryId?.trim() || traceId,
    agentId:
      overrides?.agentId?.trim() ||
      Deno.env.get("FRIDAY_MT_AGENT_ID")?.trim() ||
      undefined,
  };
}

export function fridayChatUrl(config: FridayConfig): string {
  return `${config.baseUrl}/chat/completions`;
}

function buildFridayHeaders(
  config: FridayConfig,
  ctx: FridayCallContext,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.appId}`,
    "Content-Type": "application/json",
    "M-TraceId": ctx.traceId!,
  };
  if (ctx.agentId) headers["Mt-Agent-Id"] = ctx.agentId;
  if (ctx.userId) headers["Mt-User-Id"] = ctx.userId;
  if (ctx.sessionId) headers["Mt-Session-Id"] = ctx.sessionId;
  if (ctx.queryId) headers["Mt-Query-Id"] = ctx.queryId;
  return headers;
}

/** 将 Friday HTTP 状态码映射为面向用户的简短说明 */
export function fridayErrorMessage(status: number, body?: string): string {
  if (status === 450) return "输入内容未通过安全审核，请调整表述后重试";
  if (status === 451) return "模型输出未通过安全审核，请调整表述后重试";
  if (status === 401) return "Friday 鉴权失败，请检查 AppId 配置";
  if (status === 403) return "Friday 请求被拒绝或额度不足";
  if (status === 429) return "Friday 请求过于频繁，请稍后再试";
  if (status === 408 || status === 504) return "Friday 请求超时，请重试";
  if (status === 503) return "Friday 服务繁忙，请稍后重试";
  if (body && body.length < 200) return body;
  return "Friday AI 服务暂时不可用";
}

export async function fridayChatCompletions(
  config: FridayConfig,
  body: Record<string, unknown>,
  ctx?: Partial<FridayCallContext>,
): Promise<Response> {
  const context = buildFridayContext(ctx);
  const payload: Record<string, unknown> = {
    model: config.model,
    ...body,
    user: body.user ?? context.traceId,
  };

  // 文档：inference_config.biz_session_id 可优化路由与成本
  if (context.sessionId || context.queryId) {
    payload.inference_config = {
      ...(typeof body.inference_config === "object" && body.inference_config !== null
        ? (body.inference_config as Record<string, unknown>)
        : {}),
      biz_session_id: context.sessionId,
      biz_query_id: context.queryId,
    };
  }

  const res = await fetch(fridayChatUrl(config), {
    method: "POST",
    headers: buildFridayHeaders(config, context),
    body: JSON.stringify(payload),
  });

  const traceHeader = res.headers.get("M-TraceId") ||
    res.headers.get("m-traceid");
  if (!res.ok) {
    const text = await res.text();
    console.error(
      "Friday error:",
      res.status,
      "M-TraceId:",
      traceHeader ?? context.traceId,
      text.slice(0, 500),
    );
    return new Response(text, { status: res.status, headers: res.headers });
  }

  return res;
}
