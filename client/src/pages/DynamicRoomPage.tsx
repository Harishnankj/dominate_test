import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Power,
  ArrowLeft,
  Settings,
  Video,
  Maximize2,
} from 'lucide-react';
import type { Room, Camera } from '../types';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { Go2rtcVideo } from '../components/cctv/Go2rtcVideo';
import { getDeviceRoleCategory } from '../utils/deviceCategory';
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

type AdminTab = 'hubs' | 'floors' | 'cameras' | 'ttlock' | 'ir' | 'automations' | 'quick_controls' | 'theme' | 'backup' | 'settings';

interface DynamicRoomPageProps {
  room: Room;
  onBack: () => void;
  onOpenAdmin: (tab?: AdminTab) => void;
  onOpenFullscreenCamera?: (camera: Camera) => void;
}

export const DynamicRoomPage: React.FC<DynamicRoomPageProps> = ({
  room,
  onBack,
  onOpenAdmin,
  onOpenFullscreenCamera,
}) => {
  const { getDevicesForRoom, setZ2mState, getCamerasForRoom } = useBootstrap();
  const { callService } = useHA(room.ha_hub_id);

  const devices = getDevicesForRoom(room.id);

  // Cameras configured for this room in Admin Studio
  const roomCameras = useMemo(() => {
    return getCamerasForRoom(room.id);
  }, [getCamerasForRoom, room.id]);

  const [activeCamIndex, setActiveCamIndex] = useState(0);
  const activeCamera = roomCameras[activeCamIndex] || roomCameras[0] || null;

  // Quick Action: Turn off all lights in this room
  const handleTurnOffRoomLights = async () => {
    for (const dev of devices) {
      if (getDeviceRoleCategory(dev) === 'light') {
        let devConfig: any = {};
        try {
          devConfig = JSON.parse(dev.config_json);
        } catch (_) {}
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

  // Clean Camera Card
  const renderCleanCameraCard = () => {
    if (!activeCamera) return null;

    return (
      <div className="bg-[#191A1D] rounded-2xl border border-[#383A3E] overflow-hidden shadow-card flex flex-col">
        {/* Clean Header Bar */}
        <div className="px-4 py-2.5 border-b border-[#383A3E]/80 flex items-center justify-between bg-[#141518]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center">
              <Video className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">{activeCamera.name}</span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-camera switcher if multiple cameras are mapped to this room in Admin Studio */}
            {roomCameras.length > 1 && (
              <div className="flex items-center bg-[#111214] p-0.5 rounded-lg border border-[#383A3E]">
                {roomCameras.map((cam, idx) => (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCamIndex(idx)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                      activeCamIndex === idx
                        ? 'bg-white text-black shadow-xs'
                        : 'text-[#A6A6A6] hover:text-white'
                    }`}
                  >
                    {cam.name}
                  </button>
                ))}
              </div>
            )}

            {/* Dedicated Fullscreen Button */}
            {onOpenFullscreenCamera && (
              <button
                onClick={() => onOpenFullscreenCamera(activeCamera)}
                className="p-1.5 rounded-lg bg-[#111214] hover:bg-white hover:text-black text-[#A6A6A6] border border-[#383A3E] transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Zero-Latency VideoRTC Container */}
        <div className="relative w-full aspect-video bg-black overflow-hidden">
          <Go2rtcVideo
            camera={activeCamera}
            onFullscreen={() => onOpenFullscreenCamera?.(activeCamera)}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  };

  // Render device tile list
  const renderDeviceTiles = (gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3') => {
    if (devices.length === 0) {
      return (
        <div className="bg-[#191A1D] rounded-2xl p-10 text-center border border-dashed border-[#383A3E] space-y-3">
          <Briefcase className="w-10 h-10 text-[#777777] mx-auto" />
          <h3 className="text-sm font-bold text-[#F5F5F5]">No devices mapped in this room yet</h3>
          <p className="text-xs text-[#A6A6A6] max-w-sm mx-auto">
            Devices for this room can be mapped and configured in Admin Studio.
          </p>
          <button
            onClick={() => onOpenAdmin('floors')}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Open Admin Studio
          </button>
        </div>
      );
    }

    return (
      <div className={`grid gap-4 ${gridClass}`}>
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
    );
  };

  const hasRoomCamera = Boolean(activeCamera);
  const customWallpaper = room.wallpaper_url?.trim() || '';

  return (
    <div className="relative space-y-6 pb-24 animate-in fade-in">
      {/* Custom Room Background Wallpaper (rendered only when photo is set in Admin Studio) */}
      {customWallpaper && (
        <div className="fixed inset-0 md:left-[260px] pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 opacity-35 transition-all duration-500"
            style={{ backgroundImage: `url("${customWallpaper}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#090A0C]/60 via-[#090A0C]/75 to-[#090A0C]/95" />
        </div>
      )}

      <div className="relative z-10 space-y-6">
        {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-[#A6A6A6] hover:text-white border border-[#383A3E] transition-colors"
            title="Back to Rooms"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#F5F5F5] tracking-wide">{room.name}</h2>
              {hasRoomCamera && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/70 text-cyan-400 border border-cyan-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CCTV Live
                </span>
              )}
            </div>
            <p className="text-xs text-[#A6A6A6] font-mono mt-0.5">
              {devices.length} Devices Mapped • {room.is_meeting_room ? 'Conference Suite' : 'Office Zone'}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Action: All Lights Off */}
          {devices.some((d) => getDeviceRoleCategory(d) === 'light') && (
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

      {/* Main Content Area: Side-by-Side when camera is mapped */}
      {hasRoomCamera ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 cols): Live Clean Camera Card */}
          <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-20 space-y-3">
            {renderCleanCameraCard()}
          </div>

          {/* Right Column (7 cols): Room Devices */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#383A3E]/60">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#A6A6A6]">
                Room Controls & Devices ({devices.length})
              </h3>
            </div>
            {renderDeviceTiles('grid-cols-1 sm:grid-cols-2')}
          </div>
        </div>
      ) : (
        /* When no camera is assigned to this room, devices take full width cleanly */
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#383A3E]/60">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#A6A6A6]">
              Room Controls & Devices ({devices.length})
            </h3>
          </div>
          {renderDeviceTiles('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}
        </div>
      )}
      </div>
    </div>
  );
};
