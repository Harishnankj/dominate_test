import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Wifi,
  WifiOff,
  CloudSun,
  Settings,
  LogOut,
  User,
  KeyRound,
  Layers,
  ChevronDown,
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
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  selectedFloorId,
  setSelectedFloorId,
  onOpenAdmin,
}) => {
  const { data, isLiveSyncConnected } = useBootstrap();
  const { user, logout, isAdmin } = useAuth();
  const { isConnected: isHaConnected } = useHA();

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
  const buildingName = data?.config?.building_name || 'DOMINATEE OS';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Building Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab('favorites')}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 p-[1px] shadow-glow">
            <div className="w-full h-full bg-[#090d16] rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
            {isLiveSyncConnected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#090d16] animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-300">
                {buildingName}
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono tracking-widest font-semibold rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
                LOCAL-FIRST
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-mono text-[11px]">
                {isHaConnected ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> HA Active
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> HA Syncing
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Floor Quick Selector */}
        {floors.length > 0 && (
          <div className="hidden md:flex items-center bg-slate-900/80 border border-white/10 rounded-xl px-2 py-1">
            <Layers className="w-4 h-4 text-cyan-400 mr-2" />
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer pr-2"
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id} className="bg-slate-900 text-white">
                  {floor.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right Status Badges & Controls */}
        <div className="flex items-center gap-2">
          {/* Weather pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-white/10 text-xs font-mono text-slate-300">
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>{weather.temp}°C</span>
            <span className="text-slate-500 text-[10px]">({weather.label})</span>
          </div>

          {/* Admin Studio Button */}
          <button
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              currentTab === 'admin'
                ? 'bg-gradient-to-r from-cyan-500 to-brand-600 text-white shadow-glow'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Admin Studio</span>
          </button>

          {/* User Account / Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl glass-panel p-2 shadow-2xl z-50 border border-white/10 animate-in fade-in">
                {user ? (
                  <>
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[10px] font-mono text-cyan-400 truncate capitalize">{user.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAdmin();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 rounded-lg flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-cyan-400" />
                      Settings & Integrations
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAdmin();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-cyan-400 hover:bg-white/10 rounded-lg flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5" />
                    Sign In / Setup
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
