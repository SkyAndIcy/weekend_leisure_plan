import { useState } from "react";
import { MapPin, Utensils, Hotel, Plus, X, GripVertical, Ticket, CheckCircle2, Navigation, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LeafletRouteMap from "@/components/chat/LeafletRouteMap";
import type { MapDeparturePoint, MapPoint } from "@/types/map";

interface Props {
  routePoints: MapPoint[];
  nearbyPoints: MapPoint[];
  departurePoint?: MapDeparturePoint;
  onUpdateRoute: (points: MapPoint[]) => void;
  onAddToRoute: (point: MapPoint) => void;
  onRemoveFromRoute: (pointId: string) => void;
  onEditDeparture?: () => void;
}

const typeIcon = { scenic: MapPin, food: Utensils, hotel: Hotel };
const typeColor = {
  scenic: { bg: "bg-meituan-blue",   text: "text-meituan-blue",   border: "border-meituan-blue/30",   dot: "#3b82f6" },
  food:   { bg: "bg-meituan-orange",  text: "text-meituan-orange", border: "border-meituan-orange/30", dot: "#f97316" },
  hotel:  { bg: "bg-purple-500",      text: "text-purple-500",     border: "border-purple-300",        dot: "#a855f7" },
};

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
    <div className="flex gap-2.5 min-w-0">
      <div className="flex flex-col items-center shrink-0 w-5 mt-1">
        <div className={`w-5 h-5 rounded-full ${tc.bg} flex items-center justify-center shadow-sm border-2 border-card z-10`}>
          <span className="text-white text-[8px] font-bold">{idx + 1}</span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1 bg-border min-h-[24px]" />}
      </div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`flex-1 min-w-0 mb-3 rounded-xl border px-2.5 py-2 transition-all cursor-grab active:cursor-grabbing overflow-hidden ${
          dragOverIdx === idx ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border bg-muted/30 hover:bg-muted/50"
        } ${draggedIdx === idx ? "opacity-40" : ""}`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${tc.text}`} />
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold leading-snug break-words">{point.name}</p>
              {point.price && (
                <span className="text-[10px] text-meituan-red font-semibold shrink-0 whitespace-nowrap">
                  {point.price}
                </span>
              )}
            </div>
            {point.description && (
              <p className="text-[10px] text-muted-foreground leading-snug mt-1 line-clamp-2 break-words">
                {point.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-2 pl-7">
          <button
            type="button"
            onClick={() => setBooked(!booked)}
            className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all whitespace-nowrap ${
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-meituan-red/10 text-meituan-red hover:bg-meituan-red/20 whitespace-nowrap"
          >
            <X className="w-3 h-3" />移除
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatRouteMap = ({
  routePoints: propRoutePoints,
  nearbyPoints: propNearbyPoints,
  departurePoint,
  onUpdateRoute,
  onAddToRoute,
  onRemoveFromRoute,
  onEditDeparture,
}: Props) => {
  const routePoints = propRoutePoints;
  const nearbyPoints = propNearbyPoints;
  const hasRoute = routePoints.length > 0;
  const hasDeparture = !!departurePoint;

  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  if (!hasRoute && !hasDeparture) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <p className="text-xs text-muted-foreground">暂无路线点位</p>
        <p className="text-[10px] text-muted-foreground mt-1">请先完成规划，或切回行程表查看</p>
      </div>
    );
  }

  const depLabel = departurePoint?.label.split("·").pop() ?? departurePoint?.label ?? "出发点";

  return (
    <div className="mt-2 space-y-2">
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
        {hasDeparture && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/70 bg-meituan-green/5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Navigation className="w-3.5 h-3.5 text-meituan-green shrink-0" />
              <span className="text-[10px] text-muted-foreground shrink-0">出发点</span>
              <span className="text-[11px] font-semibold truncate">{depLabel}</span>
            </div>
            {onEditDeparture && (
              <button
                type="button"
                onClick={onEditDeparture}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-medium text-meituan-green bg-meituan-green/10 hover:bg-meituan-green/20 shrink-0"
              >
                <Pencil className="w-2.5 h-2.5" />修改
              </button>
            )}
          </div>
        )}

        <LeafletRouteMap
          departurePoint={departurePoint}
          routePoints={routePoints}
          selectedPointId={selectedPoint?.id ?? null}
          onSelectPoint={setSelectedPoint}
        />

        <div className="flex items-center justify-center gap-3 py-2 border-t border-border flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-meituan-green" />
            <span className="text-[10px] text-muted-foreground">出发点</span>
          </div>
          {(["scenic", "food", "hotel"] as const).map((t) => {
            const tc = typeColor[t];
            const labels = { scenic: "景点", food: "美食", hotel: "酒店" };
            return (
              <div key={t} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${tc.bg}`} />
                <span className="text-[10px] text-muted-foreground">{labels[t]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(hasDeparture || hasRoute) && (
        <div className="bg-card rounded-xl border border-border shadow-card px-3 pt-3 pb-1 overflow-hidden">
          <h4 className="text-xs font-bold mb-3 text-muted-foreground flex items-center gap-1.5">
            <span className="w-1 h-3.5 rounded-full bg-primary inline-block" />
            路线时间轴
          </h4>

          {departurePoint && (
            <div className="flex gap-2.5 mb-3">
              <div className="flex flex-col items-center shrink-0 w-5 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-meituan-green flex items-center justify-center shadow-sm border-2 border-card">
                  <span className="text-white text-[7px] font-bold">起</span>
                </div>
                {hasRoute && <div className="w-0.5 flex-1 mt-1 bg-border min-h-[20px]" />}
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-meituan-green/30 bg-meituan-green/5 mb-3 overflow-hidden">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-meituan-green font-medium">出发点</p>
                  <p className="text-xs font-semibold leading-snug break-words">{departurePoint.label}</p>
                </div>
                {onEditDeparture && (
                  <button
                    type="button"
                    onClick={onEditDeparture}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-medium text-meituan-green hover:bg-meituan-green/15 shrink-0"
                  >
                    <Pencil className="w-2.5 h-2.5" />修改
                  </button>
                )}
              </div>
            </div>
          )}

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
      )}

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
                    <button type="button" onClick={() => setSelectedPoint(null)} className="p-1 rounded hover:bg-muted">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-meituan-red font-semibold">{selectedPoint.price}</span>
                    {selectedPoint.inRoute ? (
                      <button
                        type="button"
                        onClick={() => { onRemoveFromRoute(selectedPoint.id); setSelectedPoint(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-meituan-red/10 text-meituan-red text-xs font-medium hover:bg-meituan-red/20 transition-colors"
                      >
                        <X className="w-3 h-3" /> 从路线移除
                      </button>
                    ) : (
                      <button
                        type="button"
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
                  type="button"
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
export type { MapPoint, MapDeparturePoint } from "@/types/map";
