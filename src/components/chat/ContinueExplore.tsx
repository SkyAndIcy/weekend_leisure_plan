import { ExternalLink, MessageCircle } from "lucide-react";

type Props = {
  suggestions: string[];
  onSuggestionClick?: (text: string) => void;
};

const ContinueExplore = ({ suggestions, onSuggestionClick }: Props) => {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-2 rounded-2xl border border-border/60 bg-muted/30 overflow-hidden">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 mb-2.5">
          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold text-muted-foreground">继续探索</span>
        </div>
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestionClick?.(s)}
              className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl bg-card border border-border hover:border-primary hover:shadow-sm transition-all group"
            >
              <span className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {i + 1}
              </span>
              <span className="text-[13px] text-foreground/80 group-hover:text-foreground transition-colors">{s}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContinueExplore;
