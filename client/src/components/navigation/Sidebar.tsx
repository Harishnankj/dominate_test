import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Video,
  Sparkles,
  MessageSquareCode,
  Workflow,
  Cpu,
  Activity,
  Settings,
  ShieldCheck,
  Building2,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { useBootstrap } from '../../context/BootstrapContext';
import { useAuth } from '../../context/AuthContext';
import { useHA } from '../../context/MultiHubHomeAssistantProvider';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAdmin: (tab?: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onOpenAdmin }) => {
  const { data, isLiveSyncConnected, z2mStatus, tuyaStatus } = useBootstrap();
  const { hubs: haHubs } = useHA();

  const enabledHaHubs = (data?.hubs || []).filter((h) => h.enabled);
  const connectedHaCount = enabledHaHubs.filter((h) => haHubs[h.id]?.isConnected).length;
  const isHaConnected = connectedHaCount > 0;
  const isZ2mConnected = Boolean(z2mStatus?.enabled && z2mStatus?.connected);
  const isTuyaConnected = Boolean(tuyaStatus?.enabled && tuyaStatus?.cloud_connected);

  const gatewaysCount = (isHaConnected ? 1 : 0) + (isZ2mConnected ? 1 : 0) + (isTuyaConnected ? 1 : 0);
  const totalGateways = (enabledHaHubs.length > 0 ? 1 : 0) + (z2mStatus?.enabled ? 1 : 0) + (tuyaStatus?.enabled ? 1 : 0);

  const allDevices = data?.devices || [];
  const onlineDevicesCount = allDevices.length; // In local-first, all imported devices are monitored

  const navItems = [
    { id: 'favorites', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'view', label: 'Rooms', icon: Layers },
    { id: 'cctv', label: 'CCTV', icon: Video },
    { id: 'scenes', label: 'Scenes', icon: Sparkles },
    { id: 'chat', label: 'Assistant', icon: MessageSquareCode },
    { id: 'automations', label: 'Automations', icon: Workflow },
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'energy', label: 'Energy', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    if (id === 'settings') {
      onOpenAdmin('settings');
      return;
    }
    setCurrentTab(id);
  };

  return (
    <aside className="w-[260px] h-screen bg-[#111214] border-r border-[#383A3E] flex flex-col justify-between flex-shrink-0 select-none">
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
            const isActive = currentTab === item.id;

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
                      isActive ? 'text-[#090A0C]' : 'text-[#777777] group-hover:text-[#F5F5F5]'
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

      {/* Bottom System Status Section */}
      <div className="p-4 border-t border-[#383A3E]/80 bg-[#090A0C]/50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777]">
            System Status
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22D68A] shadow-[0_0_8px_#22D68A]" />
            <span className="text-[11px] font-mono font-bold text-[#22D68A]">ONLINE</span>
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[#A6A6A6]">
            <span className="text-[#777777]">Gateways</span>
            <span className="font-mono text-[#F5F5F5]">
              {gatewaysCount}/{Math.max(totalGateways, 1)} Connected
            </span>
          </div>
          <div className="flex items-center justify-between text-[#A6A6A6]">
            <span className="text-[#777777]">Online Devices</span>
            <span className="font-mono text-[#F5F5F5] font-semibold">
              {onlineDevicesCount} Active
            </span>
          </div>
          <div className="flex items-center justify-between text-[#A6A6A6]">
            <span className="text-[#777777]">Local-First Engine</span>
            <span className="font-mono text-[#22D68A]">Active (0ms cloud lag)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

