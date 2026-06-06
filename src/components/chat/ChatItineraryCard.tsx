import { useState } from "react";
import { MapPin, Utensils, Hotel, ChevronDown, ChevronUp, ChevronLeft, RefreshCw, Trash2, Plus, CircleDot, Clock, CheckCircle2, AlertCircle, Ticket, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { removeItineraryItem, restoreItineraryItem } from "@/lib/itinerary-remove-restore";
import {
  applySwapToItem,
  collectOtherSlotPoiNames,
  pickSwapNext,
  pickSwapPrev,
  type SwapDirection,
} from "@/lib/poi-swap";
import type { Poi } from "../../../shared/planning/types";
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

export type ItinerarySwapPayload = {
  dayIdx: number;
  itemIdx: number;
  poi: Poi;
  itemType: ItineraryItem["type"];
  direction: SwapDirection;
};

interface Props {
  days: DayPlan[];
  onUpdate: (days: DayPlan[]) => void;
  onAddToTrip?: () => void;
  /** 出发点文案，用于上一家/换一家同商圈召回 */
  homeLabel?: string;
  /** 换店后同步地图等 */
  onItemSwapped?: (payload: ItinerarySwapPayload) => void;
}

// ── single timeline item ─────────────────────────────────────────────────────
const TimelineItem = ({
  item,
  isLast,
  onSwap,
  onDelete,
  onBook,
}: {
  item: ItineraryItem;
  isLast: boolean;
  onSwap: (direction: SwapDirection) => void;
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

          {/* Actions — 单行排列，避免「预定」挡住「换一家」 */}
          <div
            className="relative z-10 flex items-center gap-0.5 w-full mt-2 pt-1.5 border-t border-border/40 flex-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onSwap("prev")}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[9px] font-medium hover:bg-muted/80 hover:text-foreground transition-colors whitespace-nowrap touch-manipulation"
            >
              <ChevronLeft className="w-2 h-2 shrink-0 pointer-events-none" />上一家
            </button>
            <button
              type="button"
              onClick={() => onSwap("next")}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-meituan-blue/10 text-meituan-blue text-[9px] font-medium hover:bg-meituan-blue/20 transition-colors whitespace-nowrap touch-manipulation"
            >
              <RefreshCw className="w-2 h-2 shrink-0 pointer-events-none" />换一家
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-meituan-red/10 text-meituan-red text-[9px] font-medium hover:bg-meituan-red/20 transition-colors whitespace-nowrap touch-manipulation"
            >
              <Trash2 className="w-2 h-2 shrink-0 pointer-events-none" />删除
            </button>
            <button
              type="button"
              onClick={onBook}
              className={`ml-auto flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all whitespace-nowrap touch-manipulation ${
                booked
                  ? "bg-meituan-green/10 text-meituan-green"
                  : "bg-primary text-primary-foreground hover:bg-meituan-yellow-hover"
              }`}
            >
              {booked ? (
                <><CheckCircle2 className="w-2.5 h-2.5 pointer-events-none" />已预定</>
              ) : (
                <><Ticket className="w-2.5 h-2.5 pointer-events-none" />预定</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const ChatItineraryCard = ({ days, onUpdate, onAddToTrip, homeLabel, onItemSwapped }: Props) => {
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  const handleDelete = (dayIdx: number, itemId: string) => {
    const item = days[dayIdx]?.items.find((i) => i.id === itemId);
    const updated = removeItineraryItem(days, dayIdx, itemId);
    if (!updated) return;
    onUpdate(updated);
    if (item) {
      toast.message(`「${item.name}」已移至下方`, {
        description: "在「已移除」里可随时加回来",
        duration: 4000,
      });
    }
  };

  const handleRestore = (dayIdx: number, itemId: string) => {
    const item = days[dayIdx]?.removedItems?.find((i) => i.id === itemId);
    const updated = restoreItineraryItem(days, dayIdx, itemId);
    if (!updated) return;
    onUpdate(updated);
    if (item) toast.success(`已加回「${item.name}」`);
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

  const handleSwap = (dayIdx: number, itemId: string, direction: SwapDirection) => {
    const day = days[dayIdx];
    const itemIdx = day?.items.findIndex((i) => i.id === itemId) ?? -1;
    const item = itemIdx >= 0 ? day?.items[itemIdx] : undefined;
    if (!item) return;

    const otherSlotNames = collectOtherSlotPoiNames(days, {
      itemId: item.id,
      itemType: item.type,
    });

    const picked =
      direction === "prev"
        ? pickSwapPrev(item)
        : pickSwapNext({
            homeLabel,
            itemType: item.type,
            otherSlotNames,
            currentName: item.name,
          });

    if (!picked) {
      if (direction === "prev") {
        toast.message("没有上一家了");
      } else {
        toast.message("附近暂无更多可替换的备选", {
          description: "可试试「继续探索」让喵推荐",
        });
      }
      return;
    }

    const updated = days.map((d, i) =>
      i === dayIdx
        ? {
            ...d,
            items: d.items.map((it) =>
              it.id === itemId ? applySwapToItem(it, picked, direction) : it,
            ),
          }
        : d,
    );
    onUpdate(updated);
    onItemSwapped?.({
      dayIdx,
      itemIdx,
      poi: picked.poi,
      itemType: item.type,
      direction,
    });
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
                <p className="text-[10px] text-muted-foreground">
                  {day.items.length} 个行程点
                  {(day.removedItems?.length ?? 0) > 0
                    ? ` · ${day.removedItems!.length} 已移除`
                    : ""}
                </p>
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
                      isLast={itemIdx === day.items.length - 1 && !(day.removedItems?.length)}
                      onSwap={(dir) => handleSwap(dayIdx, item.id, dir)}
                      onDelete={() => handleDelete(dayIdx, item.id)}
                      onBook={() => handleBook(dayIdx, item.id)}
                    />
                  ))}

                  {(day.removedItems?.length ?? 0) > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed border-border/70">
                      <p className="text-[10px] text-muted-foreground font-medium mb-2 px-0.5">
                        已移除 · {day.removedItems!.length} 站（可随时加回）
                      </p>
                      <div className="space-y-1.5">
                        {day.removedItems!.map((item) => {
                          const Icon = typeIcon[item.type];
                          const tc = typeColor[item.type];
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/50 px-2 py-1.5"
                            >
                              <div className={`w-4 h-4 rounded-full ${tc.dot} flex items-center justify-center shrink-0`}>
                                <Icon className="w-2 h-2 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium truncate">
                                  <span className="text-muted-foreground font-mono mr-1">{item.time}</span>
                                  {item.name}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRestore(dayIdx, item.id)}
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-meituan-green/10 text-meituan-green text-[10px] font-semibold hover:bg-meituan-green/20 shrink-0"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> 加回来
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
