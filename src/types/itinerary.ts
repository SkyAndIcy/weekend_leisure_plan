export type Status = "unbooked" | "pending" | "completed" | "expired";

/** 换店前的快照，供「上一家」真实回退 */
export interface SwapHistoryEntry {
  poiId: string;
  name: string;
  description: string;
  price: string;
  swapCycleIndex?: number;
}

export interface ItineraryItem {
  id: string;
  time: string;
  name: string;
  type: "scenic" | "food" | "hotel";
  description: string;
  price: string;
  status: Status;
  code?: string;
  /** 当前店在全城候选池中的下标（换一家随机用） */
  swapCycleIndex?: number;
  /** 换店栈：上一家弹出栈顶 */
  swapHistory?: SwapHistoryEntry[];
  /** @deprecated */
  swapExclude?: string[];
}

export interface DayPlan {
  day: number;
  date: string;
  period: string;
  items: ItineraryItem[];
  /** 用户删除的站点，保留在卡片底部可「加回来」 */
  removedItems?: ItineraryItem[];
}

export const statusConfig = {
  unbooked: { label: "未预定", className: "bg-primary/10 text-primary" },
  pending: { label: "待核销", className: "bg-muted text-muted-foreground" },
  completed: { label: "已核销", className: "bg-meituan-green/10 text-meituan-green" },
  expired: { label: "已过期", className: "bg-meituan-red/10 text-meituan-red" },
};

export const typeColor = {
  scenic: "border-l-meituan-blue",
  food: "border-l-meituan-orange",
  hotel: "border-l-purple-500",
};
