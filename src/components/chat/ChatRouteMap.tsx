import { useState } from "react";
import { MapPin, Utensils, Hotel, Plus, X, GripVertical, Ticket, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MapPoint {
  id: string;
  name: string;
  type: "scenic" | "food" | "hotel";
  x: number; // percentage 0-100
  y: number;
  inRoute: boolean;
  description?: string;
  price?: string;
}

interface Props {
  routePoints: MapPoint[];
  nearbyPoints: MapPoint[];
  onUpdateRoute: (points: MapPoint[]) => void;
  onAddToRoute: (point: MapPoint) => void;
  onRemoveFromRoute: (pointId: string) => void;
}

const typeIcon = { scenic: MapPin, food: Utensils, hotel: Hotel };
const typeColor = {
  scenic: { bg: "bg-meituan-blue",   text: "text-meituan-blue",   border: "border-meituan-blue/30",   dot: "#3b82f6" },
  food:   { bg: "bg-meituan-orange",  text: "text-meituan-orange", border: "border-meituan-orange/30", dot: "#f97316" },
  hotel:  { bg: "bg-purple-500",      text: "text-purple-500",     border: "border-purple-300",        dot: "#a855f7" },
};

// Default Hangzhou route data
const defaultRoutePoints: MapPoint[] = [
  { id: "r1", name: "西湖风景区",   type: "scenic", x: 30, y: 25, inRoute: true, description: "漫步苏堤", price: "免费" },
  { id: "r2", name: "楼外楼",       type: "food",   x: 48, y: 35, inRoute: true, description: "西湖醋鱼", price: "¥198" },
  { id: "r3", name: "灵隐寺",       type: "scenic", x: 22, y: 18, inRoute: true, description: "千年古刹", price: "¥75" },
  { id: "r4", name: "河坊街夜市",   type: "food",   x: 58, y: 60, inRoute: true, description: "地道小吃", price: "人均¥50" },
  { id: "r5", name: "西湖亚朵酒店", type: "hotel",  x: 42, y: 72, inRoute: true, description: "含双早",   price: "¥458" },
];
const defaultNearbyPoints: MapPoint[] = [
  { id: "n1", name: "雷峰塔",   type: "scenic", x: 38, y: 48, inRoute: false, description: "西湖十景之一", price: "¥40" },
  { id: "n2", name: "龙井茶园", type: "scenic", x: 15, y: 45, inRoute: false, description: "采茶体验",     price: "¥120" },
  { id: "n3", name: "知味观",   type: "food",   x: 65, y: 28, inRoute: false, description: "小笼包",       price: "人均¥85" },
  { id: "n4", name: "苏堤春晓", type: "scenic", x: 28, y: 38, inRoute: false, description: "西湖苏堤",     price: "免费" },
  { id: "n5", name: "断桥残雪", type: "scenic", x: 45, y: 15, inRoute: false, description: "白娘子传说",   price: "免费" },
  { id: "n6", name: "外婆家",   type: "food",   x: 72, y: 50, inRoute: false, description: "杭帮菜",       price: "人均¥75" },
];

// ── route booking item ────────────────────────────────────────────────────────
const RouteListItem = ({
  point,
  idx,
  isLast,
  dragOverIdx,
  draggedIdx,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
}: {
  point: MapPoint;
  idx: number;
  isLast: boolean;
  dragOverIdx: number | null;
  draggedIdx: number | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) => {
  const [booked, setBooked] = useState(false);
  const Icon = typeIcon[point.type];
  const tc = typeColor[point.type];

  return (
    <div className="flex gap-2.5">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-5 mt-1">
        <div className={`w-5 h-5 rounded-full ${tc.bg} flex items-center justify-center shadow-sm border-2 border-card z-10`}>
          <span className="text-white text-[8px] font-bold">{idx + 1}</span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-0.5 bg-border min-h-[24px]" />}
      </div>

      {/* Draggable card */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`flex-1 mb-3 flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
          dragOverIdx === idx ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border bg-muted/30 hover:bg-muted/50"
        } ${draggedIdx === idx ? "opacity-40" : ""}`}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${tc.text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{point.name}</p>
          {point.description && <p className="text-[10px] text-muted-foreground truncate">{point.description}</p>}
        </div>
        {point.price && <span className="text-[10px] text-meituan-red font-semibold shrink-0">{point.price}</span>}
        <button
          onClick={() => setBooked(!booked)}
          className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all shrink-0 ${
            booked
              ? "bg-meituan-green/10 text-meituan-green"
              : "bg-primary text-primary-foreground hover:bg-meituan-yellow-hover"
          }`}
        >
          {booked ? (
            <><CheckCircle2 className="w-2.5 h-2.5" />已预定</>
          ) : (
            <><Ticket className="w-2.5 h-2.5" />预定</>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-0.5 rounded hover:bg-meituan-red/10 text-muted-foreground hover:text-meituan-red transition-colors shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const ChatRouteMap = ({
  routePoints: propRoutePoints,
  nearbyPoints: propNearbyPoints,
  onUpdateRoute,
  onAddToRoute,
  onRemoveFromRoute,
}: Props) => {
  const routePoints = propRoutePoints.length > 0 ? propRoutePoints : defaultRoutePoints;
  const nearbyPoints = propNearbyPoints.length > 0 ? propNearbyPoints : defaultNearbyPoints;

  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const routePolyline = routePoints.map((p) => `${(p.x / 100) * 400},${(p.y / 100) * 300}`).join(" ");

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) { setDraggedIdx(null); setDragOverIdx(null); return; }
    const updated = [...routePoints];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(idx, 0, moved);
    onUpdateRoute(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="mt-2 space-y-2">
      {/* ── Map area ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
        <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {/* Map background */}
          <div className="absolute inset-0 bg-[hsl(210_20%_95%)]" />

          {/* Water body */}
          <div className="absolute top-[22%] left-[18%] w-[38%] h-[32%] rounded-[50%] bg-[hsl(200_60%_85%)] opacity-60" />
          <div className="absolute top-[28%] left-[24%] w-[26%] h-[22%] rounded-[50%] bg-[hsl(200_60%_80%)] opacity-50" />
          <p className="absolute top-[37%] left-[28%] text-[10px] text-[hsl(200_50%_55%)] font-medium select-none">西湖</p>

          {/* Grid lines */}
          <div className="absolute top-[15%] left-[10%] w-[80%] h-px bg-[hsl(0_0%_78%)]" />
          <div className="absolute top-[55%] left-[5%] w-[90%] h-px bg-[hsl(0_0%_78%)]" />
          <div className="absolute top-[10%] left-[50%] w-px h-[80%] bg-[hsl(0_0%_78%)]" />
          <div className="absolute top-[10%] left-[75%] w-px h-[70%] bg-[hsl(0_0%_78%)]" />

          {/* Route line SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
            <polyline
              points={routePolyline}
              fill="none"
              stroke="hsl(43 100% 50%)"
              strokeWidth="2.5"
              strokeDasharray="7 4"
              opacity="0.85"
            />
            {routePoints.slice(0, -1).map((p, i) => {
              const next = routePoints[i + 1];
              const mx = ((p.x + next.x) / 2 / 100) * 400;
              const my = ((p.y + next.y) / 2 / 100) * 300;
              return <circle key={`mid-${i}`} cx={mx} cy={my} r="3" fill="hsl(43 100% 50%)" opacity="0.55" />;
            })}
          </svg>

          {/* Route points */}
          {routePoints.map((point, idx) => {
            const tc = typeColor[point.type];
            const Icon = typeIcon[point.type];
            return (
              <div
                key={point.id}
                className="absolute flex flex-col items-center cursor-pointer group"
                style={{ left: `${point.x}%`, top: `${point.y}%`, transform: "translate(-50%,-50%)" }}
                onClick={() => setSelectedPoint(point === selectedPoint ? null : point)}
              >
                <div className="relative">
                  <div className={`absolute -inset-1.5 rounded-full ${tc.bg} opacity-20 group-hover:opacity-30 animate-pulse`} />
                  <div className={`w-7 h-7 rounded-full ${tc.bg} flex items-center justify-center shadow-md border-2 border-card relative z-10`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center z-20">
                    {idx + 1}
                  </span>
                </div>
                <span className="text-[9px] mt-0.5 font-medium bg-card/90 px-1.5 rounded shadow-sm whitespace-nowrap">
                  {point.name}
                </span>
              </div>
            );
          })}

          {/* Nearby points */}
          {nearbyPoints.map((point) => {
            const tc = typeColor[point.type];
            const Icon = typeIcon[point.type];
            return (
              <div
                key={point.id}
                className="absolute flex flex-col items-center cursor-pointer opacity-45 hover:opacity-100 transition-opacity"
                style={{ left: `${point.x}%`, top: `${point.y}%`, transform: "translate(-50%,-50%)" }}
                onClick={() => setSelectedPoint(point === selectedPoint ? null : point)}
              >
                <div className={`w-5 h-5 rounded-full ${tc.bg} flex items-center justify-center shadow-sm border border-card/60`}>
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-[8px] mt-0.5 text-muted-foreground bg-card/75 px-1 rounded whitespace-nowrap">
                  {point.name}
                </span>
              </div>
            );
          })}

          {/* Hint */}
          <div className="absolute bottom-2 left-2 bg-card/85 rounded-lg px-2 py-1 shadow-sm">
            <p className="text-[9px] text-muted-foreground">💡 点击景点添加/移除 · 拖拽列表调整顺序</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 py-2 border-t border-border">
          {(["scenic","food","hotel"] as const).map((t) => {
            const tc = typeColor[t];
            const labels = { scenic: "景点", food: "美食", hotel: "酒店" };
            return (
              <div key={t} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${tc.bg}`} />
                <span className="text-[10px] text-muted-foreground">{labels[t]}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1">
            <div className="w-4 h-0 border-t-2 border-dashed border-primary" />
            <span className="text-[10px] text-muted-foreground">路线</span>
          </div>
        </div>
      </div>

      {/* ── Timeline route list ── */}
      <div className="bg-card rounded-xl border border-border shadow-card px-3 pt-3 pb-1">
        <h4 className="text-xs font-bold mb-3 text-muted-foreground flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-primary inline-block" />
          行程时间轴（可拖拽调整顺序）
        </h4>
        {routePoints.map((point, idx) => (
          <RouteListItem
            key={point.id}
            point={point}
            idx={idx}
            isLast={idx === routePoints.length - 1}
            dragOverIdx={dragOverIdx}
            draggedIdx={draggedIdx}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
            onRemove={() => onRemoveFromRoute(point.id)}
          />
        ))}
      </div>

      {/* ── Point detail popup ── */}
      <AnimatePresence>
        {selectedPoint && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-card rounded-xl border border-border shadow-card p-3"
          >
            {(() => {
              const tc = typeColor[selectedPoint.type];
              const Icon = typeIcon[selectedPoint.type];
              return (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-xl ${tc.bg} flex items-center justify-center shadow-sm`}>
                        <Icon className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">{selectedPoint.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{selectedPoint.description}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPoint(null)} className="p-1 rounded hover:bg-muted">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-meituan-red font-semibold">{selectedPoint.price}</span>
                    {selectedPoint.inRoute ? (
                      <button
                        onClick={() => { onRemoveFromRoute(selectedPoint.id); setSelectedPoint(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-meituan-red/10 text-meituan-red text-xs font-medium hover:bg-meituan-red/20 transition-colors"
                      >
                        <X className="w-3 h-3" /> 从路线移除
                      </button>
                    ) : (
                      <button
                        onClick={() => { onAddToRoute(selectedPoint); setSelectedPoint(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-meituan-yellow-hover transition-colors"
                      >
                        <Plus className="w-3 h-3" /> 添加到路线
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nearby suggestions */}
      {nearbyPoints.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card p-3">
          <h4 className="text-xs font-bold mb-2 text-muted-foreground flex items-center gap-1.5">
            <span className="w-1 h-3.5 rounded-full bg-meituan-blue inline-block" />
            附近可加入
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {nearbyPoints.map((point) => {
              const tc = typeColor[point.type];
              const Icon = typeIcon[point.type];
              return (
                <button
                  key={point.id}
                  onClick={() => { onAddToRoute(point); }}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${tc.border} ${tc.text} bg-card hover:bg-muted transition-colors font-medium`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {point.name}
                  {point.price && <span className="text-muted-foreground ml-0.5">{point.price}</span>}
                  <Plus className="w-2.5 h-2.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRouteMap;
export type { MapPoint };
