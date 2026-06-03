import { useState, useMemo, useCallback } from "react";
import { Heart, MessageCircle, Bookmark, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCollections } from "@/contexts/collections-context";
import hangzhouImg from "@/assets/travel-hangzhou.jpg";
import dimsumImg from "@/assets/food-dimsum.jpg";
import hotelImg from "@/assets/hotel-room.jpg";
import nanjingImg from "@/assets/travel-nanjing.jpg";
import nightmarketImg from "@/assets/food-nightmarket.jpg";

interface GuideCard {
  id: string;
  image: string;
  title: string;
  author: string;
  avatar: string;
  likes: number;
  comments: number;
  tags: string[];
  liked: boolean;
  saved: boolean;
}

const mockGuides: GuideCard[] = [
  { id: "1", image: hangzhouImg, title: "亲子乐园半日游｜孩子狂欢的遛娃玩法大公开", author: "妈妈爱探索", avatar: "👩‍👧", likes: 3218, comments: 245, tags: ["亲子", "乐园"], liked: false, saved: false },
  { id: "2", image: dimsumImg, title: "周末轻食餐厅合集｜老婆说好吃的健康餐厅全推荐", author: "美食探店家", avatar: "👨‍🍳", likes: 1892, comments: 256, tags: ["轻食", "健康"], liked: false, saved: false },
  { id: "3", image: hotelImg, title: "下午茶好去处合集｜环境格调高+美味平价高分", author: "和闺蜜下午茶", avatar: "☕", likes: 2567, comments: 198, tags: ["下午茶", "休闲"], liked: false, saved: false },
  { id: "4", image: nanjingImg, title: "城市公园漫步指南｜附近免费好去处整理", author: "漫步达人", avatar: "🌿", likes: 1567, comments: 123, tags: ["公园", "户外"], liked: false, saved: false },
  { id: "5", image: nightmarketImg, title: "家庭聚餐餐厅推荐｜全家人都喜欢的宝藏补贴餐厅", author: "家庭大厨", avatar: "🏠", likes: 2789, comments: 198, tags: ["家庭", "美食"], liked: false, saved: false },
  { id: "6", image: hangzhouImg, title: "本地网红打卡地｜周末说走就走的小众新地标", author: "探秘达人", avatar: "🗺️", likes: 987, comments: 76, tags: ["打卡", "小众"], liked: false, saved: false },
];

const filters = ["全部", "亲子", "美食", "户外", "休闲", "购物", "文化", "夜生活"];

const GuidesTab = () => {
  const { isGuideSaved, toggleGuideSave } = useCollections();
  const [guides, setGuides] = useState(mockGuides);
  const [activeFilter, setActiveFilter] = useState("全部");
  const [selectedGuide, setSelectedGuide] = useState<GuideCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const withSaved = useCallback(
    (g: GuideCard): GuideCard => ({ ...g, saved: isGuideSaved(g.id) }),
    [isGuideSaved],
  );

  const filteredGuides = useMemo(() => {
    let result = guides;
    if (activeFilter !== "全部") {
      result = result.filter((g) => g.title.includes(activeFilter) || g.tags.some((t) => t.includes(activeFilter)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q)) || g.author.toLowerCase().includes(q));
    }
    return result;
  }, [guides, activeFilter, searchQuery]);

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGuides((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const liked = !g.liked;
        return { ...g, liked, likes: liked ? g.likes + 1 : g.likes - 1 };
      }),
    );
    setSelectedGuide((prev) => {
      if (!prev || prev.id !== id) return prev;
      const liked = !prev.liked;
      return { ...prev, liked, likes: liked ? prev.likes + 1 : prev.likes - 1 };
    });
  };

  const toggleSave = (guide: GuideCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const nowSaved = toggleGuideSave({
      id: guide.id,
      title: guide.title,
      author: guide.author,
      image: guide.image,
      tags: guide.tags,
    });
    setGuides((prev) =>
      prev.map((g) => (g.id === guide.id ? { ...g, saved: nowSaved } : g)),
    );
    setSelectedGuide((prev) =>
      prev && prev.id === guide.id ? { ...prev, saved: nowSaved } : prev,
    );
  };

  return (
    <div className="bg-background min-h-full">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-4 pb-3 bg-background"
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">本地探索</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 附近好玩好吃推荐
            </p>
          </div>
          <div className="w-9 h-9 rounded-2xl bg-primary/12 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索附近景点、餐厅、亲子..."
            className="w-full h-10 pl-10 pr-10 rounded-2xl bg-card border border-border/60 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 transition-all"
            style={{ boxShadow: "var(--shadow-card)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* City filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "text-amber-800"
                  : "bg-card text-muted-foreground border border-border/60 hover:border-primary/30"
              }`}
              style={
                activeFilter === f
                  ? {
                      background: "#FBE4BA",
                      boxShadow: "0 2px 8px hsl(38 89% 86% / 0.4)",
                    }
                  : { boxShadow: "var(--shadow-card)" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Masonry grid ── */}
      <div className="px-4 pb-6 pt-1">
        {filteredGuides.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-muted-foreground text-sm font-medium">没有找到相关内容</p>
            <button onClick={() => { setSearchQuery(""); setActiveFilter("全部"); }} className="mt-3 text-xs text-primary font-semibold">清空筛选</button>
          </div>
        )}
        <div className="columns-2 gap-3">
          {filteredGuides.map((guide, idx) => {
            const g = withSaved(guide);
            return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, type: "spring", stiffness: 300, damping: 26 }}
              className="break-inside-avoid mb-3 bg-card rounded-2xl overflow-hidden cursor-pointer group border border-border/60"
              style={{ boxShadow: "var(--shadow-card)" }}
              onClick={() => setSelectedGuide(g)}
            >
              {/* Image */}
              <div className="relative overflow-hidden">
                <img
                  src={g.image}
                  alt={g.title}
                  className="w-full aspect-[3/4] object-cover group-hover:scale-103 transition-transform duration-500"
                  loading="lazy"
                  style={{ "--tw-scale-x": 1.03, "--tw-scale-y": 1.03 } as React.CSSProperties}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                {/* Save button */}
                <button
                  type="button"
                  onClick={(e) => toggleSave(g, e)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}
                  aria-label={g.saved ? "取消收藏" : "收藏"}
                >
                  <Bookmark className={`w-3.5 h-3.5 transition-colors ${g.saved ? "fill-primary text-primary" : "text-foreground/70"}`} />
                </button>
                {/* Top tag */}
                {g.tags[0] && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", color: "hsl(220 15% 20%)" }}>
                    #{g.tags[0]}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-2.5">
                <h3 className="font-semibold text-[12.5px] leading-snug line-clamp-2 mb-2 text-foreground">{g.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">{g.avatar}</span>
                    <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[60px]">{g.author}</span>
                  </div>
                  <button onClick={(e) => toggleLike(g.id, e)} className="flex items-center gap-1 group/like">
                    <Heart className={`w-3.5 h-3.5 transition-all ${g.liked ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground group-hover/like:text-red-400"}`} />
                    <span className="text-[11px] text-muted-foreground">
                      {g.likes >= 1000 ? `${(g.likes / 1000).toFixed(1)}k` : g.likes}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          );
          })}
        </div>
      </div>

      {/* ── Guide Detail Sheet ── */}
      <AnimatePresence>
        {selectedGuide && (() => {
          const detail = withSaved(selectedGuide);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
            onClick={() => setSelectedGuide(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto pb-24"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <img
                src={detail.image}
                alt={detail.title}
                className="w-full aspect-video object-cover"
              />

              <div className="p-5">
                <h2 className="text-lg font-bold mb-3 leading-snug">{detail.title}</h2>

                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center text-xl">
                    {detail.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{detail.author}</p>
                    <p className="text-xs text-muted-foreground">旅行博主</p>
                  </div>
                  <button className="ml-auto px-3.5 py-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted transition-colors">
                    关注
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  这是一份本地探索指南，包含了精选地点、美食推荐和出行小贴士。所有提到的地点都可以在美团上直接预订，享受团购优惠！
                </p>

                {/* Resources */}
                <div className="rounded-2xl border border-border/60 overflow-hidden mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/40">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-sm font-bold">相关资源</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {["西湖风景区门票 ¥0起", "楼外楼双人套餐 ¥198", "西湖亚朵酒店 ¥458/晚"].map((r) => (
                      <div key={r} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm">{r}</span>
                        <button
                          className="px-3 py-1 rounded-full text-xs font-bold text-amber-800 transition-all active:scale-95"
                          style={{
                            background: "#FBE4BA",
                            boxShadow: "0 1px 6px hsl(38 89% 86% / 0.4)",
                          }}
                        >
                          抢购
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions — 底部需高于 Tab 栏，避免点击被挡住 */}
                <div className="flex items-center gap-4 border-t border-border/60 pt-4 pb-2">
                  <button
                    type="button"
                    onClick={(e) => toggleLike(detail.id, e)}
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors active:opacity-70"
                  >
                    <Heart className={`w-5 h-5 ${detail.liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                    <span className={detail.liked ? "text-red-500" : "text-muted-foreground"}>
                      {detail.likes >= 1000 ? `${(detail.likes / 1000).toFixed(1)}k` : detail.likes}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground active:opacity-70"
                  >
                    <MessageCircle className="w-5 h-5" /> {detail.comments}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => toggleSave(detail, e)}
                    className="flex items-center gap-1.5 text-sm font-medium ml-auto active:opacity-70"
                  >
                    <Bookmark className={`w-5 h-5 ${detail.saved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    <span className={detail.saved ? "text-primary font-semibold" : "text-muted-foreground"}>
                      {detail.saved ? "已收藏" : "收藏"}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default GuidesTab;
