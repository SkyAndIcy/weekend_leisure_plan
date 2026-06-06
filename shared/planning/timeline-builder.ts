import type { MealKind, RoutePattern } from "./route-pattern.ts";
import { mealWindowMin } from "./route-pattern.ts";
import type { Poi } from "./types.ts";
import type { TimelineSlot } from "./types.ts";
import type { RankedCandidate } from "./pipeline/types.ts";

const TRANSIT = 20;
const TRANSIT_EXTRA = 15;

export function fmtClock(totalMin: number): string {
  const t = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function eatNotes(queueMin: number, mealLabel: string): string {
  const base =
    queueMin > 0
      ? `推荐就餐（${mealLabel}），高峰约排队${queueMin}分钟，请在行程表点击「立即预定」`
      : `推荐就餐（${mealLabel}），请在行程表点击「立即预定」`;
  return base;
}

function playSlot(start: number, poi: Poi, notes?: string): TimelineSlot {
  const end = start + poi.durationMin;
  return {
    start: fmtClock(start),
    end: fmtClock(end),
    phase: "play",
    poi,
    notes: notes ?? poi.description,
  };
}

function eatSlot(start: number, poi: Poi, notes: string): TimelineSlot {
  const end = start + poi.durationMin;
  return {
    start: fmtClock(start),
    end: fmtClock(end),
    phase: "eat",
    poi,
    notes,
  };
}

function extraSlot(start: number, poi: Poi): TimelineSlot {
  const end = start + poi.durationMin;
  return {
    start: fmtClock(start),
    end: fmtClock(end),
    phase: "extra",
    poi,
    notes: poi.description,
  };
}

/** 正餐开始时刻：落在午餐/晚餐窗口内 */
function anchorEatStart(
  mealKind: MealKind,
  earliestMin: number,
  eatDurationMin: number,
): number {
  const w = mealWindowMin(mealKind);
  const preferred = w.start + Math.max(0, Math.floor((w.end - w.start - eatDurationMin) / 2));
  return clamp(preferred, Math.max(w.start, earliestMin), w.end - eatDurationMin);
}

/** 从召回池选第二站「玩」（与第一站不同） */
export function pickSecondPlay(
  attractionPool: RankedCandidate[],
  excludeId: string,
): Poi | null {
  for (const c of attractionPool) {
    if (c.poi.id !== excludeId && c.poi.category === "attraction") {
      return c.poi;
    }
  }
  return null;
}

export interface BuildTimelineOpts {
  pattern: RoutePattern;
  mealKind: MealKind;
  departMin: number;
  play: Poi;
  eat: Poi;
  extra: Poi | null;
  play2: Poi | null;
  queueMin: number;
}

export function buildTimeline(opts: BuildTimelineOpts): TimelineSlot[] {
  const { pattern, mealKind, departMin, play, eat, extra, play2, queueMin } = opts;
  const meal = mealWindowMin(mealKind);
  const eatNote = eatNotes(queueMin, meal.label);
  const slots: TimelineSlot[] = [];

  if (pattern === "eat_play" || pattern === "eat_play_play") {
    const eatStart = anchorEatStart(mealKind, departMin, eat.durationMin);
    slots.push(eatSlot(eatStart, eat, eatNote));
    let cursor = eatStart + eat.durationMin + TRANSIT;
    slots.push(playSlot(cursor, play));
    cursor += play.durationMin + (pattern === "eat_play_play" && play2 ? TRANSIT : 0);
    if (pattern === "eat_play_play" && play2) {
      slots.push(playSlot(cursor, play2));
    }
    return slots;
  }

  if (pattern === "play_eat_play" && play2) {
    let eatStart = anchorEatStart(
      mealKind,
      departMin + play.durationMin + TRANSIT,
      eat.durationMin,
    );
    let play1End = eatStart - TRANSIT;
    let play1Start = play1End - play.durationMin;
    if (play1Start < departMin) {
      play1Start = departMin;
      play1End = play1Start + play.durationMin;
      eatStart = anchorEatStart(mealKind, play1End + TRANSIT, eat.durationMin);
    }
    slots.push(playSlot(play1Start, play));
    slots.push(eatSlot(eatStart, eat, eatNote));
    const play2Start = eatStart + eat.durationMin + TRANSIT;
    slots.push(playSlot(play2Start, play2));
    return slots;
  }

  // play_eat / play_eat_extra：先玩再吃（正餐锚定窗口）
  let eatStart = anchorEatStart(
    mealKind,
    departMin + play.durationMin + TRANSIT,
    eat.durationMin,
  );
  let playStart = eatStart - TRANSIT - play.durationMin;
  if (playStart < departMin) {
    playStart = departMin;
    eatStart = anchorEatStart(mealKind, playStart + play.durationMin + TRANSIT, eat.durationMin);
  }
  slots.push(playSlot(playStart, play));
  slots.push(eatSlot(eatStart, eat, eatNote));

  if ((pattern === "play_eat_extra" || pattern === "play_eat") && extra) {
    const extraStart = eatStart + eat.durationMin + TRANSIT_EXTRA;
    slots.push(extraSlot(extraStart, extra));
  }

  return slots;
}

export function buildNotifyText(
  slots: TimelineSlot[],
  mealKind: MealKind,
  patternLabel: string,
): string {
  const parts = slots.map((s) => {
    const tag = s.phase === "eat" ? "用餐" : s.phase === "extra" ? "加项" : "玩";
    return `${tag} ${s.poi.name}（${s.start}-${s.end}）`;
  });
  const meal = mealKind === "lunch" ? "午餐" : "晚餐";
  return `搞定了，动线：${patternLabel}，${meal}已安排在常规时段。${parts.join("，")}。记得在行程表点「立即预定」餐厅。`;
}
