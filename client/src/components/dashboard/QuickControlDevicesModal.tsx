import React from 'react';
import { X, Sliders } from 'lucide-react';
import type { QuickControlConfig, Device } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { DimmableLightTile } from '../devices/DimmableLightTile';
import { SwitchLightTile } from '../devices/SwitchLightTile';
import { AcIrTile } from '../devices/AcIrTile';
import { ClimateTile, CoverTile } from '../devices/ClimateTile';
import { BlindsRelayTile } from '../devices/BlindsRelayTile';
import {
  PresenceSensorTile,
  ExhaustFanTile,
  TtlockTile,
  EnvironmentalSensorTile,
  EnergyMeterTile,
  SmartKnobTile,
} from '../devices/SpecialtyTiles';
import { QUICK_CONTROL_ICON_MAP } from './QuickControlsEditModal';
import { getDevicesForQuickControl } from '../../utils/deviceCategory';

interface QuickControlDevicesModalProps {
  control: QuickControlConfig | null;
  onClose: () => void;
  onEdit?: (controlId: string) => void;
}

export const QuickControlDevicesModal: React.FC<QuickControlDevicesModalProps> = ({
  control,
  onClose,
  onEdit,
}) => {
  const { data } = useBootstrap();
  if (!control) return null;

  const allDevices = data?.devices || [];
  const allRooms = data?.rooms || [];
  const devices = getDevicesForQuickControl(control, allDevices);
  const Icon = QUICK_CONTROL_ICON_MAP[control.icon] || Sliders;

  const renderTile = (device: Device) => {
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
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#191A1D] border border-[#383A3E] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#383A3E] flex items-center justify-between bg-[#111214]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#191A1D] border border-[#383A3E] flex items-center justify-center text-white">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F5F5F5]">{control.label}</h3>
              <p className="text-xs text-[#A6A6A6] mt-0.5">
                {devices.length} {devices.length === 1 ? 'device' : 'devices'} assigned
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(control.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#202226] hover:bg-[#282B30] text-xs font-semibold text-white border border-[#383A3E] flex items-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" /> Edit Assignment
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#A6A6A6] hover:text-white hover:bg-[#202226] border border-transparent hover:border-[#383A3E] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {devices.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#111214]/60 border border-dashed border-[#383A3E] text-center space-y-3">
              <p className="text-sm font-bold text-white">No devices assigned to "{control.label}" yet</p>
              <p className="text-xs text-[#A6A6A6] max-w-md mx-auto">
                Devices and Quick Controls can be mapped and customized from Admin Studio.
              </p>
              {onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit(control.id);
                  }}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5" /> Assign Devices Now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((dev) => {
                const roomName = allRooms.find((r) => r.id === dev.room_id)?.name;
                return (
                  <div key={dev.id} className="space-y-1.5">
                    {roomName && (
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#777777] px-1">
                        {roomName}
                      </div>
                    )}
                    {renderTile(dev)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
