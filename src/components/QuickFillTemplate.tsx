import { useState, useRef, useEffect } from "react";
import { Clock, Users, Wallet, Zap, Coffee, Heart, Leaf, Plus, X, Check } from "lucide-react";

interface QuickFillTemplateProps {
  onSubmit: (text: string) => void;
}

// ── 日期选项：最近7天，显示"周几·几号"
function getUpcomingDays() {
  const result: { label: string; shortLabel: string; value: string; date: Date }[] = [];
  const weekMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const weekday = weekMap[d.getDay()];
    const label = i === 0 ? "今天" : i === 1 ? "明天" : weekday;
    const dateNum = `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({
      label,
      shortLabel: dateNum,
      value: `${weekday}${dateNum}`,
      date: d,
    });
  }
  return result;
}

const UPCOMING_DAYS = getUpcomingDays();
const HOURS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 8; // 08:00 – 21:00
  return `${String(h).padStart(2, "0")}:00`;
});

const DEFAULT_COMPANIONS = ["我", "儿子", "女儿", "妈妈", "爸爸", "另一半", "朋友"];

const STYLES = [
  { label: "亲子互动", icon: Heart,  value: "亲子互动" },
  { label: "轻松休闲", icon: Leaf,   value: "轻松休闲" },
  { label: "探索新地", icon: Zap,    value: "探索新地" },
  { label: "饕餮美食", icon: Coffee, value: "饕餮美食" },
];

// Budget steps: 0=50, 1=100, 2=150 … in increments of 50 up to 1000
const BUDGET_MIN = 50;
const BUDGET_MAX = 1000;
const BUDGET_STEP = 50;

function budgetLabel(val: number) {
  if (val <= BUDGET_MIN) return "¥50以内";
  if (val >= BUDGET_MAX) return "¥1000以上";
  return `¥${val}/人`;
}

// ── DateTime picker sub-component (date row + hour row)
interface DateTimePickerProps {
  label: string;
  day: string;      // e.g. "周六5/31"
  hour: string;     // e.g. "14:00"
  onDayChange: (d: string) => void;
  onHourChange: (h: string) => void;
  validHours?: string[];  // restrict selectable hours
}

const DateTimePicker = ({ label, day, hour, onDayChange, onHourChange, validHours }: DateTimePickerProps) => {
  const hours = validHours ?? HOURS;
  const scrollDayRef = useRef<HTMLDivElement>(null);
  const scrollHrRef  = useRef<HTMLDivElement>(null);

  // Auto-scroll selected into view
  useEffect(() => {
    const el = scrollDayRef.current?.querySelector("[data-selected=true]") as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [day]);
  useEffect(() => {
    const el = scrollHrRef.current?.querySelector("[data-selected=true]") as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [hour]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>

      {/* Day row */}
      <div
        ref={scrollDayRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 mb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {UPCOMING_DAYS.map((d) => {
          const active = day === d.value;
          return (
            <button
              key={d.value}
              data-selected={active}
              onClick={() => onDayChange(d.value)}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-2xl text-center transition-all border ${
                active
                  ? "bg-primary text-amber-900 border-primary shadow-sm"
                  : "bg-muted text-foreground border-border hover:bg-secondary"
              }`}
            >
              <span className="text-[11px] font-bold leading-tight">{d.label}</span>
              <span className={`text-[10px] leading-tight ${active ? "text-amber-800" : "text-muted-foreground"}`}>
                {d.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hour row */}
      <div
        ref={scrollHrRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {hours.map((h) => {
          const active = hour === h;
          return (
            <button
              key={h}
              data-selected={active}
              onClick={() => onHourChange(h)}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 w-14 h-8 rounded-xl text-xs font-semibold transition-all border ${
                active
                  ? "bg-primary text-amber-900 border-primary shadow-sm"
                  : "bg-muted text-foreground border-border hover:bg-secondary"
              }`}
            >
              {h}
            </button>
          );
        })}
      </div>
    </div>
  );
};


// ── Main component
const QuickFillTemplate = ({ onSubmit }: QuickFillTemplateProps) => {
  // ── 出发 / 结束
  const [startDay,  setStartDay]  = useState(UPCOMING_DAYS[0].value);
  const [startHour, setStartHour] = useState("14:00");
  const [endDay,    setEndDay]    = useState(UPCOMING_DAYS[0].value);
  const [endHour,   setEndHour]   = useState("18:00");

  // When user picks start, auto-fill end (same day, +4h)
  const handleStartDayChange = (d: string) => {
    setStartDay(d);
    setEndDay(d);
  };
  const handleStartHourChange = (h: string) => {
    setStartHour(h);
    // auto-set end hour to +2h
    const startIdx = HOURS.indexOf(h);
    const newEndIdx = Math.min(startIdx + 2, HOURS.length - 1);
    const suggested = HOURS[newEndIdx];
    // only update if end is currently <= new start
    if (endDay === startDay && endHour <= h) {
      setEndHour(suggested);
    }
  };

  // valid end hours: must be after start (only when same day)
  const validEndHours = startDay === endDay
    ? HOURS.filter((h) => h > startHour)
    : HOURS;

  // ── 出行人
  const [companions, setCompanions] = useState<string[]>(["我"]);
  const [allCompanions, setAllCompanions] = useState<string[]>(DEFAULT_COMPANIONS);
  const [customName, setCustomName] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  // 总人数：默认等于选中人数，用户可覆盖
  const [totalOverride, setTotalOverride] = useState<string>("");

  const autoTotal = companions.length;
  const displayTotal = totalOverride !== "" ? totalOverride : String(autoTotal);

  const toggleCompanion = (name: string) => {
    setCompanions((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
    // clear override so auto total kicks in
    setTotalOverride("");
  };

  const addCustomName = () => {
    const n = customName.trim();
    if (!n) return;
    if (!allCompanions.includes(n)) setAllCompanions((p) => [...p, n]);
    setCompanions((prev) => prev.includes(n) ? prev : [...prev, n]);
    setTotalOverride("");
    setCustomName("");
    setShowAddInput(false);
  };

  // ── 预算滑动条
  const [budget, setBudget] = useState(200);

  // ── 风格
  const [style, setStyle] = useState("轻松休闲");

  const handleSubmit = () => {
    const startStr = `${startDay} ${startHour}`;
    const endStr   = `${endDay} ${endHour}`;
    const total    = totalOverride !== "" ? totalOverride : String(autoTotal);
    const peopleStr = companions.length > 0
      ? `${companions.join("、")}等共${total}人`
      : `${total}人`;

    const text = `出发：${startStr}，返回：${endStr}，同行：${peopleStr}，人均预算${budgetLabel(budget).replace("¥", "").replace("/人", "")}元，偏好风格：${style}`;
    onSubmit(text);
  };

  return (
    <div className="px-5 pt-3 pb-5 flex flex-col gap-4">

      {/* ── 出发 / 结束 时间 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
          <Clock className="w-3.5 h-3.5 text-meituan-orange" /> 出发 / 结束时间
        </label>

        <div className="flex gap-3 items-start">
          <DateTimePicker
            label="出发"
            day={startDay}
            hour={startHour}
            onDayChange={handleStartDayChange}
            onHourChange={handleStartHourChange}
          />

          {/* divider */}
          <div className="flex flex-col items-center pt-7 shrink-0">
            <div className="w-px h-8 bg-border/60 rounded-full" />
            <span className="text-[10px] text-muted-foreground mt-1 font-medium">→</span>
          </div>

          <DateTimePicker
            label="结束"
            day={endDay}
            hour={endHour}
            onDayChange={setEndDay}
            onHourChange={setEndHour}
            validHours={validEndHours}
          />
        </div>
      </div>

      {/* ── 出行人 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <Users className="w-3.5 h-3.5 text-purple-500" /> 出行人
          </label>
          {/* 总人数 inline */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">共</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={displayTotal}
              onChange={(e) => setTotalOverride(e.target.value)}
              onBlur={() => {
                const v = parseInt(totalOverride);
                if (!v || v < 1) setTotalOverride("");
              }}
              className="w-10 h-7 rounded-lg border border-border bg-muted text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">人</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {allCompanions.map((name) => {
            const active = companions.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleCompanion(name)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1 ${
                  active
                    ? "bg-primary text-amber-900 border-primary"
                    : "bg-muted text-foreground border-border hover:bg-secondary"
                }`}
              >
                {active && <Check className="w-3 h-3 shrink-0" />}
                {name}
              </button>
            );
          })}

          {showAddInput ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomName();
                  if (e.key === "Escape") setShowAddInput(false);
                }}
                placeholder="输入名字"
                className="w-20 h-8 px-2 rounded-full border border-primary/60 bg-primary/10 text-xs focus:outline-none"
              />
              <button
                onClick={addCustomName}
                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center"
              >
                <Check className="w-3.5 h-3.5 text-amber-900" />
              </button>
              <button
                onClick={() => setShowAddInput(false)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-border text-muted-foreground hover:border-primary hover:text-amber-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 添加
            </button>
          )}
        </div>
      </div>

      {/* ── 人均预算 slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <Wallet className="w-3.5 h-3.5 text-meituan-red" /> 人均预算
          </label>
          <span className="text-sm font-bold text-amber-700">{budgetLabel(budget)}</span>
        </div>
        <div className="relative px-1">
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(43 100% 50%) 0%, hsl(43 100% 50%) ${
                ((budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100
              }%, hsl(var(--muted)) ${
                ((budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100
              }%, hsl(var(--muted)) 100%)`,
            }}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">¥50</span>
            <span className="text-[10px] text-muted-foreground">¥1000+</span>
          </div>
        </div>
      </div>

      {/* ── 出行风格 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
          <Zap className="w-3.5 h-3.5 text-meituan-orange" /> 出行风格
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {STYLES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl text-[11px] font-semibold transition-all border ${
                  style === s.value
                    ? "bg-primary text-amber-900 border-primary shadow-sm"
                    : "bg-muted text-foreground border-border hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 提交 */}
      <button
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-1"
        style={{
          background: "#FBE4BA",
          boxShadow: "0 4px 16px hsl(38 89% 86% / 0.45)",
        }}
      >
        ✨ 帮我安排一下
      </button>
    </div>
  );
};

export default QuickFillTemplate;
