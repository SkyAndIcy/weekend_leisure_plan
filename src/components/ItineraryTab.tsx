import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Utensils, Hotel, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronLeft, RefreshCw, Plus, Map as MapIcon, List, Trash2, RotateCcw, X, Heart, ShoppingCart, CircleDot, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCollections } from "@/contexts/collections-context";
import { useLocation } from "@/hooks/use-location";
import {
  ITINERARY_TRIPS_UPDATED_EVENT,
  loadItineraryTrips,
  saveItineraryTrips,
  type ItineraryTrip,
} from "@/lib/itinerary-trips";
import { removeItineraryItem, restoreItineraryItem } from "@/lib/itinerary-remove-restore";
import { departureFromLocation, findPoiByName } from "@/lib/itinerary-route-sync";
import type { MapPoint } from "@/types/map";
import LeafletRouteMap from "@/components/chat/LeafletRouteMap";
import {
  applySwapToItem,
  collectOtherSlotPoiNames,
  pickSwapNext,
  pickSwapPrev,
  type SwapDirection,
} from "@/lib/poi-swap";

type Status = "unbooked" | "pending" | "completed" | "expired";
type ViewMode = "timeline" | "map";

interface ItineraryItem {
  id: string;
  time: string;
  name: string;
  type: "scenic" | "food" | "hotel";
  description: string;
  price: string;
  status: Status;
  code?: string;
  swapCycleIndex?: number;
}

interface DayPlan {
  day: number;
  date: string;
  period: string;
  items: ItineraryItem[];
  removedItems?: ItineraryItem[];
}

const statusConfig = {
  unbooked: { icon: CircleDot, label: "未预定", className: "bg-primary/10 text-primary" },
  pending: { icon: Clock, label: "待核销", className: "bg-muted text-muted-foreground" },
  completed: { icon: CheckCircle2, label: "已核销", className: "bg-meituan-green/10 text-meituan-green" },
  expired: { icon: AlertCircle, label: "已过期", className: "bg-meituan-red/10 text-meituan-red" },
};

const typeIcon = { scenic: MapPin, food: Utensils, hotel: Hotel };
// kept for reference; border colors are now applied via inline style
const _typeColor = { scenic: "border-l-meituan-blue", food: "border-l-meituan-orange", hotel: "border-l-purple-500" };
void _typeColor;

interface ItineraryTabProps {
  openFavoritesRequest?: boolean;
  onFavoritesRequestHandled?: () => void;
}

const ItineraryTab = ({
  openFavoritesRequest = false,
  onFavoritesRequestHandled,
}: ItineraryTabProps) => {
  const { location } = useLocation();
  const homeLabel = location.displayName || location.fullAddress;

  const {
    favoriteTrips,
    savedGuides,
    totalFavoriteCount,
    removeFavoriteTrip,
    removeSavedGuide,
  } = useCollections();
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [trips, setTrips] = useState<ItineraryTrip[]>(loadItineraryTrips);

  const reloadTrips = useCallback(() => {
    setTrips(loadItineraryTrips());
  }, []);

  useEffect(() => {
    const onExternalUpdate = () => reloadTrips();
    window.addEventListener(ITINERARY_TRIPS_UPDATED_EVENT, onExternalUpdate);
    return () => window.removeEventListener(ITINERARY_TRIPS_UPDATED_EVENT, onExternalUpdate);
  }, [reloadTrips]);

  useEffect(() => {
    saveItineraryTrips(trips);
  }, [trips]);

  useEffect(() => {
    if (openFavoritesRequest) {
      setShowFavorites(true);
      onFavoritesRequestHandled?.();
    }
  }, [openFavoritesRequest, onFavoritesRequestHandled]);

  // New trip form
  const [newTitle, setNewTitle] = useState("");
  const [newDates, setNewDates] = useState("");

  const activeTrip = trips.find((t) => t.active);

  const mapDeparturePoint = useMemo(
    () => departureFromLocation({ displayName: location.displayName, fullAddress: location.fullAddress, coords: location.coords }),
    [location],
  );

  const mapRoutePoints = useMemo((): MapPoint[] => {
    if (!activeTrip) return [];
    return activeTrip.days.flatMap((d) =>
      d.items.map((item) => {
        const poi = findPoiByName(item.name);
        return { id: item.id, name: item.name, type: item.type, x: 0, y: 0, lat: poi?.lat, lng: poi?.lng, inRoute: true, description: item.description, price: item.price };
      }),
    );
  }, [activeTrip]);

  const handleDeleteItem = (dayIdx: number, itemId: string) => {
    const active = trips.find((t) => t.active);
    if (!active) return;
    const item = active.days[dayIdx]?.items.find((i) => i.id === itemId);
    const updatedDays = removeItineraryItem(active.days, dayIdx, itemId);
    if (!updatedDays) return;

    setTrips((prev) =>
      prev.map((t) => (t.active ? { ...t, days: updatedDays } : t)),
    );
    if (item) {
      toast.message(`「${item.name}」已移至下方`, {
        description: "在「已移除」里可随时加回来",
        duration: 4000,
      });
    }
  };

  const handleRestoreItem = (dayIdx: number, itemId: string) => {
    const active = trips.find((t) => t.active);
    if (!active) return;
    const item = active.days[dayIdx]?.removedItems?.find((i) => i.id === itemId);
    const updatedDays = restoreItineraryItem(active.days, dayIdx, itemId);
    if (!updatedDays) return;

    setTrips((prev) =>
      prev.map((t) => (t.active ? { ...t, days: updatedDays } : t)),
    );
    if (item) toast.success(`已加回「${item.name}」`);
  };

  const handleCancelItem = (dayIdx: number, itemId: string) => {
    const active = trips.find((t) => t.active);
    if (!active) return;
    const item = active.days[dayIdx]?.items.find((i) => i.id === itemId);
    if (!item) return;
    setTrips((prev) =>
      prev.map((t) =>
        t.active
          ? {
              ...t,
              days: t.days.map((d, i) =>
                i === dayIdx
                  ? {
                      ...d,
                      items: d.items.map((it) =>
                        it.id === itemId
                          ? { ...it, status: "unbooked" as Status, code: undefined }
                          : it,
                      ),
                    }
                  : d,
              ),
            }
          : t,
      ),
    );
    toast.success(`「${item.name}」预定已取消`);
  };

  const handleSwapItem = (dayIdx: number, itemId: string, direction: SwapDirection) => {
    const trip = trips.find((t) => t.active);
    if (!trip) return;
    const item = trip.days[dayIdx]?.items.find((i) => i.id === itemId);
    if (!item) return;

    const otherSlotNames = collectOtherSlotPoiNames(trip.days, {
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
          description: "可在问小喵重新规划",
        });
      }
      return;
    }

    setTrips((prev) =>
      prev.map((t) =>
        t.active
          ? {
              ...t,
              days: t.days.map((d, i) =>
                i === dayIdx
                  ? {
                      ...d,
                      items: d.items.map((it) =>
                        it.id === itemId ? applySwapToItem(it, picked, direction) : it,
                      ),
                    }
                  : d,
              ),
            }
          : t,
      ),
    );
  };

  const handleAddTrip = () => {
    if (!newTitle.trim()) return;
    const newTrip: ItineraryTrip = {
      id: Date.now().toString(),
      title: newTitle,
      dates: newDates || "待定",
      active: false,
      favorited: false,
      days: [],
    };
    setTrips((prev) => [...prev, newTrip]);
    setNewTitle("");
    setNewDates("");
    setShowAddTrip(false);
  };

  const totalItems =
    activeTrip?.days.reduce((sum, d) => sum + d.items.length, 0) ?? 0;
  const bookedCount =
    activeTrip?.days.reduce(
      (sum, d) => sum + d.items.filter((i) => i.status !== "unbooked").length,
      0,
    ) ?? 0;
  const unbookedCount = totalItems - bookedCount;
  const progressPct = totalItems > 0 ? Math.round((bookedCount / totalItems) * 100) : 0;

  const handleViewFavorite = (trip: ItineraryTrip) => {
    setTrips((prev) => {
      const deactivated = prev.map((t) => ({ ...t, active: false }));
      const exists = deactivated.some((t) => t.id === trip.id);
      if (exists) {
        return deactivated.map((t) => ({ ...t, active: t.id === trip.id }));
      }
      return [...deactivated, { ...trip, active: true }];
    });
    setExpandedDay(1);
    setViewMode("timeline");
    setShowFavorites(false);
  };

  const handleUnfavorite = (tripId: string) => {
    removeFavoriteTrip(tripId);
  };

  const handleBookAll = () => {
    setTrips((prev) =>
      prev.map((t) =>
        t.active
          ? {
              ...t,
              days: t.days.map((d) => ({
                ...d,
                items: d.items.map((item) =>
                  item.status === "unbooked"
                    ? { ...item, status: "pending" as Status, code: `MT${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 9000 + 1000)}` }
                    : item
                ),
              })),
            }
          : t
      )
    );
  };

  return (
    <div className="bg-background min-h-full">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-4 pb-3 bg-background"
      >
        {/* Title */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">{activeTrip?.title || "我的行程"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTrip ? `${activeTrip.dates} · ${activeTrip.days.length}个行程段` : "暂无行程"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavorites(true)}
              className="relative w-9 h-9 rounded-2xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Heart className="w-4 h-4" />
              {totalFavoriteCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: "hsl(var(--meituan-red))" }}>
                  {totalFavoriteCount > 99 ? "99+" : totalFavoriteCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowAddTrip(true)}
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
              style={{
                background: "#FBE4BA",
                boxShadow: "0 2px 8px hsl(38 89% 86% / 0.4)",
              }}
            >
              <Plus className="w-4 h-4 text-amber-900" />
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-card rounded-2xl p-1 border border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === "timeline" ? "bg-primary text-amber-900 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-3.5 h-3.5" /> 时间轴
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === "map" ? "bg-primary text-amber-900 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <MapIcon className="w-3.5 h-3.5" /> 地图路线
          </button>
        </div>
      </div>

      <div className="px-4 pb-6 pt-3 space-y-3">
        {/* One-click Book All */}
        {activeTrip && unbookedCount > 0 && (
          <button
            onClick={handleBookAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-amber-900 transition-all active:scale-[0.98]"
            style={{
              background: "#FBE4BA",
              boxShadow: "0 4px 16px hsl(38 89% 86% / 0.45)",
            }}
          >
            <ShoppingCart className="w-4 h-4" />
            一键安排（{unbookedCount}项待预定）
          </button>
        )}

        {/* Progress */}
        {activeTrip && (
          <div
            className="bg-card rounded-2xl border border-border/50 p-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-muted-foreground">行程进度</span>
              <span className="text-xs font-bold text-meituan-green">
                已安排 {bookedCount}/{totalItems}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--meituan-green)), hsl(152 60% 55%))" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

      {viewMode === "timeline" && activeTrip ? (
        <div className="space-y-3">
          {activeTrip.days.map((day, dayIdx) => (
            <div
              key={day.day}
              className="bg-card rounded-2xl border border-border/50 overflow-hidden"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <button
                onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                      boxShadow: "0 2px 8px hsl(43 100% 50% / 0.25)",
                    }}
                  >
                    <span className="text-amber-900 font-extrabold text-sm">D{day.day}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">{day.date} {day.period}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.items.length} 个行程点
                      {(day.removedItems?.length ?? 0) > 0
                        ? ` · ${day.removedItems!.length} 已移除`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className={`w-7 h-7 rounded-xl bg-muted flex items-center justify-center transition-transform ${expandedDay === day.day ? "rotate-180" : ""}`}>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              <AnimatePresence>
                {expandedDay === day.day && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2 border-t border-border/50">
                      {day.items.map((item) => {
                        const Icon = typeIcon[item.type];
                        const StatusIcon = statusConfig[item.status].icon;
                        const borderColors = {
                          scenic: "#3b9eff",
                          food: "#ff7a25",
                          hotel: "#9c6dfa",
                        };
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="mt-2 rounded-xl bg-muted/40 hover:bg-muted/70 cursor-pointer transition-all p-3 border-l-[3px]"
                            style={{ borderLeftColor: borderColors[item.type] }}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[11px] text-muted-foreground font-medium">{item.time}</span>
                                  <span className="font-semibold text-sm truncate">{item.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusConfig[item.status].className}`}>
                                  <StatusIcon className="w-2.5 h-2.5" /> {statusConfig[item.status].label}
                                </span>
                                <span className="text-xs font-bold" style={{ color: "hsl(var(--meituan-red))" }}>{item.price}</span>
                              </div>
                            </div>
                            <div
                              className="relative z-10 flex items-center gap-0.5 mt-2 w-full flex-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleSwapItem(dayIdx, item.id, "prev")}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[9px] font-medium hover:bg-muted/80 hover:text-foreground transition-colors whitespace-nowrap touch-manipulation"
                              >
                                <ChevronLeft className="w-2 h-2 shrink-0 pointer-events-none" />上一家
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwapItem(dayIdx, item.id, "next")}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-meituan-blue/10 text-meituan-blue text-[9px] font-medium hover:bg-meituan-blue/20 transition-colors whitespace-nowrap touch-manipulation"
                              >
                                <RefreshCw className="w-2 h-2 shrink-0 pointer-events-none" />换一家
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(dayIdx, item.id)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-colors whitespace-nowrap touch-manipulation"
                                style={{ background: "hsl(var(--meituan-red) / 0.1)", color: "hsl(var(--meituan-red))" }}
                              >
                                <Trash2 className="w-2 h-2 shrink-0 pointer-events-none" />删除
                              </button>
                              {item.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelItem(dayIdx, item.id)}
                                  className="ml-auto flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-semibold transition-colors whitespace-nowrap touch-manipulation bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="w-2.5 h-2.5 shrink-0 pointer-events-none" />取消预定
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {(day.removedItems?.length ?? 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed border-border/70">
                          <p className="text-[11px] text-muted-foreground font-medium mb-2">
                            已移除 · {day.removedItems!.length} 站（可随时加回）
                          </p>
                          <div className="space-y-2">
                            {day.removedItems!.map((item) => {
                              const Icon = typeIcon[item.type];
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border/50 px-3 py-2"
                                >
                                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      <span className="text-muted-foreground mr-1">{item.time}</span>
                                      {item.name}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestoreItem(dayIdx, item.id);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-meituan-green/10 text-meituan-green text-[11px] font-semibold hover:bg-meituan-green/20 shrink-0"
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
        </div>
      ) : viewMode === "map" && activeTrip ? (
        <div className="rounded-2xl overflow-hidden border border-border/60">
          <LeafletRouteMap
            departurePoint={mapDeparturePoint}
            routePoints={mapRoutePoints}
          />
        </div>
      ) : !activeTrip ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-foreground">还没有行程</p>
          <p className="text-xs text-muted-foreground mt-1">
            在「问小喵」规划后点击「添加到我的行程」，或点右上角新建
          </p>
        </div>
      ) : null}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-5 pb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{selectedItem.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedItem.time} · {selectedItem.description}</p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${statusConfig[selectedItem.status].className}`}>
                    {statusConfig[selectedItem.status].label}
                  </span>
                </div>
                <div className="bg-muted/60 rounded-2xl p-4 mb-4 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">价格</span>
                    <span className="font-extrabold text-lg" style={{ color: "hsl(var(--meituan-red))" }}>{selectedItem.price}</span>
                  </div>
                  {selectedItem.code && (
                    <div className="border-t border-border/50 pt-3 mt-3">
                      <p className="text-xs text-muted-foreground mb-2">核销码</p>
                      <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
                        <p className="text-2xl font-mono font-bold tracking-widest">{selectedItem.code}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedItem.status === "unbooked" && (
                    <button
                      className="flex-1 py-3 rounded-2xl font-bold text-sm text-amber-900 transition-all active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, hsl(26 95% 52%), hsl(16 90% 50%))",
                        boxShadow: "0 3px 12px hsl(26 95% 52% / 0.35)",
                      }}
                    >
                      立即预定
                    </button>
                  )}
                  {selectedItem.status === "pending" && (
                    <>
                      <button
                        className="flex-1 py-3 rounded-2xl font-bold text-sm text-amber-900 transition-all"
                        style={{ background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))", boxShadow: "0 3px 12px hsl(43 100% 50% / 0.3)" }}
                      >
                        {selectedItem.code ? "出示凭证" : "立即购买"}
                      </button>
                      <button className="px-5 py-3 bg-muted rounded-2xl font-bold text-sm hover:bg-secondary transition-colors">导航</button>
                    </>
                  )}
                  {selectedItem.status === "expired" && (
                    <button className="flex-1 py-3 rounded-2xl font-bold text-sm text-white" style={{ background: "hsl(var(--meituan-red))" }}>申请退款</button>
                  )}
                  {selectedItem.status === "completed" && (
                    <div className="flex-1 py-3 rounded-2xl font-bold text-sm text-center text-meituan-green bg-meituan-green/10">✓ 核销成功</div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Favorites Drawer */}
      <AnimatePresence>
        {showFavorites && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowFavorites(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl w-full max-w-[430px] max-h-[70vh] overflow-y-auto pb-24"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border" /></div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span className="text-lg">📌</span> 收藏夹
                </h3>
                <button onClick={() => setShowFavorites(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {totalFavoriteCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无收藏，可在「探索」中收藏攻略</p>
                ) : (
                  <>
                    {favoriteTrips.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground px-1">行程方案</p>
                    )}
                    {favoriteTrips.map((trip) => (
                      <div key={trip.id} className="p-4 rounded-2xl bg-muted/50 border border-border/50">
                        <h4 className="font-semibold text-sm">{trip.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{trip.dates}</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleViewFavorite(trip)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-amber-900 transition-all active:scale-[0.98]"
                            style={{ background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))" }}
                          >
                            查看详情
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnfavorite(trip.id)}
                            className="px-3 py-2 bg-muted text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-colors active:scale-[0.98]"
                          >
                            取消收藏
                          </button>
                        </div>
                      </div>
                    ))}
                    {savedGuides.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground px-1 pt-2">探索攻略</p>
                    )}
                    {savedGuides.map((guide) => (
                      <div key={guide.id} className="p-4 rounded-2xl bg-muted/50 border border-border/50 flex gap-3">
                        <img src={guide.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-2">{guide.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{guide.author}</p>
                          <div className="flex gap-2 mt-3">
                            <span className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-muted-foreground bg-card border border-border/50">
                              <Bookmark className="w-3 h-3 fill-primary text-primary" />
                              来自探索
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSavedGuide(guide.id)}
                              className="px-3 py-2 bg-muted text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-colors active:scale-[0.98]"
                            >
                              取消收藏
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Trip Modal */}
      <AnimatePresence>
        {showAddTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowAddTrip(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl w-full max-w-[430px]"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border" /></div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span className="text-lg">✈️</span> 新建行程
                </h3>
                <button onClick={() => setShowAddTrip(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wide">行程名称</label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：成都3日美食之旅"
                    className="w-full px-4 py-3 rounded-2xl border border-border/70 bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wide">出行日期</label>
                  <input
                    value={newDates}
                    onChange={(e) => setNewDates(e.target.value)}
                    placeholder="例如：5月1日 - 5月3日"
                    className="w-full px-4 py-3 rounded-2xl border border-border/70 bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
                <button
                  onClick={handleAddTrip}
                  disabled={!newTitle.trim()}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 transition-all disabled:opacity-40 active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                    boxShadow: "0 3px 12px hsl(43 100% 50% / 0.3)",
                  }}
                >
                  创建行程
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default ItineraryTab;
