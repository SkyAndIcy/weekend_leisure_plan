import { useState } from "react";
import { MapPin, Utensils, Hotel, CheckCircle2, Clock, AlertCircle, ChevronDown, Plus, Map as MapIcon, List, Trash2, RefreshCw, X, Heart, ShoppingCart, CircleDot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface DayPlan {
  day: number;
  date: string;
  period: string;
  items: ItineraryItem[];
}

interface Trip {
  id: string;
  title: string;
  dates: string;
  days: DayPlan[];
  active: boolean;
  favorited: boolean;
}

const mockTrips: Trip[] = [
  {
    id: "1",
    title: "周末下午亲子半日游",
    dates: "今天下午",
    active: true,
    favorited: false,
    days: [
      {
        day: 1, date: "周六下午", period: "半日游",
        items: [
          { id: "1", time: "14:00", name: "星光亲子乐园", type: "scenic", description: "室内乐园，小滑梯跨路迎天都有", price: "¥128/人", status: "completed", code: "MT20250501-3321" },
          { id: "2", time: "16:30", name: "世纪金源购物中心", type: "scenic", description: "逛潮流，送孩子打卡拍照", price: "免费", status: "completed" },
          { id: "3", time: "17:30", name: "绿茶山轻食餐厅", type: "food", description: "健康沙拉、鸡辛汤面，老婆最爱的减脂小馆", price: "人均¥68", status: "pending", code: "MT20250501-8819" },
          { id: "4", time: "19:00", name: "奠江十街天天奶茶", type: "food", description: "芹果塔小雏、秘芷小料心等网红饮品", price: "人均¥28", status: "unbooked" },
        ],
      },
    ],
  },
];

const mockFavorites: Trip[] = [
  {
    id: "f1",
    title: "上周末亲子游方案",
    dates: "周六下午，共3小时",
    active: false,
    favorited: true,
    days: [],
  },
  {
    id: "f2",
    title: "朋友聚会包吹方案",
    dates: "周日下午，共4人",
    active: false,
    favorited: true,
    days: [],
  },
];

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

const ItineraryTab = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [trips, setTrips] = useState(mockTrips);
  const [favorites] = useState(mockFavorites);
  

  // New trip form
  const [newTitle, setNewTitle] = useState("");
  const [newDates, setNewDates] = useState("");

  const activeTrip = trips.find((t) => t.active);

  const handleDeleteItem = (dayIdx: number, itemId: string) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.active
          ? { ...t, days: t.days.map((d, i) => (i === dayIdx ? { ...d, items: d.items.filter((item) => item.id !== itemId) } : d)) }
          : t
      )
    );
  };

  const handleRefreshItem = (dayIdx: number, itemId: string) => {
    const replacements: Record<string, { name: string; description: string; price: string }> = {
      scenic: { name: "太子湾公园", description: "赏花胜地，春日必去", price: "免费" },
      food: { name: "弄堂里·杭帮菜", description: "地道杭帮菜，环境雅致", price: "人均¥95" },
      hotel: { name: "桂语山房酒店", description: "隐于山林，禅意体验", price: "¥528" },
    };
    setTrips((prev) =>
      prev.map((t) =>
        t.active
          ? {
              ...t,
              days: t.days.map((d, i) =>
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
              ),
            }
          : t
      )
    );
    
  };

  const handleAddTrip = () => {
    if (!newTitle.trim()) return;
    const newTrip: Trip = {
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

  const unbookedCount = activeTrip?.days.reduce((sum, d) => sum + d.items.filter((i) => i.status === "unbooked").length, 0) || 0;

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
              {favorites.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: "hsl(var(--meituan-red))" }}>
                  {favorites.length}
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
              <span className="text-xs font-bold text-meituan-green">已安排 2/4</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "22%" }}
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
                    <p className="text-xs text-muted-foreground">{day.items.length} 个行程点</p>
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
                            <div className="flex justify-end gap-1.5 mt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRefreshItem(dayIdx, item.id); }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-meituan-blue/10 text-meituan-blue text-[11px] font-semibold hover:bg-meituan-blue/20 transition-colors"
                              >
                                <RefreshCw className="w-2.5 h-2.5" /> 换一个
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(dayIdx, item.id); }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                                style={{ background: "hsl(var(--meituan-red) / 0.1)", color: "hsl(var(--meituan-red))" }}
                              >
                                <Trash2 className="w-2.5 h-2.5" /> 删除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ) : viewMode === "map" ? (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="aspect-[4/3] bg-[hsl(210_20%_95%)] relative overflow-hidden">
            <div className="absolute top-[25%] left-[20%] w-[35%] h-[30%] rounded-[50%] bg-[hsl(200_60%_85%)] opacity-60" />
            <div className="absolute top-[30%] left-[25%] w-[25%] h-[20%] rounded-[50%] bg-[hsl(200_60%_80%)] opacity-50" />
            <p className="absolute top-[38%] left-[30%] text-[10px] text-[hsl(200_50%_55%)] font-medium">西湖</p>
            <div className="absolute top-[15%] left-[10%] w-[80%] h-[1px] bg-[hsl(0_0%_75%)]" />
            <div className="absolute top-[55%] left-[5%] w-[90%] h-[1px] bg-[hsl(0_0%_75%)]" />
            <div className="absolute top-[10%] left-[50%] w-[1px] h-[80%] bg-[hsl(0_0%_75%)]" />
            <div className="absolute top-[10%] left-[75%] w-[1px] h-[70%] bg-[hsl(0_0%_75%)]" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
              <polyline points="120,60 200,100 300,80 280,170 160,200 240,250" fill="none" stroke="hsl(43 100% 50%)" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
            </svg>
            <div className="absolute top-[18%] left-[28%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-meituan-blue flex items-center justify-center shadow-md border-2 border-card"><MapPin className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">西湖风景区</span>
            </div>
            <div className="absolute top-[30%] left-[72%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-meituan-blue flex items-center justify-center shadow-md border-2 border-card"><MapPin className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">灵隐寺</span>
            </div>
            <div className="absolute top-[22%] left-[48%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-meituan-blue flex items-center justify-center shadow-md border-2 border-card"><MapPin className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">龙井茶园</span>
            </div>
            <div className="absolute top-[55%] left-[65%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-meituan-orange flex items-center justify-center shadow-md border-2 border-card"><Utensils className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">楼外楼</span>
            </div>
            <div className="absolute top-[63%] left-[35%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-meituan-orange flex items-center justify-center shadow-md border-2 border-card"><Utensils className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">河坊街夜市</span>
            </div>
            <div className="absolute top-[78%] left-[55%] flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center shadow-md border-2 border-card"><Hotel className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[9px] mt-0.5 font-medium bg-card/80 px-1 rounded">西湖亚朵酒店</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 py-2 border-t border-border">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-meituan-blue" /><span className="text-[10px] text-muted-foreground">景点</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-meituan-orange" /><span className="text-[10px] text-muted-foreground">美食</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-[10px] text-muted-foreground">酒店</span></div>
          </div>
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
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowFavorites(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl w-full max-w-[430px] max-h-[70vh] overflow-y-auto"
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
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无收藏的行程</p>
                ) : (
                  favorites.map((trip) => (
                    <div key={trip.id} className="p-4 rounded-2xl bg-muted/50 border border-border/50">
                      <h4 className="font-semibold text-sm">{trip.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{trip.dates}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          className="flex-1 py-2 rounded-xl text-xs font-bold text-amber-900 transition-all"
                          style={{ background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))" }}
                        >
                          查看详情
                        </button>
                        <button className="px-3 py-2 bg-muted text-foreground rounded-xl text-xs font-semibold hover:bg-secondary transition-colors">取消收藏</button>
                      </div>
                    </div>
                  ))
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
