import React from 'react';
import { LayoutDashboard, Layers, Video, Sparkles, MessageSquareCode } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const navItems = [
    { id: 'favorites', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'view', label: 'Rooms', icon: Layers },
    { id: 'cctv', label: 'CCTV', icon: Video },
    { id: 'scenes', label: 'Scenes', icon: Sparkles },
    { id: 'chat', label: 'Assistant', icon: MessageSquareCode },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111214] border-t border-[#383A3E] px-2 py-1.5 backdrop-blur-md">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-[#090A0C] bg-white shadow-sm'
                  : 'text-[#777777] hover:text-[#F5F5F5]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
