import { useState } from "react";
import { MapPin, Navigation, Keyboard, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LocationPermissionModalProps {
  onAllow: () => void;          // 用户同意 GPS
  onManual: (name: string) => void;  // 用户手动输入
  onDismiss: () => void;
}

const LocationPermissionModal = ({ onAllow, onManual, onDismiss }: LocationPermissionModalProps) => {
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const handleManualSubmit = () => {
    const val = manualInput.trim();
    if (!val) return;
    onManual(val);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-t-3xl w-full max-w-[430px] pb-8"
          style={{ boxShadow: "var(--shadow-modal)" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Close */}
          <button
            onClick={onDismiss}
            className="absolute top-5 right-5 w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait">
            {!showManual ? (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-6 pt-4 pb-2"
              >
                {/* Icon */}
                <div className="flex justify-center mb-5">
                  <div
                    className="w-16 h-16 rounded-[24px] flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, hsl(43 100% 50% / 0.2), hsl(33 95% 52% / 0.15))",
                    }}
                  >
                    <MapPin className="w-8 h-8 text-amber-600" />
                  </div>
                </div>

                <h2 className="text-[18px] font-bold text-center mb-2">获取您的位置</h2>
                <p className="text-sm text-muted-foreground text-center leading-relaxed mb-7 mx-4">
                  开启定位后，周末喵将为您推荐<br />
                  <span className="text-foreground/80 font-medium">附近的好玩好吃地方</span>，让出行更便捷
                </p>

                {/* Allow GPS */}
                <button
                  onClick={onAllow}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 flex items-center justify-center gap-2 mb-3 transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                    boxShadow: "0 4px 16px hsl(43 100% 50% / 0.35)",
                  }}
                >
                  <Navigation className="w-4 h-4" />
                  允许获取当前位置
                </button>

                {/* Manual input */}
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full py-3 rounded-2xl font-semibold text-sm text-foreground/70 flex items-center justify-center gap-2 bg-muted hover:bg-secondary transition-colors"
                >
                  <Keyboard className="w-4 h-4" />
                  手动输入地址
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-6 pt-4 pb-2"
              >
                <button
                  onClick={() => setShowManual(false)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
                >
                  ← 返回
                </button>

                <h2 className="text-[17px] font-bold mb-1">输入您的出发地址</h2>
                <p className="text-xs text-muted-foreground mb-5">输入你常在的地方，方便周末喵为你推荐附近活动</p>

                <input
                  autoFocus
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
                  placeholder="例如：望京、中关村、天河城附近…"
                  className="w-full px-4 py-3.5 rounded-2xl border border-border/70 bg-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 mb-4 transition-all"
                />

                {/* Quick picks */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {["公司附近", "家附近", "商场附近", "地铁站附近"].map((q) => (
                    <button
                      key={q}
                      onClick={() => setManualInput(q)}
                      className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-foreground/70 hover:bg-primary/10 hover:text-amber-700 transition-colors border border-border/50"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-amber-900 disabled:opacity-40 transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, hsl(43 100% 50%), hsl(33 95% 52%))",
                    boxShadow: "0 3px 12px hsl(43 100% 50% / 0.3)",
                  }}
                >
                  确认地址
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LocationPermissionModal;
