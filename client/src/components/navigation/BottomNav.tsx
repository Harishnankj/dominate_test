import React from 'react';
import { Star, LayoutGrid, Video, Wand2, MessageSquareText, UserCheck, Shield } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const navItems = [
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'view', label: 'Rooms', icon: LayoutGrid },
    { id: 'cctv', label: 'CCTV', icon: Video },
    { id: 'scenes', label: 'Scenes', icon: Wand2 },
    { id: 'attendance', label: 'HR Punch', icon: UserCheck },
    { id: 'chat', label: 'Assistant', icon: MessageSquareText },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-white/10 px-2 py-2 md:py-3 max-w-lg md:max-w-2xl mx-auto md:bottom-4 md:rounded-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive
                  ? 'text-cyan-400 scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-cyan-500/15 shadow-glow' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-cyan-400 font-semibold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
