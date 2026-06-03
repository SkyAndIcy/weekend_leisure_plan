import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Settings, Plus, MessageSquarePlus, ChevronRight } from "lucide-react";

// ── Mock history data (按时间分组)
const HISTORY_GROUPS = [
  {
    label: "今天",
    items: [
      { id: "h1", title: "带5岁孩子去朝阳公园半日游" },
      { id: "h2", title: "三里屯附近亲子餐厅推荐" },
      { id: "h3", title: "周末带父母去颐和园轻松游" },
    ],
  },
  {
    label: "本周",
    items: [
      { id: "h4", title: "望京SOHO附近下午茶+逛街" },
      { id: "h5", title: "798艺术区拍照打卡路线" },
      { id: "h6", title: "中关村科技馆一日游规划" },
    ],
  },
  {
    label: "本月",
    items: [
      { id: "h7", title: "奥林匹克森林公园骑行" },
      { id: "h8", title: "南锣鼓巷美食探店攻略" },
      { id: "h9", title: "什刹海划船+周边游玩" },
    ],
  },
  {
    label: "更早",
    items: [
      { id: "h10", title: "故宫半日游路线推荐" },
      { id: "h11", title: "天坛公园游览建议" },
      { id: "h12", title: "北海公园野餐安排" },
    ],
  },
];

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
  currentLocationName: string;
  onLocationClick: () => void;
}

// 侧栏占主容器约 78%
const SIDEBAR_WIDTH = "78%";

const HistorySidebar = ({ open, onClose, onSelectChat }: HistorySidebarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = searchQuery.trim()
    ? HISTORY_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((g) => g.items.length > 0)
    : HISTORY_GROUPS;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — 仅覆盖移动框内右侧区域，点击关闭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[65]"
            style={{ background: "rgba(0,0,0,0.18)" }}
            onClick={onClose}
          />

          {/* Sidebar panel — 在移动框内从左滑出 */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute top-0 left-0 z-[70] h-full bg-background flex flex-col shadow-2xl"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* ── Header：标题 + 搜索 + 设置 ── */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-11 pb-3 bg-background">

              <h1 className="text-[22px] font-bold tracking-tight">周末喵</h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/70 active:bg-muted transition-colors"
                  aria-label="搜索"
                >
                  <Search className="w-[18px] h-[18px] text-foreground/80" />
                </button>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/70 active:bg-muted transition-colors"
                  aria-label="设置"
                >
                  <Settings className="w-[18px] h-[18px] text-foreground/80" />
                </button>
              </div>
            </div>

            {/* ── New chat 大按钮（顶部） ── */}
            <div className="shrink-0 px-4 pt-1 pb-3">
              <button
                onClick={onClose}
                className="w-full h-12 rounded-full flex items-center justify-center gap-2 bg-muted/70 hover:bg-muted active:scale-[0.99] transition-all text-foreground"
              >
                <MessageSquarePlus className="w-[18px] h-[18px]" />
                <span className="text-[15px] font-semibold">新建对话</span>
              </button>
            </div>

            {/* 可展开搜索框 */}
            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="shrink-0 overflow-hidden px-4"
                >
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索对话…"
                    className="w-full h-10 px-4 mb-2 rounded-xl bg-muted border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scrollable list ── */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* 分组 section */}
              <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">分组</span>
                <button className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-muted/40 transition-colors">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-base">📁</span> 分组示例
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
              </button>

              {filteredGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-10">没有找到相关对话</p>
              )}

              {filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-1.5">
                    <span className="text-xs text-muted-foreground">{group.label}</span>
                  </div>
                  <div>
                    {group.items.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => { onSelectChat(item.id); onClose(); }}
                        className={`w-full text-left px-4 mx-0 py-3 transition-colors ${
                          group.label === "今天" && idx === 0
                            ? "bg-muted/70 rounded-xl"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <p className="text-sm font-medium truncate pr-2">{item.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="h-6" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HistorySidebar;
