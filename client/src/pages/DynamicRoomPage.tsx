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
import {
  PresenceSensorTile,
  ExhaustFanTile,
  TtlockTile,
  EnvironmentalSensorTile,
  EnergyMeterTile,
  SmartKnobTile,
} from '../components/devices/SpecialtyTiles';

interface DynamicRoomPageProps {
  room: Room;
  onBack: () => void;
  onOpenAdmin: () => void;
}

export const DynamicRoomPage: React.FC<DynamicRoomPageProps> = ({ room, onBack, onOpenAdmin }) => {
  const { getDevicesForRoom, setZ2mState } = useBootstrap();
  const { callService } = useHA(room.ha_hub_id);

  const devices = getDevicesForRoom(room.id);

  // Quick Action: Turn off all lights in this room
  const handleTurnOffRoomLights = async () => {
    for (const dev of devices) {
      if (dev.type === 'switch_light' || dev.type === 'dimmable_light') {
        let devConfig: any = {};
        try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
        const z2mName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;

        if (dev.entity_id) {
          const domain = dev.entity_id.split('.')[0];
          callService(domain, 'turn_off', { entity_id: dev.entity_id }).catch(() => {});
        } else if (z2mName) {
          setZ2mState(z2mName, { state: 'OFF' }).catch(() => {});
        }
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
            className="p-2 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-[#A6A6A6] hover:text-white border border-[#383A3E] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-[#F5F5F5] tracking-wide">{room.name}</h2>
            <p className="text-xs text-[#A6A6A6] font-mono mt-0.5">
              {devices.length} Devices Mapped • {room.is_meeting_room ? 'Conference Suite' : 'Office Zone'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {devices.some((d) => d.type === 'switch_light' || d.type === 'dimmable_light') && (
            <button
              onClick={handleTurnOffRoomLights}
              className="px-3 py-1.5 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-xs font-semibold text-[#F5F5F5] border border-[#383A3E] hover:border-white/30 flex items-center gap-1.5 transition-colors"
            >
              <Power className="w-3.5 h-3.5 text-[#FF5757]" />
              <span className="hidden sm:inline">All Lights Off</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Tiles Grid */}
      {devices.length === 0 ? (
        <div className="bg-[#191A1D] rounded-2xl p-10 text-center border border-dashed border-[#383A3E] space-y-3">
          <Briefcase className="w-10 h-10 text-[#777777] mx-auto" />
          <h3 className="text-sm font-bold text-[#F5F5F5]">No devices mapped in this room yet</h3>
          <p className="text-xs text-[#A6A6A6] max-w-sm mx-auto">
            Devices for this room can be mapped and configured in Admin Studio.
          </p>
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Open Admin Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            if (device.type === 'dimmable_light') {
              return <DimmableLightTile key={device.id} device={device} />;
            }
            if (device.type === 'switch_light') {
              return <SwitchLightTile key={device.id} device={device} />;
            }
            if (device.type === 'ac_ir') {
              return <AcIrTile key={device.id} device={device} />;
            }
            if (device.type === 'climate') {
              return <ClimateTile key={device.id} device={device} />;
            }
            if (device.type === 'cover') {
              return <CoverTile key={device.id} device={device} />;
            }
            if (device.type === 'blinds_relay') {
              return <BlindsRelayTile key={device.id} device={device} />;
            }
            if (device.type === 'presence_sensor') {
              return <PresenceSensorTile key={device.id} device={device} />;
            }
            if (device.type === 'exhaust_fan') {
              return <ExhaustFanTile key={device.id} device={device} />;
            }
            if (device.type === 'ttlock') {
              return <TtlockTile key={device.id} device={device} />;
            }
            if (device.type === 'environmental_sensor') {
              return <EnvironmentalSensorTile key={device.id} device={device} />;
            }
            if (device.type === 'energy_meter') {
              return <EnergyMeterTile key={device.id} device={device} />;
            }
            if (device.type === 'smart_knob') {
              return <SmartKnobTile key={device.id} device={device} />;
            }
            return <SwitchLightTile key={device.id} device={device} />;
          })}
        </div>
      )}
    </div>
  );
};
