import React, { useState } from 'react';
import { Lightbulb, Star, Zap, SunMedium, Flame, Snowflake, Radio } from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
import { useBootstrap } from '../../context/BootstrapContext';

interface DimmableLightTileProps {
  device: Device;
}

export const DimmableLightTile: React.FC<DimmableLightTileProps> = ({ device }) => {
  const { entity, state, attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();
  const { getZ2mState, setZ2mState } = useBootstrap();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const maxWatts = devConfig.max_wattage || 18;

  const z2mName = device.z2m_friendly_name || devConfig.z2m_friendly_name;
  const z2mState = z2mName ? getZ2mState(z2mName) : undefined;
  const isDirectZ2m = z2mName && (state === 'unavailable' || !device.entity_id);

  const effectiveState =
    state !== 'unavailable'
      ? state
      : z2mState?.state
      ? z2mState.state.toLowerCase()
      : 'off';
  const isOn = effectiveState === 'on';

  const haBrightness = attributes.brightness ? Math.round((attributes.brightness / 255) * 100) : (isOn ? 100 : 0);
  const z2mBrightness = z2mState?.brightness !== undefined ? Math.round((z2mState.brightness / 254) * 100) : (isOn ? 100 : 0);
  const brightness = state !== 'unavailable' ? haBrightness : z2mBrightness;
  const colorTempKelvin = attributes.color_temp_kelvin || (z2mState?.color_temp ? Math.round(1000000 / z2mState.color_temp) : 4000);

  const [localBrightness, setLocalBrightness] = useState<number | null>(null);
  const [localKelvin, setLocalKelvin] = useState<number | null>(null);

  const displayBrightness = localBrightness !== null ? localBrightness : brightness;
  const displayKelvin = localKelvin !== null ? localKelvin : colorTempKelvin;
  const currentWatts = isOn ? Math.round((displayBrightness / 100) * maxWatts * 10) / 10 : 0;

  const handleToggle = async () => {
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { state: isOn ? 'OFF' : 'ON' });
      return;
    }

    try {
      await callService('light', isOn ? 'turn_off' : 'turn_on');
    } catch (err) {
      if (z2mName) {
        await setZ2mState(z2mName, { state: isOn ? 'OFF' : 'ON' });
      }
    }
  };

  const handleBrightnessChange = (val: number) => {
    setLocalBrightness(val);
  };

  const handleBrightnessCommit = async (val: number) => {
    setLocalBrightness(null);
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      if (val === 0) {
        await setZ2mState(z2mName, { state: 'OFF' });
      } else {
        await setZ2mState(z2mName, { state: 'ON', brightness: Math.round((val / 100) * 254) });
      }
      return;
    }

    try {
      if (val === 0) {
        await callService('light', 'turn_off');
      } else {
        await callService('light', 'turn_on', { brightness_pct: val });
      }
    } catch (err) {
      if (z2mName) {
        if (val === 0) {
          await setZ2mState(z2mName, { state: 'OFF' });
        } else {
          await setZ2mState(z2mName, { state: 'ON', brightness: Math.round((val / 100) * 254) });
        }
      }
    }
  };

  const handleKelvinChange = (val: number) => {
    setLocalKelvin(val);
  };

  const handleKelvinCommit = (val: number) => {
    setLocalKelvin(null);
    callService('light', 'turn_on', { color_temp_kelvin: val });
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all tile-hover border ${
      isOn
        ? 'glass-panel-glow border-cyan-500/40'
        : 'glass-panel border-white/10 opacity-80 hover:opacity-100'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              isOn
                ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 shadow-glow scale-105'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Lightbulb className={`w-5 h-5 ${isOn ? 'fill-current' : ''}`} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold text-white tracking-wide leading-tight">{device.name}</h4>
              {isDirectZ2m && (
                <span title="Controlled directly via Zigbee2MQTT" className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <Radio className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-cyan-400' : 'text-slate-500'}`}>
                {isOn ? `${displayBrightness}% ON` : 'OFF'}
              </span>
              {isOn && (
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-emerald-400">
                  <Zap className="w-2.5 h-2.5" /> {currentWatts}W
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => toggleFavorite(device.id)}
          className={`p-1.5 rounded-lg transition-colors ${
            isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Sliders when Light is ON */}
      {isOn && (
        <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in">
          {/* Brightness Slider */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <SunMedium className="w-3.5 h-3.5 text-cyan-400" /> Brightness
              </span>
              <span className="font-mono text-cyan-300 font-bold">{displayBrightness}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={displayBrightness}
              onChange={(e) => handleBrightnessChange(Number(e.target.value))}
              onMouseUp={(e) => handleBrightnessCommit(Number(e.currentTarget.value))}
              onTouchEnd={(e) => handleBrightnessCommit(Number(e.currentTarget.value))}
              className="w-full h-2 rounded-lg bg-slate-800 accent-cyan-400"
            />
          </div>

          {/* Color Temp (Kelvin) Slider */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Temperature
              </span>
              <span className="font-mono text-amber-300 font-bold">{displayKelvin}K</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min={2700}
                max={6500}
                step={50}
                value={displayKelvin}
                onChange={(e) => handleKelvinChange(Number(e.target.value))}
                onMouseUp={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                onTouchEnd={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                className="w-full h-2 rounded-lg bg-gradient-to-r from-amber-500 via-orange-200 to-sky-300 accent-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
