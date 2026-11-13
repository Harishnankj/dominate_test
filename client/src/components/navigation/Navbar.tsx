import React, { useState, useEffect } from 'react';
import {
  Building2,
  Wifi,
  WifiOff,
  CloudSun,
  Settings,
  LogOut,
  User,
  KeyRound,
  Layers,
  ChevronDown,
  Radio,
  Sliders,
  Menu,
} from 'lucide-react';
import { useBootstrap } from '../../context/BootstrapContext';
import { useAuth } from '../../context/AuthContext';
import { useHA } from '../../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../../services/api';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedFloorId: string;
  setSelectedFloorId: (floorId: string) => void;
  onOpenAdmin: (tab?: any) => void;
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  selectedFloorId,
  setSelectedFloorId,
  onOpenAdmin,
  onToggleMobileSidebar,
}) => {
  const { data, isLiveSyncConnected, z2mStatus, tuyaStatus } = useBootstrap();
  const { user, logout, isAdmin } = useAuth();
  const { hubs: haHubs } = useHA();

  const enabledHaHubs = (data?.hubs || []).filter((h) => h.enabled);
  const connectedHaCount = enabledHaHubs.filter((h) => haHubs[h.id]?.isConnected).length;
  const isHaConnected = connectedHaCount > 0;
  const isZ2mConnected = Boolean(z2mStatus?.enabled && z2mStatus?.connected);
  const isTuyaConnected = Boolean(tuyaStatus?.enabled && tuyaStatus?.cloud_connected);

  const [weather, setWeather] = useState<{ temp: number; label: string }>({ temp: 28, label: 'HQ' });
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    ApiService.fetchWeather()
      .then((res) => {
        if (res.current?.temperature_2m) {
          setWeather({
            temp: Math.round(res.current.temperature_2m),
            label: res.label || 'Office',
          });
        }
      })
      .catch(() => {});
  }, []);

  const floors = data?.floors || [];
  const buildingName = data?.config?.building_name || 'DOMINATE';

  return (
    <header className="sticky top-0 z-20 w-full bg-[#111214] border-b border-[#383A3E] px-4 md:px-6 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Mobile Menu Button & Building Name */}
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="md:hidden p-2 rounded-lg bg-[#191A1D] border border-[#383A3E] text-[#F5F5F5] hover:bg-[#202226]"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div
            className="flex items-center gap-2 cursor-pointer md:cursor-default"
            onClick={() => setCurrentTab('favorites')}
          >
            <div className="md:hidden w-8 h-8 rounded-lg bg-white text-[#090A0C] flex items-center justify-center font-extrabold text-sm">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm md:text-base tracking-wider text-[#F5F5F5] uppercase">
                  {buildingName}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono tracking-wider font-semibold rounded bg-white/10 text-[#F5F5F5] border border-white/20">
                  LOCAL-FIRST
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: System Status Compact Pills */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Home Assistant Status Pill */}
          <div
            onClick={() => onOpenAdmin('hubs')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#191A1D] border border-[#383A3E] text-[11px] font-mono text-[#A6A6A6] cursor-pointer hover:border-white/40 transition-colors"
            title="Home Assistant Status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHaConnected ? 'bg-[#22D68A] shadow-[0_0_6px_#22D68A]' : 'bg-[#FF5757]'
              }`}
            />
            <span>
              HA: {isHaConnected ? `${connectedHaCount}/${enabledHaHubs.length || 1}` : 'Offline'}
            </span>
          </div>

          {/* Zigbee Status Pill */}
          <div
            onClick={() => onOpenAdmin('hubs')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#191A1D] border border-[#383A3E] text-[11px] font-mono text-[#A6A6A6] cursor-pointer hover:border-white/40 transition-colors"
            title="Zigbee2MQTT Status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isZ2mConnected ? 'bg-[#22D68A] shadow-[0_0_6px_#22D68A]' : 'bg-[#777777]'
              }`}
            />
            <span>Zigbee: {isZ2mConnected ? 'Online' : 'Standby'}</span>
          </div>

          {/* Tuya Status Pill */}
          <div
            onClick={() => onOpenAdmin('hubs')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#191A1D] border border-[#383A3E] text-[11px] font-mono text-[#A6A6A6] cursor-pointer hover:border-white/40 transition-colors"
            title="Tuya Cloud & LAN Status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isTuyaConnected ? 'bg-[#22D68A] shadow-[0_0_6px_#22D68A]' : 'bg-[#777777]'
              }`}
            />
            <span>Tuya: {isTuyaConnected ? 'Online' : 'Standby'}</span>
          </div>
        </div>

        {/* Right Side: Floor Dropdown, Weather, Admin Studio, Profile */}
        <div className="flex items-center gap-2.5">
          {/* Floor Selection Dropdown */}
          {floors.length > 0 && (
            <div className="flex items-center bg-[#191A1D] border border-[#383A3E] rounded-xl px-2.5 py-1 text-xs">
              <Layers className="w-3.5 h-3.5 text-[#777777] mr-1.5" />
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className="bg-transparent text-[#F5F5F5] font-medium text-xs border-0 outline-none cursor-pointer pr-1"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#191A1D] text-[#F5F5F5]">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Weather Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#191A1D] border border-[#383A3E] rounded-xl px-3 py-1.5 text-xs text-[#A6A6A6]">
            <CloudSun className="w-3.5 h-3.5 text-white" />
            <span className="font-mono text-[#F5F5F5] font-semibold">{weather.temp}°C</span>
            <span className="text-[10px] text-[#777777]">({weather.label})</span>
          </div>

          {/* Admin Studio Button */}
          <button
            onClick={() => onOpenAdmin('hubs')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-[#F5F5F5] border border-[#383A3E] hover:border-white/40 text-xs font-medium transition-all shadow-sm"
            title="Open Admin Studio"
          >
            <Sliders className="w-3.5 h-3.5 text-white" />
            <span className="hidden md:inline">Admin Studio</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 md:px-2.5 md:py-1.5 rounded-xl bg-[#191A1D] border border-[#383A3E] hover:border-white/40 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <span className="hidden md:inline text-xs font-semibold text-[#F5F5F5]">
                {user?.name || 'Administrator'}
              </span>
              <ChevronDown className="w-3 h-3 text-[#777777]" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-[#191A1D] border border-[#383A3E] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-[#383A3E]/60">
                  <p className="text-xs font-semibold text-[#F5F5F5]">{user?.name || 'Admin'}</p>
                  <p className="text-[10px] text-[#777777] font-mono">{user?.email || 'admin@dominate.os'}</p>
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAdmin('settings');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#A6A6A6] hover:text-[#F5F5F5] hover:bg-[#202226] rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#777777]" />
                    <span>System Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#FF5757] hover:bg-[#FF5757]/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
