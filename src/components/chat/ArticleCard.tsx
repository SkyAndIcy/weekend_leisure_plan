import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Utensils, Hotel, Clock, CheckCircle, ChevronDown, ChevronUp, Sparkles, Navigation, Calendar, Star, Ticket } from "lucide-react";
import mascotImg from "@/assets/zhoumoumiao-mascot.png";

interface ArticleCardProps {
  content: string;
  /** 下方已有行程表时，只展示摘要，避免与行程表重复 */
  compact?: boolean;
}

function extractArrangeBullets(sections: Section[]): string[] {
  const sec = sections.find((s) => /一键安排/.test(s.title) || /订座|排队|同行/.test(s.body));
  if (!sec) return [];
  return sec.body
    .split("\n")
    .map((l) => l.replace(/^[*\-]\s+/, "").replace(/\*+/g, "").trim())
    .filter((l) => l.length > 2)
    .slice(0, 3);
}

// ─── types ────────────────────────────────────────────────────────────────────
interface Section {
  tag: string;       // e.g. "上午", "中午", "下午"
  title: string;
  body: string;
  imageHints: string[];
  places: PlaceHint[];
}

interface PlaceHint {
  name: string;
  type: "scenic" | "food" | "hotel";
  time?: string;
  price?: string;
  tip?: string;
}

interface ParsedArticle {
  title: string;
  summary: string;
  sections: Section[];
  suggestions: string[];
  destination: string;
  duration: string;
}

// ─── image pools (Unsplash landscape) ──────────────────────────────────────
const SCENIC_IMGS = [
  "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=600&q=80",
  "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
];
const FOOD_IMGS = [
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
];
const HOTEL_IMGS = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80",
];

function pickImg(type: "scenic" | "food" | "hotel", seed: number) {
  const pool = type === "food" ? FOOD_IMGS : type === "hotel" ? HOTEL_IMGS : SCENIC_IMGS;
  return pool[seed % pool.length];
}

// ─── colour helpers ───────────────────────────────────────────────────────────
const typeConfig = {
  scenic: { icon: MapPin,   bg: "bg-meituan-blue",   text: "text-meituan-blue",   border: "border-meituan-blue/30",   label: "景点" },
  food:   { icon: Utensils, bg: "bg-meituan-orange",  text: "text-meituan-orange", border: "border-meituan-orange/30", label: "美食" },
  hotel:  { icon: Hotel,    bg: "bg-purple-500",      text: "text-purple-500",     border: "border-purple-300",        label: "住宿" },
};

const TAG_COLORS: Record<string, string> = {
  上午: "bg-amber-50 text-amber-700 border-amber-200",
  中午: "bg-orange-50 text-orange-700 border-orange-200",
  下午: "bg-blue-50 text-blue-700 border-blue-200",
  傍晚: "bg-purple-50 text-purple-700 border-purple-200",
  夜晚: "bg-indigo-50 text-indigo-700 border-indigo-200",
  早晨: "bg-yellow-50 text-yellow-700 border-yellow-200",
  晚上: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

// ─── parser ───────────────────────────────────────────────────────────────────
export function parseArticle(raw: string): ParsedArticle {
  const lines = raw.split("\n");

  // title: first h1 or h2
  let title = "";
  let summary = "";
  const sections: Section[] = [];
  const suggestions: string[] = [];
  let destination = "";
  let duration = "";

  // extract dest & duration from title/early text
  const firstH1 = lines.find((l) => /^#\s/.test(l));
  if (firstH1) title = firstH1.replace(/^#+\s*/, "").trim();

  // destination guess from title
  const destMatch = title.match(/^([\u4e00-\u9fa5]{2,6})/);
  if (destMatch) destination = destMatch[1];
  const durMatch = title.match(/(\d+)\s*[天日]/);
  if (durMatch) duration = `${durMatch[1]}天`;

  // collect sections by ### headings
  let currentSection: Section | null = null;
  let bodyLines: string[] = [];
  let summaryLines: string[] = [];
  let inSummary = true;
  let bottomLines: string[] = [];
  let inBottom = false;

  const TIME_TAGS = ["上午", "早晨", "中午", "下午", "傍晚", "夜晚", "晚上"];

  const flushSection = () => {
    if (!currentSection) return;
    const text = bodyLines.join("\n");
    currentSection.body = text;
    // extract places from text
    const placeRegex = /\*{1,2}([^*\n]+)\*{1,2}/g;
    let pm: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((pm = placeRegex.exec(text)) !== null) {
      const name = pm[1].trim().slice(0, 20);
      if (name.length < 2 || seen.has(name)) continue;
      seen.add(name);
      const type =
        name.includes("酒店") || name.includes("民宿") || name.includes("客栈") ? "hotel"
          : name.includes("餐") || name.includes("小吃") || name.includes("美食") || name.includes("汤") || name.includes("楼") || name.includes("饭") ? "food"
          : "scenic";
      // price hint
      const priceM = text.match(/¥[\d,]+|免费|人均[\d¥]+/);
      currentSection.places.push({ name, type, price: priceM?.[0] });
    }
    sections.push(currentSection);
    currentSection = null;
    bodyLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // bottom suggestions area (### 核心 or ## 总结 near end)
    if (/^#{1,2}\s*(核心|总结|玩法|贴士|小结|温馨|建议)/.test(l)) {
      inBottom = true;
      flushSection();
      inSummary = false;
      continue;
    }

    if (inBottom) {
      if (/^\*\s+/.test(l) || /^-\s+/.test(l)) {
        const s = l.replace(/^[*\-]\s+/, "").replace(/\*+/g, "").trim();
        if (s.length > 4) bottomLines.push(s);
      }
      continue;
    }

    // section heading ###
    if (/^###\s/.test(l)) {
      flushSection();
      inSummary = false;
      const heading = l.replace(/^###\s*/, "").trim();
      // detect time tag like "上午｜xxx" or "上午：xxx"
      let tag = "";
      let sectionTitle = heading;
      for (const t of TIME_TAGS) {
        if (heading.startsWith(t)) {
          tag = t;
          sectionTitle = heading.replace(/^[^\|｜·：:]+[|｜·：:]\s*/, "").trim() || heading.slice(tag.length).replace(/^[·：:\|｜\s]+/, "").trim();
          break;
        }
      }
      if (!tag) {
        // try to extract time tag from middle
        const tm = heading.match(/(上午|早晨|中午|下午|傍晚|夜晚|晚上)/);
        if (tm) tag = tm[1];
      }
      currentSection = { tag, title: sectionTitle || heading, body: "", imageHints: [], places: [] };
      continue;
    }

    if (inSummary) {
      if (/^#\s/.test(l)) continue; // skip h1
      summaryLines.push(l);
    } else if (currentSection) {
      bodyLines.push(l);
    }
  }
  flushSection();

  // build summary from first paragraph after h1
  const rawSummary = summaryLines.join("\n").replace(/#+.*/g, "").replace(/\*+/g, "").trim();
  summary = rawSummary.split(/\n\n/)[0].replace(/\n/g, " ").trim().slice(0, 180);

  // suggestions: generate from bottom lines + auto
  const autoSuggestions = bottomLines.slice(0, 3);
  if (autoSuggestions.length < 2) {
    if (destination) {
      autoSuggestions.push(`${destination}还有什么值得打卡的地方？`);
      autoSuggestions.push(`${destination}有什么美食推荐？`);
      autoSuggestions.push(`${destination}附近的住宿怎么选？`);
    } else {
      autoSuggestions.push("还有哪些景点可以推荐？");
      autoSuggestions.push("附近有什么特色美食？");
      autoSuggestions.push("帮我规划另一个城市的行程");
    }
  }

  return {
    title,
    summary,
    sections,
    suggestions: autoSuggestions.slice(0, 3),
    destination,
    duration,
  };
}

// ─── Timeline stop card (in route section) ───────────────────────────────────
const TimelineStop = ({
  place,
  idx,
  imgSeed,
  isLast,
}: {
  place: PlaceHint;
  idx: number;
  imgSeed: number;
  isLast: boolean;
}) => {
  const cfg = typeConfig[place.type];
  const Icon = cfg.icon;
  const [booked, setBooked] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-6">
        <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center shadow-sm border-2 border-card z-10`}>
          <span className="text-white text-[9px] font-bold">{idx + 1}</span>
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1 bg-border min-h-[32px]" />}
      </div>
      {/* Card */}
      <div className={`flex-1 mb-4 rounded-xl border ${cfg.border} bg-card overflow-hidden shadow-sm`}>
        {/* image */}
        <div className="h-28 overflow-hidden relative">
          <img
            src={pickImg(place.type, imgSeed)}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.border} bg-card/90 ${cfg.text} flex items-center gap-1`}>
            <Icon className="w-2.5 h-2.5" />{cfg.label}
          </span>
          {place.price && (
            <span className="absolute bottom-2 right-2 text-[11px] font-bold text-white bg-black/50 px-2 py-0.5 rounded-full">
              {place.price}
            </span>
          )}
        </div>
        {/* info */}
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{place.name}</h4>
            <button
              onClick={() => setBooked(!booked)}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                booked
                  ? "bg-meituan-green/10 text-meituan-green"
                  : "bg-primary text-primary-foreground hover:bg-meituan-yellow-hover"
              }`}
            >
              {booked ? (
                <><CheckCircle className="w-3 h-3" />已预定</>
              ) : (
                <><Ticket className="w-3 h-3" />立即预定</>
              )}
            </button>
          </div>
          {place.tip && <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{place.tip}</p>}
        </div>
      </div>
    </div>
  );
};

// ─── Section detail card (分) ────────────────────────────────────────────────
const SectionCard = ({
  section,
  globalIdx,
}: {
  section: Section;
  globalIdx: number;
}) => {
  const [expanded, setExpanded] = useState(true);
  const tagClass = TAG_COLORS[section.tag] || "bg-muted text-muted-foreground border-border";

  // Clean body for display (strip markdown)
  const cleanBody = section.body
    .replace(/^#+\s*/gm, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/>\s?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // main image: pick by section index
  const mainImgType = section.places[0]?.type ?? "scenic";
  const mainImgSeed = globalIdx;

  // pull quote from blockquotes
  const quoteMatch = section.body.match(/>\s?"([^"\n]+)"/);
  const quote = quoteMatch ? quoteMatch[1] : null;

  const bodyLines = cleanBody
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l !== section.title && !l.startsWith(section.title));
  const displayBody = bodyLines.find((l) => l.length > 8 && !/^\d{1,2}:\d{2}/.test(l)) ?? bodyLines[0] ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: globalIdx * 0.05 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
    >
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {section.tag && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tagClass}`}>
              {section.tag}
            </span>
          )}
          <span className="font-semibold text-sm">{section.title}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative h-32 overflow-hidden">
              <img
                src={pickImg(mainImgType, mainImgSeed)}
                alt={section.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="px-4 py-3 space-y-3">
              {displayBody && (
                <p className="text-[13.5px] text-foreground/80 leading-relaxed">{displayBody}</p>
              )}

              {/* Pull quote */}
              {quote && (
                <div className="border-l-2 border-primary bg-primary/5 rounded-r-xl px-3 py-2">
                  <p className="text-[12px] text-muted-foreground italic">"{quote}"</p>
                </div>
              )}

              {/* Place chips */}
              {section.places.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {section.places.slice(0, 4).map((p) => {
                    const cfg = typeConfig[p.type];
                    const Ic = cfg.icon;
                    return (
                      <span
                        key={p.name}
                        className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} bg-card font-medium`}
                      >
                        <Ic className="w-2.5 h-2.5" />{p.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Mini route map (SVG) ─────────────────────────────────────────────────────
const MiniRouteMap = ({ places }: { places: PlaceHint[] }) => {
  if (places.length === 0) return null;

  // Lay out stops in a curved S-path for visual interest
  const W = 320, H = 180;
  const pts = places.slice(0, 6).map((_, i) => {
    const t = i / Math.max(places.length - 1, 1);
    const x = 40 + t * (W - 80);
    const y = i % 2 === 0 ? H * 0.3 : H * 0.65;
    return { x, y };
  });

  const pathD = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  return (
    <div className="relative bg-[hsl(210_20%_96%)] rounded-xl overflow-hidden" style={{ height: H }}>
      {/* Decorative water blob */}
      <div className="absolute top-[20%] left-[30%] w-[25%] h-[35%] rounded-full bg-[hsl(200_60%_85%)] opacity-50" />
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="hsl(43 100% 50%)" strokeWidth="2" strokeDasharray="6 3" opacity="0.7" />
        {pts.slice(0, -1).map((p, i) => {
          const next = pts[i + 1];
          return <circle key={i} cx={(p.x + next.x) / 2} cy={(p.y + next.y) / 2} r="2.5" fill="hsl(43 100% 50%)" opacity="0.5" />;
        })}
      </svg>
      {pts.map((p, i) => {
        const place = places[i];
        const cfg = typeConfig[place.type];
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{
              left: `${(p.x / W) * 100}%`,
              top: `${(p.y / H) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center shadow border-2 border-card z-10 relative`}>
              <span className="text-white text-[8px] font-bold">{i + 1}</span>
            </div>
            <span className="text-[8px] mt-0.5 font-medium bg-card/90 px-1 rounded shadow-sm whitespace-nowrap max-w-[60px] truncate">
              {place.name}
            </span>
          </div>
        );
      })}
      {/* Legend */}
      <div className="absolute bottom-1.5 left-2 bg-card/80 rounded-lg px-2 py-1 flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <div className="w-2 h-0 border-t-2 border-dashed border-primary" /> 路线
        </span>
      </div>
    </div>
  );
};

// ─── Main ArticleCard ─────────────────────────────────────────────────────────
const ArticleCard = ({ content, compact = false }: ArticleCardProps) => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
  const parsed = parseArticle(content);
  const arrangeBullets = extractArrangeBullets(parsed.sections);

  // Collect all places for route section
  const allPlaces = parsed.sections.flatMap((s) => s.places).slice(0, 6);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl shadow-card border border-border overflow-hidden bg-card"
    >
      {/* ── HEADER STRIP ────────────────────────────────────────────────────── */}
      <header className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary/15 via-primary/5 to-card border-b border-border/60 overflow-hidden">
        {/* background decoration */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/10" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-meituan-orange/10" />

        <div className="relative">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5">
              <img src={mascotImg} alt="" className="w-4 h-4 rounded-full" />
              周末喵和你的对话
            </span>
            <span>{dateStr}</span>
          </div>

          {/* Task summary badge */}
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11px] font-semibold text-meituan-green flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> 已完成
                </span>
                {parsed.duration && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Calendar className="w-2.5 h-2.5" />{parsed.duration}
                  </span>
                )}
                {parsed.destination && (
                  <span className="text-[10px] bg-meituan-blue/10 text-meituan-blue px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Navigation className="w-2.5 h-2.5" />{parsed.destination}
                  </span>
                )}
              </div>
              <h1 className="font-bold text-[17px] leading-snug tracking-tight">{parsed.title || "旅行规划"}</h1>
            </div>
          </div>

          {/* Summary */}
          {parsed.summary && (
            <p className="text-[13px] leading-relaxed text-foreground/75 bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
              {parsed.summary}
            </p>
          )}

          {!compact && parsed.sections.length > 0 && (
            <div className="flex gap-2 mt-3">
              <div className="flex items-center gap-1 bg-card/80 rounded-full px-2.5 py-1 border border-border text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" /> {parsed.sections.length} 个时段
              </div>
              {allPlaces.length > 0 && (
                <div className="flex items-center gap-1 bg-card/80 rounded-full px-2.5 py-1 border border-border text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {allPlaces.length} 个地点
                </div>
              )}
            </div>
          )}

          {compact && arrangeBullets.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-foreground/80">
              {arrangeBullets.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span className="text-primary">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {/* ── 分：SECTION DETAILS ──────────────────────────────────────────────── */}
      {!compact && parsed.sections.filter((s) => !/一键安排/.test(s.title)).length > 0 && (
        <section className="px-4 py-4 space-y-3">
          <h2 className="text-[13px] font-bold text-muted-foreground flex items-center gap-1.5 mb-1">
            <span className="w-1 h-4 rounded-full bg-primary inline-block" />
            行程详情
          </h2>
          {parsed.sections
            .filter((s) => !/一键安排/.test(s.title))
            .map((sec, i) => (
              <SectionCard key={i} section={sec} globalIdx={i} />
            ))}
        </section>
      )}

      {/* ── 路线：ROUTE MAP + TIMELINE ──────────────────────────────────────── */}
      {!compact && allPlaces.length > 0 && (
        <section className="px-4 pb-4">
          <h2 className="text-[13px] font-bold text-muted-foreground flex items-center gap-1.5 mb-3">
            <span className="w-1 h-4 rounded-full bg-meituan-blue inline-block" />
            路线规划
          </h2>

          {/* Mini map */}
          <MiniRouteMap places={allPlaces} />

          {/* Timeline with booking buttons */}
          <div className="mt-4">
            {allPlaces.map((place, i) => (
              <TimelineStop
                key={i}
                place={place}
                idx={i}
                imgSeed={i + parsed.sections.length}
                isLast={i === allPlaces.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="px-4 py-3 border-t border-border/60">
        <p className="text-center text-[10px] text-muted-foreground">内容由 AI 生成 · 仅供参考</p>
      </footer>
    </motion.article>
  );
};

export default ArticleCard;
