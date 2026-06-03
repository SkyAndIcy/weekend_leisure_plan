import { MessageCircle, Compass, Map, User } from "lucide-react";
import { motion } from "framer-motion";

type TabId = "ask" | "guides" | "itinerary" | "profile";

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "ask",       label: "问小喵", icon: MessageCircle },
  { id: "guides",    label: "探索",   icon: Compass },
  { id: "itinerary", label: "行程",   icon: Map },
  { id: "profile",   label: "我的",   icon: User },
];

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-background"
    >
      {/* safe area */}
      <div className="flex items-center h-[56px] px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200"
            >
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <motion.div
                  animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <tab.icon
                    className="w-[22px] h-[22px] transition-colors duration-200"
                    style={{
                      color: isActive ? "hsl(28 60% 28%)" : "hsl(40 30% 70%)",
                      strokeWidth: isActive ? 2.2 : 1.8,
                    }}
                  />
                </motion.div>
                <span
                  className="text-[10px] font-medium transition-colors duration-200"
                  style={{ color: isActive ? "hsl(28 60% 28%)" : "hsl(40 30% 70%)" }}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {/* iPhone home indicator space */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
};

export default TabNavigation;
export type { TabId };
