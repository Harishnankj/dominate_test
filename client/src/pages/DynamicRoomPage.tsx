import React from 'react';
import {
  Briefcase,
  Power,
  ArrowLeft,
  Settings,
} from 'lucide-react';
import type { Room } from '../types';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { DimmableLightTile } from '../components/devices/DimmableLightTile';
import { SwitchLightTile } from '../components/devices/SwitchLightTile';
import { AcIrTile } from '../components/devices/AcIrTile';
import { ClimateTile, CoverTile } from '../components/devices/ClimateTile';
import { BlindsRelayTile } from '../components/devices/BlindsRelayTile';
import { PresenceSensorTile, ExhaustFanTile, TtlockTile } from '../components/devices/SpecialtyTiles';

interface DynamicRoomPageProps {
  room: Room;
  onBack: () => void;
  onOpenAdmin: () => void;
}

export const DynamicRoomPage: React.FC<DynamicRoomPageProps> = ({ room, onBack, onOpenAdmin }) => {
  const { getDevicesForRoom } = useBootstrap();
  const { callService } = useHA(room.ha_hub_id);

  const devices = getDevicesForRoom(room.id);

  // Quick Action: Turn off all lights in this room
  const handleTurnOffRoomLights = async () => {
    for (const dev of devices) {
      if ((dev.type === 'switch_light' || dev.type === 'dimmable_light') && dev.entity_id) {
        const domain = dev.entity_id.split('.')[0];
        callService(domain, 'turn_off', { entity_id: dev.entity_id }).catch(() => {});
      }
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">{room.name}</h2>
            <p className="text-xs text-cyan-400 font-mono">
              {devices.length} Devices Mapped • {room.is_meeting_room ? 'Conference Suite' : 'Office Zone'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {devices.some((d) => d.type === 'switch_light' || d.type === 'dimmable_light') && (
            <button
              onClick={handleTurnOffRoomLights}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-white/10 flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">All Lights Off</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Tiles Grid */}
      {devices.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-white/10 space-y-3">
          <Briefcase className="w-10 h-10 text-cyan-400 mx-auto opacity-60" />
          <h3 className="text-sm font-bold text-white">No devices mapped in this room yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Devices for this room can be mapped and configured in Admin Studio.
          </p>
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Open Admin Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
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
