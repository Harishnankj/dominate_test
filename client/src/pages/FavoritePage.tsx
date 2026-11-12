import React, { useState } from 'react';
import { Star, Wand2, Power, Briefcase, Sparkles, Sun, Moon, Lock } from 'lucide-react';
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

interface FavoritePageProps {
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: () => void;
  onNavigateToRooms?: () => void;
}

export const FavoritePage: React.FC<FavoritePageProps> = ({ onSelectRoom, onOpenAdmin, onNavigateToRooms }) => {
  const { data, setZ2mState, setTuyaState } = useBootstrap();
  const { favorites, isFavorite } = useAuth();
  const { callService } = useHA();

  const allDevices = data?.devices || [];

  // Show only user-pinned favorites
  const displayDevices = allDevices.filter((d) => isFavorite(d.id));

  // Quick Global Actions
  const handleTurnOffAll = async () => {
    for (const dev of allDevices) {
      if (dev.type === 'switch_light' || dev.type === 'dimmable_light') {
        let devConfig: any = {};
        try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
        const z2mName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;
        const tuyaId = dev.tuya_device_id || devConfig.tuya_device_id;

        if (z2mName) {
          setZ2mState(z2mName, { state: 'OFF' }).catch(() => {});
        }
        if (tuyaId) {
          setTuyaState(tuyaId, { switch_1: false, state: 'OFF' }).catch(() => {});
        }
        if (dev.entity_id) {
          const domain = dev.entity_id.split('.')[0];
          callService(domain, 'turn_off', { entity_id: dev.entity_id }).catch(() => {});
        }
      }
    }
  };

  const handleMorningRoutine = async () => {
    for (const dev of allDevices) {
      if (dev.type === 'dimmable_light') {
        let devConfig: any = {};
        try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
        const z2mName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;

        if (z2mName) {
          setZ2mState(z2mName, { state: 'ON', brightness: 200 }).catch(() => {});
        }
        if (dev.entity_id) {
          callService('light', 'turn_on', { entity_id: dev.entity_id, brightness_pct: 80, color_temp_kelvin: 4000 }).catch(() => {});
        }
      }
    }
  };

  const [lockingAll, setLockingAll] = useState(false);
  const [lockAllMsg, setLockAllMsg] = useState<string | null>(null);

  const handleLockAllDoors = async () => {
    setLockingAll(true);
    setLockAllMsg(null);
    try {
      const res = await ApiService.lockAllDoors();
      if (res.ok) {
        setLockAllMsg(`Locked ${res.locked}/${res.total} doors!`);
        setTimeout(() => setLockAllMsg(null), 4000);
      } else {
        alert('Could not complete Lock All Doors.');
      }
    } catch (e: any) {
      alert(`Lock All error: ${e.message}`);
    } finally {
      setLockingAll(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Quick Routine Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Favorites Dashboard
          </h2>
          <p className="text-xs text-slate-400">Quick controls & pinned favorite devices</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLockAllDoors}
            disabled={lockingAll}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-glow transition-all"
            title="Lock all connected smart locks across the entire building"
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            {lockingAll ? 'Locking All...' : lockAllMsg || 'Lock All Doors'}
          </button>
          <button
            onClick={handleMorningRoutine}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-amber-300 border border-white/10 flex items-center gap-1.5"
          >
            <Sun className="w-3.5 h-3.5" /> Good Morning
          </button>
          <button
            onClick={handleTurnOffAll}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-rose-300 border border-white/10 flex items-center gap-1.5"
          >
            <Power className="w-3.5 h-3.5" /> All Lights Off
          </button>
        </div>
      </div>

      {/* Pinned Device Tiles */}
      {displayDevices.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-white/10 space-y-4">
          <Star className="w-10 h-10 text-amber-400 mx-auto opacity-50" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No favorite devices pinned yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your Zigbee and Wi-Fi devices are connected in your rooms. Click below to view your rooms and click the star ⭐ icon on any device to pin it to your quick dashboard.
            </p>
          </div>
          {onNavigateToRooms && (
            <button
              onClick={onNavigateToRooms}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-glow transition-all inline-flex items-center gap-2 active:scale-95"
            >
              <Briefcase className="w-4 h-4" /> Browse Rooms & Devices
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayDevices.map((device) => {
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
      )}
    </div>
  );
};
