export type Status = "unbooked" | "pending" | "completed" | "expired";

export interface ItineraryItem {
  id: string;
  time: string;
  name: string;
  type: "scenic" | "food" | "hotel";
  description: string;
  price: string;
  status: Status;
  code?: string;
}

export interface DayPlan {
  day: number;
  date: string;
  period: string;
  items: ItineraryItem[];
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
