import { useState } from "react";
import {
  MapPin,
  Ticket,
  Heart,
  Settings,
  ChevronRight,
  Trophy,
  Compass,
  TrendingUp,
  X,
  Bell,
  Bookmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCollections } from "@/contexts/collections-context";
import type { TabId } from "@/components/TabNavigation";

type SheetId =
  | "edit"
  | "cities"
  | "orders"
  | "order-detail"
  | "settings"
  | "report"
  | "stat"
  | "favorites"
  | null;

const stats = [
  { label: "探索城市", value: "12", icon: MapPin, color: "text-meituan-blue", bg: "bg-meituan-blue/10" },
  { label: "打卡地点", value: "38", icon: Compass, color: "text-meituan-orange", bg: "bg-meituan-orange/10" },
  { label: "出行天数", value: "56", icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
];

const cities = [
  { name: "杭州", visits: 3, spots: 8, emoji: "🏯", color: "from-blue-400/20 to-cyan-400/20" },
  { name: "上海", visits: 5, spots: 6, emoji: "🌃", color: "from-purple-400/20 to-pink-400/20" },
  { name: "成都", visits: 2, spots: 5, emoji: "🐼", color: "from-green-400/20 to-emerald-400/20" },
  { name: "北京", visits: 4, spots: 10, emoji: "🏰", color: "from-red-400/20 to-orange-400/20" },
];

const orders = [
  { id: "o1", name: "星光亲子乐园门票", status: "已核销", price: "¥128", statusColor: "text-meituan-green", dot: "bg-meituan-green", code: "MT20250501-3321" },
  { id: "o2", name: "绿茶山轻食套餐", status: "待核销", price: "¥68", statusColor: "text-meituan-orange", dot: "bg-meituan-orange", code: "MT20250501-8819" },
  { id: "o3", name: "天天奶茶团购券", status: "待核销", price: "¥28", statusColor: "text-meituan-orange", dot: "bg-meituan-orange", code: "MT20250501-7720" },
];

function ProfileSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-3xl w-full max-w-[430px] max-h-[80vh] overflow-y-auto pb-24"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 sticky top-0 bg-card z-10">
          <h3 className="font-bold text-base">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

interface ProfileTabProps {
  onTabChange?: (tab: TabId) => void;
  onOpenItineraryFavorites?: () => void;
}

const ProfileTab = ({ onTabChange, onOpenItineraryFavorites }: ProfileTabProps) => {
  const {
    favoriteTrips,
    savedGuides,
    totalFavoriteCount,
    removeFavoriteTrip,
    removeSavedGuide,
  } = useCollections();
  const [sheet, setSheet] = useState<SheetId>(null);
  const [nickname, setNickname] = useState("周末探索者");
  const [editName, setEditName] = useState(nickname);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [remindPush, setRemindPush] = useState(true);
  const [remindSms, setRemindSms] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const openOrderDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSheet("order-detail");
  };

  const handleMenuFavorites = () => {
    setSheet("favorites");
  };

  return (
    <div className="bg-background min-h-full pb-8">
      <div className="relative px-5 pt-10 pb-6 overflow-hidden bg-background">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/8 -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-meituan-orange/8 translate-y-6 -translate-x-4" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center gap-4"
        >
          <div className="relative">
            <div
              className="w-16 h-16 rounded-[22px] flex items-center justify-center text-3xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, hsl(43 100% 50% / 0.3), hsl(33 95% 52% / 0.2))",
                border: "2.5px solid hsl(43 100% 50% / 0.3)",
              }}
            >
              🧳
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-meituan-green rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">✓</span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-[18px] font-bold tracking-tight">{nickname}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-meituan-green inline-block" />
              已绑定美团账号
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditName(nickname);
              setSheet("edit");
            }}
            className="px-3.5 py-1.5 rounded-full border border-border/80 text-xs font-semibold bg-card hover:bg-muted transition-colors active:scale-95"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            编辑
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-3 gap-3 mt-5"
        >
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                setSheet("stat");
                toast.message(stat.label, { description: `累计 ${stat.value}` });
              }}
              className="bg-card rounded-2xl p-3 text-center border border-border/50 active:scale-[0.98] transition-transform"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-1.5`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-[20px] font-bold leading-none mb-0.5">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </button>
          ))}
        </motion.div>
      </div>

      <div className="px-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" /> 城市足迹
            </h3>
            <button
              type="button"
              onClick={() => setSheet("cities")}
              className="text-xs text-muted-foreground font-medium flex items-center gap-0.5 active:opacity-70"
            >
              全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {cities.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => {
                  setSheet("cities");
                  toast.message(`${city.name}`, {
                    description: `去过 ${city.visits} 次 · ${city.spots} 个景点`,
                  });
                }}
                className="min-w-[110px] bg-card rounded-2xl border border-border/50 p-3 hover:shadow-card-hover transition-shadow shrink-0 overflow-hidden relative text-left active:scale-[0.98]"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${city.color} opacity-60`} />
                <div className="relative">
                  <div className="text-2xl mb-1.5">{city.emoji}</div>
                  <p className="font-bold text-sm">{city.name}</p>
                  <p className="text-[11px] text-muted-foreground">去过{city.visits}次 · {city.spots}景点</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-primary" /> 最近订单
            </h3>
            <button
              type="button"
              onClick={() => setSheet("orders")}
              className="text-xs text-muted-foreground font-medium flex items-center gap-0.5 active:opacity-70"
            >
              全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div
            className="bg-card rounded-2xl border border-border/50 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {orders.map((order, idx) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openOrderDetail(order.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left ${idx < orders.length - 1 ? "border-b border-border/50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${order.dot}`} />
                  <div>
                    <p className="text-sm font-semibold">{order.name}</p>
                    <p className={`text-xs font-medium ${order.statusColor}`}>{order.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{order.price}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <button
            type="button"
            onClick={() => setSheet("report")}
            className="w-full rounded-2xl p-4 overflow-hidden relative hover:opacity-95 transition-opacity active:scale-[0.99] text-left"
            style={{
              background: "#FBE4BA",
              boxShadow: "0 4px 20px hsl(38 89% 86% / 0.45)",
            }}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-amber-900/5" />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-900/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-900" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-amber-900 text-sm">查看我的出行报告</p>
                <p className="text-amber-900/70 text-xs mt-0.5">了解你的本地探索偏好</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-900/70" />
            </div>
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div
            className="bg-card rounded-2xl border border-border/50 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <button
              type="button"
              onClick={handleMenuFavorites}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-semibold">收藏的地点</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {totalFavoriteCount}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSheet("orders")}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-meituan-blue/10 flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-meituan-blue" />
                </div>
                <span className="text-sm font-semibold">我的订单</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {orders.length}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSheet("settings")}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-semibold">行程提醒设置</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {sheet === "edit" && (
          <ProfileSheet title="编辑资料" onClose={() => setSheet(null)}>
            <label className="text-xs font-semibold text-muted-foreground">昵称</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-2 w-full h-11 px-4 rounded-2xl bg-muted border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="输入昵称"
            />
            <button
              type="button"
              onClick={() => {
                if (editName.trim()) {
                  setNickname(editName.trim());
                  setSheet(null);
                  toast.success("资料已保存");
                }
              }}
              className="mt-4 w-full py-3 rounded-2xl font-bold text-sm text-amber-900"
              style={{ background: "#FBE4BA" }}
            >
              保存
            </button>
          </ProfileSheet>
        )}

        {sheet === "cities" && (
          <ProfileSheet title="城市足迹" onClose={() => setSheet(null)}>
            <div className="space-y-2">
              {cities.map((city) => (
                <button
                  key={city.name}
                  type="button"
                  onClick={() =>
                    toast.message(city.name, {
                      description: `共 ${city.visits} 次出行 · ${city.spots} 个打卡点`,
                    })
                  }
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 text-left active:scale-[0.99]"
                >
                  <span className="text-2xl">{city.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{city.name}</p>
                    <p className="text-xs text-muted-foreground">去过{city.visits}次 · {city.spots}景点</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </ProfileSheet>
        )}

        {sheet === "orders" && (
          <ProfileSheet title="我的订单" onClose={() => setSheet(null)}>
            <div className="space-y-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openOrderDetail(order.id)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/50 text-left active:scale-[0.99]"
                >
                  <div>
                    <p className="font-semibold text-sm">{order.name}</p>
                    <p className={`text-xs font-medium ${order.statusColor}`}>{order.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{order.price}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </ProfileSheet>
        )}

        {sheet === "order-detail" && selectedOrder && (
          <ProfileSheet title="订单详情" onClose={() => setSheet(null)}>
            <p className="font-bold text-base">{selectedOrder.name}</p>
            <p className={`text-sm font-medium mt-1 ${selectedOrder.statusColor}`}>{selectedOrder.status}</p>
            <p className="text-2xl font-extrabold mt-3" style={{ color: "hsl(var(--meituan-red))" }}>
              {selectedOrder.price}
            </p>
            {selectedOrder.code && (
              <div className="mt-4 p-4 rounded-2xl bg-muted/60 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">核销码</p>
                <p className="text-xl font-mono font-bold tracking-widest text-center">{selectedOrder.code}</p>
              </div>
            )}
            {selectedOrder.status === "待核销" && (
              <button
                type="button"
                onClick={() => toast.success("已打开核销码（演示）")}
                className="mt-4 w-full py-3 rounded-2xl font-bold text-sm text-amber-900"
                style={{ background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))" }}
              >
                出示凭证
              </button>
            )}
          </ProfileSheet>
        )}

        {sheet === "settings" && (
          <ProfileSheet title="行程提醒设置" onClose={() => setSheet(null)}>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/50 cursor-pointer">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="w-4 h-4" /> App 推送提醒
                </span>
                <input
                  type="checkbox"
                  checked={remindPush}
                  onChange={(e) => {
                    setRemindPush(e.target.checked);
                    toast.message(e.target.checked ? "已开启推送" : "已关闭推送");
                  }}
                  className="w-5 h-5 accent-primary"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/50 cursor-pointer">
                <span className="text-sm font-medium">短信提醒（出发前 1 小时）</span>
                <input
                  type="checkbox"
                  checked={remindSms}
                  onChange={(e) => {
                    setRemindSms(e.target.checked);
                    toast.message(e.target.checked ? "已开启短信" : "已关闭短信");
                  }}
                  className="w-5 h-5 accent-primary"
                />
              </label>
            </div>
          </ProfileSheet>
        )}

        {sheet === "report" && (
          <ProfileSheet title="出行报告" onClose={() => setSheet(null)}>
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <p className="font-bold text-amber-900">本周末偏好 · 亲子 + 轻食</p>
                <p className="text-xs text-muted-foreground mt-1">基于最近 8 次本地半日规划</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["最爱商圈", "三里屯 / 望京"],
                  ["平均时长", "4.2 小时"],
                  ["常去类型", "乐园 · 轻食"],
                  ["收藏攻略", `${savedGuides.length} 篇`],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-semibold mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                行程方案收藏 {favoriteTrips.length} 条 · 探索攻略 {savedGuides.length} 篇
              </p>
              {onTabChange && (
                <button
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    onTabChange("ask");
                    toast.message("去问小团规划下一程");
                  }}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-amber-900"
                  style={{ background: "#FBE4BA" }}
                >
                  规划下一程
                </button>
              )}
            </div>
          </ProfileSheet>
        )}

        {sheet === "favorites" && (
          <ProfileSheet title={`我的收藏（${totalFavoriteCount}）`} onClose={() => setSheet(null)}>
            {totalFavoriteCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无收藏，可在「探索」收藏攻略，或在「行程」收藏方案
              </p>
            ) : (
              <div className="space-y-4">
                {favoriteTrips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">行程方案</p>
                    <div className="space-y-2">
                      {favoriteTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className="p-3 rounded-2xl bg-muted/50 border border-border/50"
                        >
                          <p className="font-semibold text-sm">{trip.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{trip.dates}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSheet(null);
                                onOpenItineraryFavorites?.();
                              }}
                              className="flex-1 py-2 rounded-xl text-xs font-bold text-amber-900"
                              style={{
                                background:
                                  "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                              }}
                            >
                              在行程中查看
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeFavoriteTrip(trip.id);
                                toast.message("已取消收藏");
                              }}
                              className="px-3 py-2 bg-muted rounded-xl text-xs font-semibold"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {savedGuides.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">探索攻略</p>
                    <div className="space-y-2">
                      {savedGuides.map((guide) => (
                        <div
                          key={guide.id}
                          className="p-3 rounded-2xl bg-muted/50 border border-border/50 flex gap-3"
                        >
                          <img
                            src={guide.image}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm line-clamp-2">{guide.title}</p>
                            <p className="text-xs text-muted-foreground">{guide.author}</p>
                            <button
                              type="button"
                              onClick={() => {
                                removeSavedGuide(guide.id);
                                toast.message("已取消收藏");
                              }}
                              className="mt-2 px-3 py-1.5 bg-muted rounded-lg text-xs font-semibold"
                            >
                              取消收藏
                            </button>
                          </div>
                          <Bookmark className="w-4 h-4 fill-primary text-primary shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ProfileSheet>
        )}

        {sheet === "stat" && (
          <ProfileSheet title="探索数据" onClose={() => setSheet(null)}>
            <div className="grid grid-cols-1 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </ProfileSheet>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileTab;
