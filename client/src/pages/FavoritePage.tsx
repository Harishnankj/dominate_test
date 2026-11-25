import React, { useState, useMemo } from 'react';
import {
  Star,
  Layers,
  Lightbulb,
  Power,
  Lock,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../services/api';
import { DimmableLightTile } from '../components/devices/DimmableLightTile';
import { SwitchLightTile } from '../components/devices/SwitchLightTile';
import { AcIrTile } from '../components/devices/AcIrTile';
import { ClimateTile, CoverTile } from '../components/devices/ClimateTile';
import { BlindsRelayTile } from '../components/devices/BlindsRelayTile';
import {
  PresenceSensorTile,
  ExhaustFanTile,
  TtlockTile,
  EnvironmentalSensorTile,
  EnergyMeterTile,
  SmartKnobTile,
} from '../components/devices/SpecialtyTiles';
import type { Room, Device } from '../types';
import { getDeviceRoleCategory } from '../utils/deviceCategory';

interface FavoritePageProps {
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: (tab?: any) => void;
  onNavigateToRooms?: () => void;
}

export const FavoritePage: React.FC<FavoritePageProps> = ({
  onSelectRoom,
  onOpenAdmin,
  onNavigateToRooms,
}) => {
  const { data, setZ2mState, setTuyaState } = useBootstrap();
  const { favorites, isFavorite } = useAuth();
  const { callService } = useHA();

  const [actionLoading, setActionLoading] = useState(false);

  const allDevices = data?.devices || [];
  const allRooms = data?.rooms || [];

  // Pinned favorites list
  const favoriteDevices = useMemo(() => {
    return allDevices.filter((d) => isFavorite(d.id));
  }, [allDevices, favorites]);

  // Bulk action handlers
  const handleTurnOnAllFavoriteLights = async () => {
    setActionLoading(true);
    try {
      for (const dev of favoriteDevices) {
        if (getDeviceRoleCategory(dev) === 'light') {
          let cfg: any = {};
          try { cfg = JSON.parse(dev.config_json); } catch (_) {}
          const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
          const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
          if (zName) setZ2mState(zName, { state: 'ON' }).catch(() => {});
          if (tuyaId) setTuyaState(tuyaId, { switch_1: true, state: 'ON' }).catch(() => {});
          if (dev.entity_id) {
            const domain = dev.entity_id.split('.')[0] || 'light';
            callService(domain, 'turn_on', { entity_id: dev.entity_id }).catch(() => {});
          }
        }
      }
    } finally {
      setTimeout(() => setActionLoading(false), 500);
    }
  };

  const handleTurnOffAllFavoriteLights = async () => {
    setActionLoading(true);
    try {
      for (const dev of favoriteDevices) {
        if (getDeviceRoleCategory(dev) === 'light') {
          let cfg: any = {};
          try { cfg = JSON.parse(dev.config_json); } catch (_) {}
          const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
          const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
          if (zName) setZ2mState(zName, { state: 'OFF' }).catch(() => {});
          if (tuyaId) setTuyaState(tuyaId, { switch_1: false, state: 'OFF' }).catch(() => {});
          if (dev.entity_id) {
            const domain = dev.entity_id.split('.')[0] || 'light';
            callService(domain, 'turn_off', { entity_id: dev.entity_id }).catch(() => {});
          }
        }
      }
    } finally {
      setTimeout(() => setActionLoading(false), 500);
    }
  };

  const handleLockAllFavoriteDoors = async () => {
    setActionLoading(true);
    try {
      await ApiService.lockAllDoors();
    } catch (_) {}
    setTimeout(() => setActionLoading(false), 500);
  };

  // Filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');

  // Filtered devices to display
  const displayedDevices = useMemo(() => {
    return favoriteDevices.filter((dev) => {
      // Room filter
      if (selectedRoomFilter !== 'all' && dev.room_id !== selectedRoomFilter) {
        return false;
      }

      // Category filter
      const role = getDeviceRoleCategory(dev);
      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'lights') return role === 'light';
      if (selectedCategory === 'climate') return role === 'ac' || role === 'fan';
      if (selectedCategory === 'covers') return role === 'curtain';
      if (selectedCategory === 'locks') return role === 'lock';
      if (selectedCategory === 'plugs') return role === 'plug' || role === 'meter';
      if (selectedCategory === 'sensors') return role === 'sensor';
      return true;
    });
  }, [favoriteDevices, selectedCategory, selectedRoomFilter]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: favoriteDevices.length,
      lights: 0,
      climate: 0,
      covers: 0,
      plugs: 0,
      locks: 0,
      sensors: 0,
    };

    favoriteDevices.forEach((dev) => {
      const role = getDeviceRoleCategory(dev);
      if (role === 'light') counts.lights++;
      else if (role === 'ac' || role === 'fan') counts.climate++;
      else if (role === 'curtain') counts.covers++;
      else if (role === 'lock') counts.locks++;
      else if (role === 'sensor') counts.sensors++;
      else counts.plugs++;
    });

    return counts;
  }, [favoriteDevices]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in select-none">
      {/* 1. SIMPLE CLEAN HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#191A1D] border border-[#383A3E] shadow-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#F0B94D]/10 border border-[#F0B94D]/30 text-[#F0B94D] flex items-center justify-center">
            <Star className="w-5 h-5 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-wider uppercase text-white">
              Favorites
            </h1>
            {favoriteDevices.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#202226] border border-[#383A3E] text-xs font-mono font-semibold text-[#F0B94D]">
                {favoriteDevices.length} Starred
              </span>
            )}
          </div>
        </div>

        {/* Right side: Bulk Action Buttons & Room Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTurnOnAllFavoriteLights}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-xl bg-[#202226] hover:bg-[#282B30] text-[#F5F5F5] border border-[#383A3E] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#F0B94D]" />
            <span>Lights On</span>
          </button>
          <button
            onClick={handleTurnOffAllFavoriteLights}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-xl bg-[#202226] hover:bg-[#282B30] text-[#F5F5F5] border border-[#383A3E] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Power className="w-3.5 h-3.5 text-red-400" />
            <span>Lights Off</span>
          </button>
          <button
            onClick={handleLockAllFavoriteDoors}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-xl bg-[#202226] hover:bg-[#282B30] text-[#F5F5F5] border border-[#383A3E] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Lock All</span>
          </button>

          {favoriteDevices.length > 0 && allRooms.length > 0 && (
            <div className="flex items-center gap-1.5 ml-1 border-l border-[#383A3E] pl-2.5">
              <span className="text-[11px] text-[#777777] uppercase font-mono">Room:</span>
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="bg-[#202226] border border-[#383A3E] text-xs text-[#F5F5F5] rounded-xl px-2.5 py-1.5 outline-hidden focus:border-white/40 cursor-pointer"
              >
                <option value="all">All Rooms ({allRooms.length})</option>
                {allRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. CATEGORY PILLS (Only shown if user has favorites) */}
      {favoriteDevices.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All', count: categoryCounts.all },
            { id: 'lights', label: 'Lights', count: categoryCounts.lights },
            { id: 'climate', label: 'Climate', count: categoryCounts.climate },
            { id: 'covers', label: 'Curtains', count: categoryCounts.covers },
            { id: 'plugs', label: 'Plugs', count: categoryCounts.plugs },
            { id: 'locks', label: 'Locks', count: categoryCounts.locks },
            { id: 'sensors', label: 'Sensors', count: categoryCounts.sensors },
          ]
            .filter((cat) => cat.id === 'all' || cat.count > 0)
            .map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-[#090A0C] font-semibold shadow-xs'
                    : 'bg-[#191A1D] text-[#A6A6A6] hover:text-white border border-[#383A3E]'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded-full ${
                    selectedCategory === cat.id
                      ? 'bg-[#090A0C]/10 text-[#090A0C]'
                      : 'bg-white/10 text-[#A6A6A6]'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* 3. PINNED FAVORITE DEVICES GRID */}
      {displayedDevices.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedDevices.map((device) => {
              switch (device.type) {
                case 'dimmable_light':
                  return <DimmableLightTile key={device.id} device={device} />;
                case 'switch_light':
                  return <SwitchLightTile key={device.id} device={device} />;
                case 'ac_ir':
                  return <AcIrTile key={device.id} device={device} />;
                case 'climate':
                  return <ClimateTile key={device.id} device={device} />;
                case 'blinds_relay':
                  return <BlindsRelayTile key={device.id} device={device} />;
                case 'cover':
                  return <CoverTile key={device.id} device={device} />;
                case 'presence_sensor':
                  return <PresenceSensorTile key={device.id} device={device} />;
                case 'exhaust_fan':
                  return <ExhaustFanTile key={device.id} device={device} />;
                case 'ttlock':
                  return <TtlockTile key={device.id} device={device} />;
                case 'environmental_sensor':
                  return <EnvironmentalSensorTile key={device.id} device={device} />;
                case 'energy_meter':
                  return <EnergyMeterTile key={device.id} device={device} />;
                case 'smart_knob':
                  return <SmartKnobTile key={device.id} device={device} />;
                default:
                  return <SwitchLightTile key={device.id} device={device} />;
              }
            })}
          </div>
        </div>
      ) : (
        /* Clean minimal empty state */
        <div className="p-16 rounded-3xl bg-[#191A1D] border border-[#383A3E] text-center space-y-3 flex flex-col items-center justify-center shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-[#F0B94D]/10 border border-[#F0B94D]/25 text-[#F0B94D] flex items-center justify-center">
            <Star className="w-7 h-7 fill-current" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-bold text-white">No Favorite Devices</h3>
            <p className="text-xs text-[#777777] leading-relaxed">
              Star devices in Admin Studio or from room controls to have them appear here for quick access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
