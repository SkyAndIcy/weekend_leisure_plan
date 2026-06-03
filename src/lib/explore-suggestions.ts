export type PlanLinkedMessage = {
  role: string;
  planContext?: string;
};

/** 当前消息关联的方案上下文（本条或向前找最近一条带行程的方案） */
export function findLinkedPlanContext(
  messages: PlanLinkedMessage[],
  index: number,
): string | undefined {
  const cur = messages[index];
  if (cur?.planContext) return cur.planContext;
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext) return m.planContext;
  }
  return undefined;
}

export function lastAssistantMessageIndex(messages: PlanLinkedMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

/** 触发本次规划的那条用户原话（用于判断半日/亲子等） */
export function findPlanningUserHint(
  messages: { role: string; content: string; planContext?: string }[],
  fromIndex: number,
): string | undefined {
  let planOwner = -1;
  for (let i = fromIndex; i >= 0; i--) {
    if (messages[i].role === "assistant" && messages[i].planContext) {
      planOwner = i;
      break;
    }
  }
  const searchBefore = planOwner >= 0 ? planOwner : fromIndex;
  for (let i = searchBefore - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return undefined;
}

/** 是否是对已有方案的追问（不应重新跑 DAG 规划） */
export function isFollowUpQuery(text: string, hasExistingPlan: boolean): boolean {
  if (!hasExistingPlan) return false;
  const t = text.trim();
  return (
    /住宿|酒店|民宿|住哪|过夜|房型/.test(t) ||
    /美食|吃什么|餐厅|饭店/.test(t) ||
    /打卡|景点|好玩|值得|逛逛|展览|加项|还有什么|备选/.test(t) ||
    (/怎么选|推荐|有其他/.test(t) && t.length < 40)
  );
}

function homeAreaFromPlanContext(planContext: string): string {
  const m = planContext.match(/出发点:\s*(.+)/);
  return m?.[1]?.trim() || "出发地附近";
}

function isHalfDayPlan(planContext: string, userHint?: string): boolean {
  if (userHint && /2-3\s*小时|2～3\s*小时|半日|别太远|下午.*玩/.test(userHint)) return true;
  if (/半日|2-3\s*小时|2～3\s*小时/.test(planContext)) return true;
  return false;
}

/** 结合当前方案生成「继续探索」追问，避免半日行程推住宿 */
export function buildExploreSuggestions(
  planContext: string,
  locationLabel?: string,
  userHint?: string,
): string[] {
  const area = locationLabel?.trim() || homeAreaFromPlanContext(planContext);
  const halfDay = isHalfDayPlan(planContext, userHint);

  if (halfDay) {
    return [
      `${area}附近还有什么适合亲子的打卡点？`,
      `除了行程里的餐厅，还有什么美食备选？`,
      `想再加一个活动，傍晚前有什么推荐？`,
    ];
  }

  return [
    `${area}还有什么值得打卡的地方？`,
    `${area}有什么美食推荐？`,
    `${area}若需过夜，亲子酒店怎么选？`,
  ];
}
