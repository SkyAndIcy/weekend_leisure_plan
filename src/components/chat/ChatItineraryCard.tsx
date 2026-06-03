import { useState } from "react";
import { MapPin, Utensils, Hotel, ChevronDown, ChevronUp, RefreshCw, Trash2, Plus, CircleDot, Clock, CheckCircle2, AlertCircle, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DayPlan, ItineraryItem, Status } from "@/types/itinerary";

const typeIcon = { scenic: MapPin, food: Utensils, hotel: Hotel };
const typeColor = {
  scenic:  { border: "border-l-meituan-blue",   dot: "bg-meituan-blue",   badge: "bg-meituan-blue/10 text-meituan-blue" },
  food:    { border: "border-l-meituan-orange",  dot: "bg-meituan-orange", badge: "bg-meituan-orange/10 text-meituan-orange" },
  hotel:   { border: "border-l-purple-500",      dot: "bg-purple-500",     badge: "bg-purple-50 text-purple-600" },
};
const statusConfig = {
  unbooked:  { icon: CircleDot,    label: "未预定",  className: "bg-primary/10 text-primary" },
  pending:   { icon: Clock,        label: "待核销",  className: "bg-muted text-muted-foreground" },
  completed: { icon: CheckCircle2, label: "已核销",  className: "bg-meituan-green/10 text-meituan-green" },
  expired:   { icon: AlertCircle,  label: "已过期",  className: "bg-meituan-red/10 text-meituan-red" },
};

interface Props {
  days: DayPlan[];
  onUpdate: (days: DayPlan[]) => void;
  onAddToTrip?: () => void;
}

// ── single timeline item ─────────────────────────────────────────────────────
const TimelineItem = ({
  item,
  isLast,
  onRefresh,
  onDelete,
  onBook,
}: {
  item: ItineraryItem;
  isLast: boolean;
  onRefresh: () => void;
  onDelete: () => void;
  onBook: () => void;
}) => {
  const booked = item.status !== "unbooked";
  const Icon = typeIcon[item.type];
  const tc = typeColor[item.type];
  const StatusIcon = statusConfig[item.status].icon;

  return (
    <div className="flex gap-2.5">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0 w-5 mt-0.5">
        <div className={`w-5 h-5 rounded-full ${tc.dot} flex items-center justify-center shadow-sm border-2 border-card z-10`}>
          <Icon className="w-2.5 h-2.5 text-white" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1 bg-border min-h-[24px]" />}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-3 rounded-xl border-l-4 ${tc.border} bg-muted/30 border border-border/60 overflow-hidden`}>
        <div className="p-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-mono">{item.time}</span>
                <span className="font-semibold text-xs truncate">{item.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${statusConfig[item.status].className}`}>
                <StatusIcon className="w-2.5 h-2.5" /> {statusConfig[item.status].label}
              </span>
              <span className="text-[11px] font-semibold text-meituan-red">{item.price}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
            <div className="flex items-center gap-1">
              <button
                onClick={onRefresh}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-meituan-blue/10 text-meituan-blue text-[10px] font-medium hover:bg-meituan-blue/20 transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" /> 换一个
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-meituan-red/10 text-meituan-red text-[10px] font-medium hover:bg-meituan-red/20 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" /> 删除
              </button>
            </div>
            <button
              type="button"
              onClick={onBook}
              className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${
                booked
                  ? "bg-meituan-green/10 text-meituan-green"
                  : "bg-primary text-primary-foreground hover:bg-meituan-yellow-hover"
              }`}
            >
              {booked ? (
                <><CheckCircle2 className="w-3 h-3" />已预定</>
              ) : (
                <><Ticket className="w-3 h-3" />立即预定</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const ChatItineraryCard = ({ days, onUpdate, onAddToTrip }: Props) => {
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  const handleDelete = (dayIdx: number, itemId: string) => {
    const updated = days.map((d, i) =>
      i === dayIdx ? { ...d, items: d.items.filter((item) => item.id !== itemId) } : d
    );
    onUpdate(updated);
  };

  const handleBook = (dayIdx: number, itemId: string) => {
    const updated = days.map((d, i) =>
      i === dayIdx
        ? {
            ...d,
            items: d.items.map((item) =>
              item.id === itemId
                ? item.status === "unbooked"
                  ? {
                      ...item,
                      status: "pending" as const,
                      code: `MT${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 9000 + 1000)}`,
                      description: item.description.includes("已订座")
                        ? item.description
                        : `${item.description.replace(/请在行程表点击.*$/, "").trim()}；已订座`,
                    }
                  : { ...item, status: "unbooked" as const, code: undefined }
                : item,
            ),
          }
        : d,
    );
    onUpdate(updated);
  };

  const handleRefresh = (dayIdx: number, itemId: string) => {
    const replacements: Record<string, { name: string; description: string; price: string }> = {
      scenic: { name: "太子湾公园", description: "赏花胜地，春日必去", price: "免费" },
      food:   { name: "弄堂里·杭帮菜", description: "地道杭帮菜，环境雅致", price: "人均¥95" },
      hotel:  { name: "桂语山房酒店", description: "隐于山林，禅意体验", price: "¥528" },
    };
    const updated = days.map((d, i) =>
      i === dayIdx
        ? {
            ...d,
            items: d.items.map((item) =>
              item.id === itemId
                ? { ...item, ...replacements[item.type], id: Date.now().toString() }
                : item
            ),
          }
        : d
    );
    onUpdate(updated);
  };

  return (
    <div className="space-y-2 mt-2">
      {days.map((day, dayIdx) => (
        <div key={day.day} className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
          {/* Day header */}
          <button
            onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">D{day.day}</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-xs">{day.date} {day.period}</p>
                <p className="text-[10px] text-muted-foreground">{day.items.length} 个行程点</p>
              </div>
            </div>
            {expandedDay === day.day
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {/* Collapsible timeline */}
          <AnimatePresence>
            {expandedDay === day.day && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-2">
                  {day.items.map((item, itemIdx) => (
                    <TimelineItem
                      key={item.id}
                      item={item}
                      isLast={itemIdx === day.items.length - 1}
                      onRefresh={() => handleRefresh(dayIdx, item.id)}
                      onDelete={() => handleDelete(dayIdx, item.id)}
                      onBook={() => handleBook(dayIdx, item.id)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {onAddToTrip && (
        <button
          onClick={onAddToTrip}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-xs hover:bg-meituan-yellow-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> 添加到我的行程
        </button>
      )}
    </div>
  );
};

export default ChatItineraryCard;
