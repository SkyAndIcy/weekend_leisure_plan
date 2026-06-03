const CHAT_URL = import.meta.env.DEV
  ? "/functions/v1/chat"
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export class ChatStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatStreamError";
  }
}

/** Edge chat 流式润色；失败抛 ChatStreamError */
export async function streamChatCompletion(
  body: Record<string, unknown>,
  onDelta: (text: string) => void,
): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    throw new ChatStreamError(`文案润色服务不可用（${resp.status}）`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          assistantContent += content;
          onDelta(assistantContent);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return assistantContent;
}
