import React from 'react';
import { ToggleLeft, ToggleRight, Star, Power, Radio } from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
import { useBootstrap } from '../../context/BootstrapContext';

interface SwitchLightTileProps {
  device: Device;
}

export const SwitchLightTile: React.FC<SwitchLightTileProps> = ({ device }) => {
  const { state: haState, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();
  const { getZ2mState, setZ2mState } = useBootstrap();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json || '{}'); } catch (_) {}
  const z2mName = device.z2m_friendly_name || devConfig.z2m_friendly_name;
  const z2mState = z2mName ? getZ2mState(z2mName) : undefined;

  // Resolve state: HA if available, otherwise direct Zigbee2MQTT
  const effectiveState =
    haState !== 'unavailable'
      ? haState
      : z2mState?.state
      ? z2mState.state.toLowerCase()
      : 'off';
  const isOn = effectiveState === 'on';
  const isDirectZ2m = z2mName && (haState === 'unavailable' || !device.entity_id);

  const handleToggle = async () => {
    // If HA is unavailable or device has no entity_id, control via Z2M directly
    if (z2mName && (haState === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { state: isOn ? 'OFF' : 'ON' });
      return;
    }

    try {
      const domain = device.entity_id ? device.entity_id.split('.')[0] : 'switch';
      await callService(domain, isOn ? 'turn_off' : 'turn_on');
    } catch (err) {
      if (z2mName) {
        await setZ2mState(z2mName, { state: isOn ? 'OFF' : 'ON' });
      }
    }
  };

  return (
    <div
      onClick={handleToggle}
      className={`relative rounded-2xl p-4 transition-all cursor-pointer tile-hover border select-none ${
        isOn
          ? 'glass-panel-glow border-cyan-500/40'
          : 'glass-panel border-white/10 opacity-80 hover:opacity-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isOn
                ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 shadow-glow scale-105'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Power className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold text-white tracking-wide leading-tight">{device.name}</h4>
              {isDirectZ2m && (
                <span title="Controlled directly via Zigbee2MQTT" className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <Radio className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <span className={`text-[10px] font-mono uppercase font-bold tracking-wider mt-0.5 inline-block ${isOn ? 'text-cyan-400' : 'text-slate-500'}`}>
              {isOn ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
          <div className="text-cyan-400">
            {isOn ? (
              <ToggleRight className="w-8 h-8 text-cyan-400 fill-cyan-400/20" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
