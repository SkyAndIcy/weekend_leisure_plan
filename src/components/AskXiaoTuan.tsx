import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, SlidersHorizontal, X, Map as MapIcon, List, MapPin, ChevronRight, Loader2, Menu, Search, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import mascotImg from "@/assets/cat-mascot.png";
import QuickFillTemplate from "@/components/QuickFillTemplate";
import ChatItineraryCard from "@/components/chat/ChatItineraryCard";
import ChatRouteMap, { type MapPoint } from "@/components/chat/ChatRouteMap";
import ArticleCard from "@/components/chat/ArticleCard";
import ContinueExplore from "@/components/chat/ContinueExplore";
import LocationPage from "@/components/LocationPage";
import LocationPermissionModal from "@/components/LocationPermissionModal";
import HistorySidebar from "@/components/HistorySidebar";
import { useLocation } from "@/hooks/use-location";
import { cn } from "@/lib/utils";
import { streamChatCompletion } from "@/lib/chat-stream";
import { fridayTracePayload } from "@/lib/friday-trace";
import { AiSemanticError } from "@/lib/recommendation/ai-semantic";
import { PlanningError } from "@/lib/recommendation/plan-api";
import { buildWeekendPlan, planContextForLlm } from "@/lib/recommendation/planner";
import { planToUi } from "@/lib/recommendation/plan-to-ui";
import {
  buildExploreGuides,
  findLinkedPlanContext,
  findPlanningUserHint,
  isFollowUpQuery,
  lastAssistantMessageIndex,
} from "@/lib/explore-suggestions";
import { buildFollowUpMemoryBlock, findPlanAnchorIndex } from "@/lib/follow-up-context";
import {
  appendPoiToPlanContext,
  buildItineraryEditReply,
  extractPoiQuery,
  findPoiInCatalog,
  insertPoiIntoItinerary,
  isItineraryEditRequest,
} from "@/lib/itinerary-edit";
import {
  createEmptySession,
  initChatSessionState,
  saveChatSessions,
  upsertSession,
  type ChatSession,
  type StoredMessage,
} from "@/lib/chat-sessions";
import type { WeekendPlan } from "@/lib/recommendation/types";
import type { DayPlan } from "@/types/itinerary";

const initialSession = initChatSessionState();

function toStoredMessages(messages: Message[]): StoredMessage[] {
  return messages
    .filter((m) => !m.streaming)
    .map(({ streaming: _s, ...rest }) => rest);
}

type ChatViewMode = "list" | "map";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;       // true while SSE is still in flight
  itinerary?: DayPlan[];
  routePoints?: MapPoint[];
  nearbyPoints?: MapPoint[];
  /** 规则引擎方案上下文，供追问复用 */
  planContext?: string;
}


interface AskXiaoTuanProps {
  showSidebar: boolean;
  onSidebarChange: (v: boolean) => void;
}

const AskXiaoTuan = ({ showSidebar, onSidebarChange }: AskXiaoTuanProps) => {
  const setShowSidebar = onSidebarChange;
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialSession.sessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSession.activeId);
  const [messages, setMessages] = useState<Message[]>(initialSession.messages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [viewMode, setViewMode] = useState<ChatViewMode>("list");
  const [travelDate, setTravelDate] = useState<Date | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Location state
  const { location, requestGPS, selectAddress, selectManualText } = useLocation();
  const [showLocationPage, setShowLocationPage] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const suggestions = [
    "今天下午带5岁孩子出去玩，别太远，2-3小时",
    "和老婆下午有空，想找个近的地方吃饭+逛逛",
    "朋友聚会，找个下午能玩3小时的地方",
    "周末带父母出去，轻松不累，附近就行",
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const stored = toStoredMessages(messages);
      setChatSessions((prev) => {
        const next = upsertSession(prev, activeSessionId, stored);
        saveChatSessions(next, activeSessionId);
        return next;
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [messages, activeSessionId]);

  const handleNewChat = () => {
    const stored = toStoredMessages(messages);
    let next = chatSessions;
    if (stored.length > 0) {
      next = upsertSession(chatSessions, activeSessionId, stored);
    }
    const fresh = createEmptySession();
    next = [fresh, ...next];
    saveChatSessions(next, fresh.id);
    setChatSessions(next);
    setActiveSessionId(fresh.id);
    setMessages([]);
    setInput("");
    setIsTyping(false);
  };

  const handleSelectChat = (id: string) => {
    if (id === activeSessionId) return;
    const stored = toStoredMessages(messages);
    let next = upsertSession(chatSessions, activeSessionId, stored);
    const target = next.find((s) => s.id === id);
    if (!target) return;
    saveChatSessions(next, id);
    setChatSessions(next);
    setActiveSessionId(id);
    setMessages(target.messages);
    setIsTyping(false);
  };

  const handleSend = async (text?: string) => {
    let msg = text || input.trim();
    if (!msg || isTyping) return;

    // If no location set, prompt user to set it first
    const hasLocation =
      location.status === "located" ||
      location.status === "manual" ||
      !!location.coords ||
      !!location.fullAddress?.trim();
    if (!hasLocation) {
      setShowPermissionModal(true);
      return;
    }

    // Append date if selected
    if (travelDate) {
      msg += `，出发日期：${format(travelDate, "yyyy年M月d日")}`;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    const assistantId = (Date.now() + 1).toString();
    const planAnchorIdx = findPlanAnchorIndex(messages);
    const lastPlanMsg = planAnchorIdx >= 0 ? messages[planAnchorIdx] : undefined;

    if (lastPlanMsg?.itinerary?.length && isItineraryEditRequest(msg, true)) {
      const query = extractPoiQuery(msg) ?? msg;
      const poi = findPoiInCatalog(query);
      if (!poi) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: `没有在行程候选池里找到「${query}」。可以说具体商圈或从「继续探索」里的备选里选，我帮你写进行程表。`,
          },
        ]);
        setIsTyping(false);
        return;
      }
      const updatedDays = insertPoiIntoItinerary(lastPlanMsg.itinerary, poi);
      const inserted = updatedDays[0]?.items.find((i) => i.name === poi.name);
      const updatedCtx = appendPoiToPlanContext(
        lastPlanMsg.planContext ?? "",
        poi,
        inserted?.time ?? "16:00",
      );
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: buildItineraryEditReply(poi, updatedDays),
          itinerary: updatedDays,
          routePoints: lastPlanMsg.routePoints,
          nearbyPoints: lastPlanMsg.nearbyPoints,
          planContext: updatedCtx,
        },
      ]);
      setIsTyping(false);
      return;
    }

    if (lastPlanMsg?.planContext && isFollowUpQuery(msg, true)) {
      const followUpMemory = buildFollowUpMemoryBlock({
        planContext: lastPlanMsg.planContext,
        itinerary: lastPlanMsg.itinerary,
        messages: newMessages,
        planMessageIndex: planAnchorIdx,
        homeLabel: location.displayName || location.fullAddress,
      });

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      try {
        const assistantContent = await streamChatCompletion(
          {
            ...fridayTracePayload(),
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            planContext: lastPlanMsg.planContext,
            followUp: true,
            followUpMemory,
            location: {
              label: location.displayName || location.fullAddress,
              address: location.fullAddress,
            },
          },
          (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: text, streaming: true } : m,
              ),
            );
          },
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: assistantContent || "暂时无法回答，请稍后再试。",
                }
              : m,
          ),
        );
      } catch (e) {
        console.error("Follow-up chat error:", e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content:
                    "追问服务暂时不可用。半日出门一般不用订酒店；若想延长游玩，可在行程表里点「换一个」调整地点。",
                }
              : m,
          ),
        );
      } finally {
        setIsTyping(false);
      }
      return;
    }

    let weekendPlan: WeekendPlan;
    let planUi: ReturnType<typeof planToUi>;

    try {
      weekendPlan = await buildWeekendPlan(msg, {
        fullAddress: location.fullAddress,
        displayName: location.displayName,
        coords: location.coords,
      });
      planUi = planToUi(weekendPlan);
    } catch (e) {
      console.error("Planning error:", e);
      const content =
        e instanceof AiSemanticError
          ? `AI 语义理解失败：${e.message}`
          : e instanceof PlanningError
            ? `行程规划失败：${e.message}`
            : e instanceof Error
              ? e.message
              : "行程规划失败，请稍后再试。";
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content },
      ]);
      setIsTyping(false);
      return;
    }

    const planContext = planContextForLlm(weekendPlan);
    const fallbackCopy = `## 周末半日安排\n\n${weekendPlan.summary}\n\n${weekendPlan.notifyText}\n\n*（文案润色暂不可用，以下为规则引擎结果）*`;

    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        planContext,
        itinerary: planUi.days,
        routePoints: planUi.routePoints,
        nearbyPoints: planUi.nearbyPoints,
      },
    ]);

    try {
      const assistantContent = await streamChatCompletion(
        {
          ...fridayTracePayload(),
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          planContext,
          location: {
            label: location.displayName || location.fullAddress,
            address: location.fullAddress,
          },
        },
        (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: text, streaming: true } : m,
            ),
          );
        },
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                content: assistantContent || fallbackCopy,
                planContext,
                itinerary: planUi.days,
                routePoints: planUi.routePoints,
                nearbyPoints: planUi.nearbyPoints,
              }
            : m,
        ),
      );
    } catch (e) {
      console.error("Chat polish error:", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                content: `${fallbackCopy}\n\n> 文案润色失败，已展示规则引擎行程。`,
                planContext,
                itinerary: planUi.days,
                routePoints: planUi.routePoints,
                nearbyPoints: planUi.nearbyPoints,
              }
            : m,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleTemplateSubmit = (text: string) => {
    setShowTemplate(false);
    handleSend(text);
  };

  const handleUpdateItinerary = (msgId: string, days: DayPlan[]) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, itinerary: days } : m)));
  };

  const handleUpdateRoute = (msgId: string, points: MapPoint[]) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, routePoints: points } : m)));
  };

  const handleAddToRoute = (msgId: string, point: MapPoint) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const newRoute = [...(m.routePoints || []), { ...point, inRoute: true }];
        const newNearby = (m.nearbyPoints || []).filter((p) => p.id !== point.id);
        return { ...m, routePoints: newRoute, nearbyPoints: newNearby };
      })
    );
  };

  const handleRemoveFromRoute = (msgId: string, pointId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const removed = (m.routePoints || []).find((p) => p.id === pointId);
        const newRoute = (m.routePoints || []).filter((p) => p.id !== pointId);
        const newNearby = removed ? [...(m.nearbyPoints || []), { ...removed, inRoute: false }] : m.nearbyPoints || [];
        return { ...m, routePoints: newRoute, nearbyPoints: newNearby };
      })
    );
  };

  const handleLocationSelect = (
    name: string,
    detail: string,
    coords?: { lat: number; lng: number },
  ) => {
    selectAddress(name, detail, coords);
    setShowLocationPage(false);
  };

  const handlePermissionAllow = () => {
    setShowPermissionModal(false);
    requestGPS();
  };

  const handlePermissionManual = (text: string) => {
    selectManualText(text);
    setShowPermissionModal(false);
  };

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden">

      {/* ── Header bar (参考元宝图2) ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pt-11 pb-2"
        style={{ minHeight: 56 }}
      >
        {/* Left: menu + title + subtitle (地址) */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">周末喵</h1>
            <button
              onClick={() => setShowLocationPage(true)}
              className="flex items-center gap-0.5 group w-fit mt-0.5"
            >
              {location.status === "locating" ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  定位中…
                </span>
              ) : (
                <>
                  <MapPin
                    className={`w-3 h-3 shrink-0 ${location.status === "denied" ? "text-destructive" : "text-meituan-orange"}`}
                  />
                  <span
                    className={`text-xs truncate max-w-[160px] group-hover:text-foreground transition-colors ${
                      location.status === "denied"
                        ? "text-destructive/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {location.displayName || "选择位置"}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 scrollbar-hide flex flex-col",
          messages.length === 0 ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-between px-5 pt-6 pb-0 flex-1"
          >
            {/* Hero mascot — large, no frame */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
              className="relative"
            >
              <img src={mascotImg} alt="周末喵" className="w-28 h-28 object-contain" />
            </motion.div>



            {/* Quick fill button */}
            <motion.button
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              onClick={() => setShowTemplate(true)}
              className="flex items-center gap-2 px-5 py-2 mb-3 rounded-full text-sm font-semibold border-2 border-primary/30 text-primary-foreground hover:bg-primary/15 hover:border-primary/50 transition-all"
              style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(28 60% 28%)" }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              快捷填写出行需求
            </motion.button>

            {/* Suggestion chips */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full space-y-2"
            >
              <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" /> 你好，我是周末喵 🐱，可以帮你规划周末时间
              </p>
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.22 + i * 0.06 }}
                  onClick={() => handleSend(s)}
                  className="w-full px-3.5 py-1.5 rounded-[16px] bg-card border border-border hover:border-primary/40 transition-all text-left"
                >
                  <span className="text-[12px] font-medium text-foreground/85 leading-snug">{s}</span>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}

        <div className="px-4 pt-3 pb-2">
          <AnimatePresence>
            {messages.map((msg, msgIndex) => {
              const lastAiIndex = lastAssistantMessageIndex(messages);
              const linkedPlanContext = findLinkedPlanContext(messages, msgIndex);
              const showContinueExplore =
                msg.role === "assistant" &&
                !msg.streaming &&
                msgIndex === lastAiIndex &&
                !!linkedPlanContext;
              const planningUserHint = linkedPlanContext
                ? findPlanningUserHint(messages, msgIndex)
                : undefined;

              return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div
                    className="max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm font-medium leading-relaxed border border-border"
                    style={{
                      background: "hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 max-w-[92%]">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary/25 to-meituan-orange/15 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                      <img src={mascotImg} alt="周末喵" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">

                      {!msg.streaming && /^\s*#\s/.test(msg.content) ? (
                        <ArticleCard content={msg.content} compact={!!msg.itinerary?.length} />
                      ) : (
                        <div
                          className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed border border-border/70 prose prose-sm max-w-none"
                          style={{ boxShadow: "var(--shadow-card)" }}
                        >
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}

                      {/* View mode toggle */}
                      {msg.itinerary && msg.itinerary.length > 0 && (
                        <div className="mt-2">
                          <div className="flex bg-muted rounded-xl p-0.5 mb-2 border border-border/50">
                            <button
                              onClick={() => setViewMode("list")}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <List className="w-3 h-3" /> 行程表
                            </button>
                            <button
                              onClick={() => setViewMode("map")}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === "map" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <MapIcon className="w-3 h-3" /> 地图路线
                            </button>
                          </div>
                          {viewMode === "list" ? (
                            <ChatItineraryCard days={msg.itinerary} onUpdate={(days) => handleUpdateItinerary(msg.id, days)} onAddToTrip={() => {}} />
                          ) : (
                            <ChatRouteMap
                              routePoints={msg.routePoints || []}
                              nearbyPoints={msg.nearbyPoints || []}
                              onUpdateRoute={(points) => handleUpdateRoute(msg.id, points)}
                              onAddToRoute={(point) => handleAddToRoute(msg.id, point)}
                              onRemoveFromRoute={(pointId) => handleRemoveFromRoute(msg.id, pointId)}
                            />
                          )}
                        </div>
                      )}

                      {showContinueExplore && linkedPlanContext && (
                        <ContinueExplore
                          guides={buildExploreGuides(
                            linkedPlanContext,
                            location.displayName || location.fullAddress,
                            planningUserHint,
                          )}
                          onGuideClick={(text) => handleSend(text)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mb-3"
            >
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary/25 to-meituan-orange/15 flex items-center justify-center shrink-0 border border-primary/20">
                <img src={mascotImg} alt="周末喵" className="w-5 h-5 object-contain" />
              </div>
              <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 border border-border/70 flex items-center gap-1.5" style={{ boxShadow: "var(--shadow-card)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse-dot [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
          {/* bottom padding so last message isn't hidden behind input bar */}
          <div className="h-2" />
        </div>
      </div>

      {/* ── Input bar ── fixed above tab bar, fused visually ── */}
      <div
        className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 pt-2 pb-2 z-40 bg-background"
      >
        <div className="flex items-center">
          {/* Unified pill: template button + textarea + send */}
          <div className="flex-1 flex items-center gap-2 rounded-[24px] bg-card border border-border pl-2 pr-1.5 h-12 shadow-[0_0_3px_0.5px_hsl(var(--primary)/0.35)]">
            {/* Template button (inside pill) */}
            <button
              onClick={() => setShowTemplate(true)}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                showTemplate ? "bg-primary/15 text-amber-700" : "text-muted-foreground hover:bg-secondary"
              }`}
              aria-label="快捷设置"
            >
              <SlidersHorizontal style={{ width: 18, height: 18 }} />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="今天下午想带谁去哪儿玩？"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-[hsl(220_8%_62%)] leading-tight py-0 self-center"
              style={{ minHeight: 22, maxHeight: 88 }}
            />

            {/* Send (inside pill) */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: input.trim() && !isTyping ? "hsl(28 60% 28%)" : "hsl(220 8% 94%)",
              }}
              aria-label="发送"
            >
              <Send style={{ width: 16, height: 16, color: input.trim() && !isTyping ? "#FBE4BA" : "hsl(220 8% 56%)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Fill Template Modal */}
      <AnimatePresence>
        {showTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center pb-14"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowTemplate(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-t-3xl w-full max-w-[430px] mt-auto"
              style={{ boxShadow: "var(--shadow-modal)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <h3 className="font-bold text-base">快捷填写出行需求</h3>
                </div>
                <button onClick={() => setShowTemplate(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <QuickFillTemplate onSubmit={handleTemplateSubmit} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Location Selection Page ── */}
      <AnimatePresence>
        {showLocationPage && (
          <LocationPage
            currentAddress={location.displayName}
            onBack={() => setShowLocationPage(false)}
            onSelect={handleLocationSelect}
            onRelocate={() => {
              requestGPS();
              setShowLocationPage(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Location Permission Modal ── */}
      <AnimatePresence>
        {showPermissionModal && (
          <LocationPermissionModal
            onAllow={handlePermissionAllow}
            onManual={handlePermissionManual}
            onDismiss={() => setShowPermissionModal(false)}
          />
        )}
      </AnimatePresence>

      {/* ── History Sidebar ── */}
      <HistorySidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        sessions={chatSessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentLocationName={location.displayName}
        onLocationClick={() => { setShowSidebar(false); setShowLocationPage(true); }}
      />
    </div>
  );
};

export default AskXiaoTuan;
