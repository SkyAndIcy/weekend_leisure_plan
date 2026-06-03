import type { MapPoint } from "@/components/chat/ChatRouteMap";
import type { DayPlan } from "@/types/itinerary";

const SESSIONS_KEY = "weekendmiao_chat_sessions";
const ACTIVE_ID_KEY = "weekendmiao_active_chat_id";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  planContext?: string;
  itinerary?: DayPlan[];
  routePoints?: MapPoint[];
  nearbyPoints?: MapPoint[];
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
};

export type SessionListItem = {
  id: string;
  title: string;
  updatedAt: number;
};

function titleFromMessages(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser?.content.trim()) return "新对话";
  return firstUser.content.trim().slice(0, 28);
}

export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function saveChatSessions(sessions: ChatSession[], activeId: string) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
    localStorage.setItem(ACTIVE_ID_KEY, activeId);
  } catch {
    /* quota */
  }
}

export function createEmptySession(): ChatSession {
  return {
    id: `chat-${Date.now()}`,
    title: "新对话",
    updatedAt: Date.now(),
    messages: [],
  };
}

export function upsertSession(
  sessions: ChatSession[],
  id: string,
  messages: StoredMessage[],
): ChatSession[] {
  const title = titleFromMessages(messages);
  const updatedAt = Date.now();
  const existing = sessions.find((s) => s.id === id);
  const next: ChatSession = existing
    ? { ...existing, title: messages.length ? title : existing.title, updatedAt, messages }
    : { id, title, updatedAt, messages };

  const rest = sessions.filter((s) => s.id !== id);
  return [next, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
}

export type HistoryGroup = { label: string; items: SessionListItem[] };

export function groupSessionsByTime(sessions: ChatSession[]): HistoryGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - ((now.getDay() + 6) % 7) * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const buckets: Record<string, SessionListItem[]> = {
    今天: [],
    本周: [],
    本月: [],
    更早: [],
  };

  for (const s of sessions) {
    const item = { id: s.id, title: s.title, updatedAt: s.updatedAt };
    if (s.updatedAt >= startOfToday) buckets["今天"].push(item);
    else if (s.updatedAt >= startOfWeek) buckets["本周"].push(item);
    else if (s.updatedAt >= startOfMonth) buckets["本月"].push(item);
    else buckets["更早"].push(item);
  }

  return (["今天", "本周", "本月", "更早"] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}

export function initChatSessionState(): {
  sessions: ChatSession[];
  activeId: string;
  messages: StoredMessage[];
} {
  let sessions = loadChatSessions();
  let activeId = loadActiveSessionId();

  if (!activeId || !sessions.some((s) => s.id === activeId)) {
    if (sessions.length === 0) {
      const created = createEmptySession();
      sessions = [created];
      activeId = created.id;
      saveChatSessions(sessions, activeId);
    } else {
      activeId = sessions[0].id;
      saveChatSessions(sessions, activeId);
    }
  }

  const messages = sessions.find((s) => s.id === activeId)?.messages ?? [];
  return { sessions, activeId, messages };
}
