import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Settings, MessageSquarePlus, Trash2 } from "lucide-react";
import { groupSessionsByTime, type ChatSession } from "@/lib/chat-sessions";

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  currentLocationName: string;
  onLocationClick: () => void;
}

const SIDEBAR_WIDTH = "78%";

const HistorySidebar = ({
  open,
  onClose,
  sessions,
  activeSessionId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: HistorySidebarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    const asSessions = list.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      messages: s.messages,
    }));
    return groupSessionsByTime(asSessions);
  }, [sessions, searchQuery]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[65]"
            style={{ background: "rgba(0,0,0,0.18)" }}
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute top-0 left-0 z-[70] h-full bg-background flex flex-col shadow-2xl"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 pt-11 pb-3 bg-background">
              <h1 className="text-[22px] font-bold tracking-tight">周末喵</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/70 active:bg-muted transition-colors"
                  aria-label="搜索"
                >
                  <Search className="w-[18px] h-[18px] text-foreground/80" />
                </button>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/70 active:bg-muted transition-colors"
                  aria-label="设置"
                >
                  <Settings className="w-[18px] h-[18px] text-foreground/80" />
                </button>
              </div>
            </div>

            <div className="shrink-0 px-4 pt-1 pb-3">
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="w-full h-12 rounded-full flex items-center justify-center gap-2 bg-muted/70 hover:bg-muted active:scale-[0.99] transition-all text-foreground"
              >
                <MessageSquarePlus className="w-[18px] h-[18px]" />
                <span className="text-[15px] font-semibold">新建对话</span>
              </button>
            </div>

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

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-10 px-4">
                  暂无历史，发一条消息后会自动保存
                </p>
              )}

              {filteredGroups.length === 0 && sessions.length > 0 && (
                <p className="text-sm text-muted-foreground text-center pt-10">没有找到相关对话</p>
              )}

              {filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-1.5">
                    <span className="text-xs text-muted-foreground">{group.label}</span>
                  </div>
                  <div>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-0.5 mx-2 mb-0.5 rounded-xl transition-colors ${
                          item.id === activeSessionId ? "bg-muted/70" : "hover:bg-muted/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectChat(item.id);
                            onClose();
                          }}
                          className="flex-1 min-w-0 text-left px-3 py-3"
                        >
                          <p className="text-sm font-medium truncate">{item.title}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteChat(item.id)}
                          className="shrink-0 w-9 h-9 mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`删除对话：${item.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
