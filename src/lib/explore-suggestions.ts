export type PlanLinkedMessage = {
  role: string;
  planContext?: string;
};

/** 引导型继续探索：展示文案 + 点击后发给小喵的追问 */
export type ExploreGuide = {
  id: string;
  label: string;
  hint: string;
  prompt: string;
};

/** 当前消息关联的方案上下文（本条或向前找最近一条带行程的方案） */
export function findLinkedPlanContext(
  messages: (PlanLinkedMessage & { itinerary?: unknown[] })[],
  index: number,
): string | undefined {
  const cur = messages[index];
  if (cur?.planContext && cur.itinerary?.length) return cur.planContext;
  for (let i = index - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.planContext && m.itinerary?.length) return m.planContext;
  }
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
    /美食|吃什么|餐厅|饭店|换.*餐厅/.test(t) ||
    /打卡|景点|好玩|值得|逛逛|展览|加项|加点|延长|备选|顺路/.test(t) ||
    /基于当前行程|当前方案|planContext|帮我看看|还有什么/.test(t) ||
    (/怎么选|推荐|有其他/.test(t) && t.length < 80)
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

function isFamilyPlan(planContext: string, userHint?: string): boolean {
  return (
    planContext.includes("family") ||
    /亲子|带娃|孩子|\d+岁/.test(userHint ?? "") ||
    /家庭亲子/.test(planContext)
  );
}

/** 结合当前方案生成引导型「继续探索」 */
export function buildExploreGuides(
  planContext: string,
  locationLabel?: string,
  userHint?: string,
): ExploreGuide[] {
  const area = locationLabel?.trim() || homeAreaFromPlanContext(planContext);
  const halfDay = isHalfDayPlan(planContext, userHint);
  const family = isFamilyPlan(planContext, userHint);

  if (halfDay) {
    return [
      {
        id: "play-more",
        label: family ? "加点亲子玩法" : "加点顺路玩法",
        hint: family
          ? `在${area}步行或短途可达，适合带娃再逛一处`
          : `不绕路、1 小时内能玩完的附近选择`,
        prompt: `基于当前行程方案，推荐还能加的 2 个${family ? "亲子" : ""}打卡备选：必须不同于行程表里已有地点（勿推荐同类公园换名），只从候选池选，每条写差异+时长+适合5岁娃的点。`,
      },
      {
        id: "food-alt",
        label: "换家餐厅试试",
        hint: "口味/排队/人均和行程里不同的备选",
        prompt:
          "基于当前行程里的餐厅，再推荐 2 家附近美食备选（不得与行程中餐厅重复），说明口味/排队/人均差异及亲子友好点，不要重新规划整条行程。",
      },
      {
        id: "extend-lite",
        label: "傍晚前还能做什么",
        hint: "时间还够的话，顺路收尾小活动",
        prompt:
          "在当前半日行程基础上，傍晚前还能顺路做的一个轻量活动是什么？要轻松、别增加太多路程。",
      },
    ];
  }

  return [
    {
      id: "spots",
      label: "深挖附近打卡",
      hint: `围绕${area}，补 2–3 个值得去的点`,
      prompt: `基于当前行程，${area}还有哪些值得打卡的地方？各用一句话说明适合谁、玩多久。`,
    },
    {
      id: "food",
      label: "美食再比比",
      hint: "正餐、小吃、下午茶都可以",
      prompt: `基于当前行程，${area}有什么美食推荐？给 2–3 个备选并说明和行程里餐厅的差异。`,
    },
    {
      id: "stay",
      label: "若要过夜怎么选",
      hint: "仅当需要住宿时再看",
      prompt: `若计划在${area}过夜，亲子/朋友出行各给 2 条选酒店原则，不要重新排出玩吃时间轴。`,
    },
  ];
}
