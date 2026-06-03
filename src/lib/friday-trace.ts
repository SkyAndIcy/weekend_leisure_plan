/** Friday 文档要求的会话 / 请求追踪（Mt-* header + inference_config） */

const SESSION_KEY = "weekendmiao_friday_session";

export function getFridaySessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function createFridayQueryId(): string {
  return crypto.randomUUID();
}

export function fridayTracePayload() {
  const sessionId = getFridaySessionId();
  const queryId = createFridayQueryId();
  return {
    sessionId,
    traceId: queryId,
    queryId,
  };
}
