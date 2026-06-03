import { useState } from "react";
import { motion } from "framer-motion";
import TabNavigation, { type TabId } from "@/components/TabNavigation";
import AskXiaoTuan from "@/components/AskXiaoTuan";
import GuidesTab from "@/components/GuidesTab";
import ItineraryTab from "@/components/ItineraryTab";
import ProfileTab from "@/components/ProfileTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("ask");
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="min-h-screen bg-background flex justify-center overflow-hidden">
      <div className="w-full max-w-[430px] min-h-screen bg-background relative shadow-xl">
        <main className="pb-28 overflow-y-auto scrollbar-hide" style={{ height: "100vh" }}>
          {/* 用 hidden 切换而非条件卸载，避免切 Tab 后问小喵对话丢失 */}
          <div className={activeTab === "ask" ? "h-full" : "hidden"} aria-hidden={activeTab !== "ask"}>
            <AskXiaoTuan showSidebar={showSidebar} onSidebarChange={setShowSidebar} />
          </div>
          <div className={activeTab === "guides" ? "h-full" : "hidden"} aria-hidden={activeTab !== "guides"}>
            <GuidesTab />
          </div>
          <div className={activeTab === "itinerary" ? "h-full" : "hidden"} aria-hidden={activeTab !== "itinerary"}>
            <ItineraryTab />
          </div>
          <div className={activeTab === "profile" ? "h-full" : "hidden"} aria-hidden={activeTab !== "profile"}>
            <ProfileTab />
          </div>
        </main>
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};

export default Index;
