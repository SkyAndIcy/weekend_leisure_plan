export function augmentChatMessages(
  messages: { role: string; content: string }[],
  planContext?: string,
  location?: { label?: string; address?: string },
  followUp?: boolean,
): { role: string; content: string }[] {
  const contextBlock = [
    followUp ? "【模式】用户对现有方案的追问，勿重新规划。" : "",
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
  return augmented;
}
