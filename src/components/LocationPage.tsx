import { useState, useMemo } from "react";
import { ArrowLeft, Search, MapPin, Navigation, CheckCircle2, Plus, Edit2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadSavedAddresses,
  saveAddresses,
  type SavedAddress,
} from "@/hooks/use-location";

interface NearbyPlace {
  id: string;
  name: string;
  detail: string;
  distance: string;
  lat: number;
  lng: number;
}

/** 模拟附近地点（真实场景接入 LBS API） */
const MOCK_NEARBY: NearbyPlace[] = [
  { id: "nb1", name: "三里屯太古里", detail: "北京市朝阳区三里屯路19号", distance: "180m", lat: 39.9345, lng: 116.4543 },
  { id: "nb2", name: "工人体育场", detail: "北京市朝阳区工体东路4号", distance: "560m", lat: 39.93, lng: 116.45 },
  { id: "nb3", name: "798艺术区", detail: "北京市朝阳区酒仙桥路4号", distance: "1.1km", lat: 39.9842, lng: 116.4954 },
  { id: "nb4", name: "望京SOHO", detail: "北京市朝阳区望京街15号", distance: "1.8km", lat: 39.988, lng: 116.492 },
  { id: "nb5", name: "奥森公园", detail: "北京市朝阳区奥林匹克森林公园", distance: "2.4km", lat: 40.0178, lng: 116.3972 },
];

interface LocationPageProps {
  currentAddress: string;
  onBack: () => void;
  onSelect: (name: string, detail: string, coords?: { lat: number; lng: number }) => void;
  onRelocate: () => void;
}

const TAG_COLORS: Record<string, string> = {
  家: "bg-meituan-orange/15 text-meituan-orange",
  公司: "bg-meituan-blue/15 text-meituan-blue",
};

const LocationPage = ({ currentAddress, onBack, onSelect, onRelocate }: LocationPageProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => loadSavedAddresses());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newTag, setNewTag] = useState("家");
  const [showMore, setShowMore] = useState(false);

  const filteredNearby = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_NEARBY;
    const q = searchQuery.toLowerCase();
    return MOCK_NEARBY.filter(
      (p) => p.name.toLowerCase().includes(q) || p.detail.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredSaved = useMemo(() => {
    if (!searchQuery.trim()) return savedAddresses;
    const q = searchQuery.toLowerCase();
    return savedAddresses.filter(
      (a) => a.name.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q)
    );
  }, [savedAddresses, searchQuery]);

  const visibleSaved = showMore ? filteredSaved : filteredSaved.slice(0, 4);

  const handleAddAddress = () => {
    if (!newName.trim()) return;
    const newAddr: SavedAddress = {
      id: Date.now().toString(),
      label: newTag,
      name: newName.trim(),
      detail: newDetail.trim() || newName.trim(),
      tag: newTag as SavedAddress["tag"],
    };
    const updated = [...savedAddresses, newAddr];
    setSavedAddresses(updated);
    saveAddresses(updated);
    setNewName("");
    setNewDetail("");
    setNewTag("家");
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = savedAddresses.filter((a) => a.id !== id);
    setSavedAddresses(updated);
    saveAddresses(updated);
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="fixed inset-0 z-[60] bg-background flex flex-col max-w-[430px] mx-auto"
      style={{ boxShadow: "0 0 40px rgba(0,0,0,0.12)" }}
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border/60"
        style={{
          background: "rgba(247,244,240,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[17px] font-bold flex-1 text-center pr-9">选择出游地址</h1>
      </div>

      {/* ── Search + city ── */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-background">
        <div className="flex items-center gap-2">
          {/* City selector pill */}
          <button className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-muted text-sm font-semibold hover:bg-secondary transition-colors">
            <span>当前城市</span>
            <span className="text-[10px] text-muted-foreground">▾</span>
          </button>
          {/* Search input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索您的出游地址"
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-muted border border-border/50 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">

        {/* Currently selected + relocate */}
        <div className="px-4 py-3 bg-primary/5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground/70">已选：</span>
              <span className="text-sm font-semibold truncate">{currentAddress || "未选择"}</span>
            </div>
            <button
              onClick={onRelocate}
              className="flex items-center gap-1 text-xs font-semibold text-meituan-blue shrink-0 ml-3"
            >
              <Navigation className="w-3.5 h-3.5" />
              重新定位
            </button>
          </div>
        </div>

        {/* My saved addresses */}
        {filteredSaved.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-foreground">我的出游地址</h2>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 text-xs text-primary font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> 管理
              </button>
            </div>

            <div className="divide-y divide-border/40">
              {visibleSaved.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-center px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() =>
                    onSelect(
                      addr.name,
                      addr.detail,
                      addr.lat != null && addr.lng != null
                        ? { lat: addr.lat, lng: addr.lng }
                        : undefined,
                    )
                  }
                >
                  {/* Radio */}
                  <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0 mr-3 group-hover:border-primary transition-colors">
                    {currentAddress === addr.name && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{addr.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {addr.tag && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TAG_COLORS[addr.tag] ?? "bg-muted text-muted-foreground"}`}>
                          {addr.tag}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{addr.detail}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}
                    className="w-7 h-7 rounded-xl bg-muted ml-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>

            {filteredSaved.length > 4 && (
              <button
                onClick={() => setShowMore(!showMore)}
                className="w-full py-3 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1 border-t border-border/40 hover:bg-muted/30 transition-colors"
              >
                {showMore ? "收起" : `展开更多`}
                <span className={`text-xs transition-transform ${showMore ? "rotate-180" : ""}`}>▾</span>
              </button>
            )}
          </div>
        )}

        {/* Nearby recommended */}
        <div>
          <h2 className="text-sm font-bold text-foreground px-4 pt-4 pb-2">附近推荐地址</h2>
          <div className="divide-y divide-border/40">
            {filteredNearby.map((place) => (
              <div
                key={place.id}
                className="flex items-center px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                onClick={() =>
                  onSelect(place.name, place.detail, { lat: place.lat, lng: place.lng })
                }
              >
                <div className="w-8 h-8 rounded-xl bg-meituan-blue/10 flex items-center justify-center shrink-0 mr-3">
                  <MapPin className="w-4 h-4 text-meituan-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{place.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{place.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">距您{place.distance}</span>
              </div>
            ))}
            {filteredNearby.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">没有找到相关地址</p>
            )}
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-8" />
      </div>

      {/* ── Add address bottom button ── */}
      <div className="shrink-0 p-4 border-t border-border/50 bg-background">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
            boxShadow: "0 4px 16px hsl(43 100% 50% / 0.35)",
          }}
        >
          <Plus className="w-4 h-4" />
          新增出游地址
        </button>
      </div>

      {/* ── Add Address Sheet ── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-end"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-3xl w-full"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <h3 className="font-bold text-base">新增出游地址</h3>
                <button onClick={() => setShowAddForm(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Tag selector */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wide">地址标签</label>
                  <div className="flex gap-2">
                    {["家", "公司", "常去"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewTag(t)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${newTag === t ? "border-primary bg-primary/10 text-amber-700" : "border-border bg-muted text-muted-foreground"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wide">地点名称</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如：家、公司、奶奶家"
                    className="w-full px-4 py-3 rounded-2xl border border-border/70 bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wide">详细地址（可选）</label>
                  <input
                    value={newDetail}
                    onChange={(e) => setNewDetail(e.target.value)}
                    placeholder="例如：北京市朝阳区XXX街道"
                    className="w-full px-4 py-3 rounded-2xl border border-border/70 bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <button
                  onClick={handleAddAddress}
                  disabled={!newName.trim()}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 disabled:opacity-40 transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                    boxShadow: "0 3px 12px hsl(43 100% 50% / 0.3)",
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  保存地址
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LocationPage;
