import { ChevronRight, Compass, Sparkles } from "lucide-react";
import type { ExploreGuide } from "@/lib/explore-suggestions";

type Props = {
  guides: ExploreGuide[];
  onGuideClick?: (prompt: string) => void;
};

const ContinueExplore = ({ guides, onGuideClick }: Props) => {
  if (guides.length === 0) return null;

  return (
    <section className="mt-2 rounded-2xl border border-border/60 bg-muted/30 overflow-hidden">
      <div className="px-3 pt-3 pb-3">
        <div className="flex items-start gap-2 mb-3">
          <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Compass className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground">接下来可以…</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              选好方向，小喵在当前方案上接着帮你聊
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {guides.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onGuideClick?.(g.prompt)}
              className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group active:scale-[0.99]"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary/70 shrink-0 group-hover:text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{g.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{g.hint}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContinueExplore;
