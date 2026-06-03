import { MapPin, Ticket, Heart, Settings, ChevronRight, Trophy, Compass, Star, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

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
  { name: "星光亲子乐园门票", status: "已核销", price: "¥128", statusColor: "text-meituan-green", dot: "bg-meituan-green" },
  { name: "绿茶山轻食套餐", status: "待核销", price: "¥68", statusColor: "text-meituan-orange", dot: "bg-meituan-orange" },
  { name: "天天奶茶团购券", status: "待核销", price: "¥28", statusColor: "text-meituan-orange", dot: "bg-meituan-orange" },
];

const menuItems = [
  { label: "收藏的地点", icon: Heart, count: "23", color: "text-red-500", bg: "bg-red-50" },
  { label: "我的订单", icon: Ticket, count: "8", color: "text-meituan-blue", bg: "bg-meituan-blue/10" },
  { label: "行程提醒设置", icon: Settings, color: "text-muted-foreground", bg: "bg-muted" },
];

const ProfileTab = () => {
  return (
    <div className="bg-background min-h-full pb-8">
      {/* ── Hero header ── */}
      <div
        className="relative px-5 pt-10 pb-6 overflow-hidden bg-background"
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/8 -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-meituan-orange/8 translate-y-6 -translate-x-4" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center gap-4"
        >
          {/* Avatar */}
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
            <h2 className="text-[18px] font-bold tracking-tight">周末探索者</h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-meituan-green inline-block" />
              已绑定美团账号
            </p>
          </div>

          <button className="px-3.5 py-1.5 rounded-full border border-border/80 text-xs font-semibold bg-card hover:bg-muted transition-colors" style={{ boxShadow: "var(--shadow-card)" }}>
            编辑
          </button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-3 gap-3 mt-5"
        >
          {stats.map((stat, idx) => (
            <div
              key={stat.label}
              className="bg-card rounded-2xl p-3 text-center border border-border/50"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-1.5`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-[20px] font-bold leading-none mb-0.5">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="px-4 space-y-4">
        {/* ── City Footprints ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" /> 城市足迹
            </h3>
            <button className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
              全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {cities.map((city) => (
              <div
                key={city.name}
                className="min-w-[110px] bg-card rounded-2xl border border-border/50 p-3 hover:shadow-card-hover transition-shadow cursor-pointer shrink-0 overflow-hidden relative"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${city.color} opacity-60`} />
                <div className="relative">
                  <div className="text-2xl mb-1.5">{city.emoji}</div>
                  <p className="font-bold text-sm">{city.name}</p>
                  <p className="text-[11px] text-muted-foreground">去过{city.visits}次 · {city.spots}景点</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Recent Orders ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-primary" /> 最近订单
            </h3>
            <button className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
              全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div
            className="bg-card rounded-2xl border border-border/50 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {orders.map((order, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors ${idx < orders.length - 1 ? "border-b border-border/50" : ""}`}
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
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Travel Report Banner ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div
            className="rounded-2xl p-4 cursor-pointer overflow-hidden relative hover:opacity-95 transition-opacity active:scale-[0.99]"
            style={{
              background: "#FBE4BA",
              boxShadow: "0 4px 20px hsl(38 89% 86% / 0.45)",
            }}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-amber-900/5" />
            <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-amber-900/5" />
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
          </div>
        </motion.div>

        {/* ── Menu ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div
            className="bg-card rounded-2xl border border-border/50 overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {menuItems.map((item, idx) => (
              <div
                key={item.label}
                className={`flex items-center justify-between px-4 py-4 hover:bg-muted/40 cursor-pointer transition-colors ${idx < menuItems.length - 1 ? "border-b border-border/50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.count && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.count}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileTab;
