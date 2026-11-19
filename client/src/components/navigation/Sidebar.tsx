import React from 'react';
import {
  LayoutDashboard,
  Star,
  Layers,
  Video,
  Sparkles,
  MessageSquareCode,
  Workflow,
  Cpu,
  Activity,
  Sliders,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAdmin: (tab?: any) => void;
  adminStudioOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onOpenAdmin, adminStudioOpen }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'view', label: 'Rooms', icon: Layers },
    { id: 'cctv', label: 'CCTV', icon: Video },
    { id: 'scenes', label: 'Scenes', icon: Sparkles },
    { id: 'chat', label: 'Assistant', icon: MessageSquareCode },
    { id: 'automations', label: 'Automations', icon: Workflow },
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'energy', label: 'Energy', icon: Activity },
    { id: 'admin-studio', label: 'Admin Studio', icon: Sliders },
  ];

  const handleNavClick = (id: string) => {
    if (id === 'admin-studio') {
      onOpenAdmin();
      return;
    }
    setCurrentTab(id);
  };

  return (
    <aside className="w-[260px] h-screen bg-[#111214] border-r border-[#383A3E] flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto scrollbar-none">
      {/* Top Branding Section */}
      <div>
        <div className="p-5 border-b border-[#383A3E]/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-[#090A0C] flex items-center justify-center font-black text-xl shadow-sm tracking-tighter">
            D
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wider text-[#F5F5F5] uppercase">
                DOMINATE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D68A] animate-pulse" />
            </div>
            <p className="text-[10px] font-mono tracking-widest text-[#777777] uppercase">
              Smart Building OS
            </p>
          </div>
        </div>

        {/* Main Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'admin-studio' ? Boolean(adminStudioOpen) : currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-white text-[#090A0C] shadow-sm font-semibold'
                    : 'text-[#A6A6A6] hover:text-[#F5F5F5] hover:bg-[#191A1D]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#090A0C]' : item.id === 'favorites' ? 'text-[#F0B94D]' : 'text-[#777777] group-hover:text-[#F5F5F5]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#090A0C]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

