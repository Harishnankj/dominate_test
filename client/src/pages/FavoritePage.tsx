import React from 'react';
import { Star, Wand2, Power, Briefcase, Sparkles, Sun, Moon } from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { DimmableLightTile } from '../components/devices/DimmableLightTile';
import { SwitchLightTile } from '../components/devices/SwitchLightTile';
import { AcIrTile } from '../components/devices/AcIrTile';
import { ClimateTile, CoverTile } from '../components/devices/ClimateTile';
import { BlindsRelayTile } from '../components/devices/BlindsRelayTile';
import { PresenceSensorTile, ExhaustFanTile, TtlockTile } from '../components/devices/SpecialtyTiles';

interface FavoritePageProps {
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: () => void;
}

export const FavoritePage: React.FC<FavoritePageProps> = ({ onSelectRoom, onOpenAdmin }) => {
  const { data } = useBootstrap();
  const { favorites, isFavorite } = useAuth();
  const { callService } = useHA();

  const allDevices = data?.devices || [];

  // Pinned favorites or devices marked for default dashboard
  const displayDevices = allDevices.filter(
    (d) => isFavorite(d.id) || d.show_on_default_dashboard === 1
  );

  // Quick Global Actions
  const handleTurnOffAll = () => {
    for (const dev of allDevices) {
      if ((dev.type === 'switch_light' || dev.type === 'dimmable_light') && dev.entity_id) {
        const domain = dev.entity_id.split('.')[0];
        callService(domain, 'turn_off', { entity_id: dev.entity_id }).catch(() => {});
      }
    }
  };

  const handleMorningRoutine = () => {
    for (const dev of allDevices) {
      if (dev.type === 'dimmable_light' && dev.entity_id) {
        callService('light', 'turn_on', { entity_id: dev.entity_id, brightness_pct: 80, color_temp_kelvin: 4000 }).catch(() => {});
      }
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Quick Routine Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Executive Dashboard
          </h2>
          <p className="text-xs text-slate-400">Quick controls & pinned office devices</p>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-white/10 space-y-3">
          <Star className="w-10 h-10 text-amber-400 mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-white">No favorite devices pinned yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click the star icon on any light, AC, blinds, or camera tile to pin it to your quick dashboard.
          </p>
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
              default:
                return <SwitchLightTile key={device.id} device={device} />;
            }
          })}
        </div>
      )}
    </div>
  );
};
