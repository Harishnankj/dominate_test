import React, { useState } from 'react';
import {
  Lightbulb,
  Star,
  Zap,
  SunMedium,
  Flame,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Signal,
  Sliders,
} from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
import { useBootstrap } from '../../context/BootstrapContext';
import { LightDetailModal } from './LightDetailModal';
import { CustomizeControlsModal } from './CustomizeControlsModal';
import { DEFAULT_ENABLED_LIGHT_CONTROLS } from './deviceControlConfigs';

interface DimmableLightTileProps {
  device: Device;
}

const CCT_QUICK_PRESETS = [
  { label: 'Candle', kelvin: 2222, icon: '🕯️' },
  { label: 'Warm', kelvin: 2700, icon: '🛋️' },
  { label: 'Neutral', kelvin: 4000, icon: '📖' },
  { label: 'Cool', kelvin: 6250, icon: '❄️' },
];

const BRIGHTNESS_STEPS = [25, 50, 75, 100];

const MINI_COLOR_SWATCHES = [
  { name: 'Warm Amber', hex: '#FFA726' },
  { name: 'Sunset', hex: '#FF7043' },
  { name: 'Cyan', hex: '#26C6DA' },
  { name: 'Emerald', hex: '#26A69A' },
  { name: 'Purple', hex: '#AB47BC' },
  { name: 'White', hex: '#FFFFFF' },
];

export const DimmableLightTile: React.FC<DimmableLightTileProps> = ({ device }) => {
  const { state, attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite, user } = useAuth();
  const { getZ2mState, setZ2mState, getZ2mDevice } = useBootstrap();

  const isAdmin = user?.role === 'admin';

  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  let devConfig: any = {};
  try {
    devConfig = JSON.parse(device.config_json || '{}');
  } catch (_) {}
  const maxWatts = devConfig.max_wattage || 18;

  // Customizable Controls: only controls added via Admin Studio or Customize Modal are shown
  const enabledControls: string[] = Array.isArray(devConfig.enabled_controls)
    ? devConfig.enabled_controls
    : DEFAULT_ENABLED_LIGHT_CONTROLS;
  const hasControl = (id: string) => enabledControls.includes(id);

  const z2mName = device.z2m_friendly_name || devConfig.z2m_friendly_name;
  const z2mState = z2mName ? getZ2mState(z2mName) : undefined;
  const z2mDev = z2mName ? getZ2mDevice(z2mName) : undefined;
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
  const linkQuality = z2mState?.linkquality || z2mDev?.linkquality;

  const handleToggle = async () => {
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { state: isOn ? 'OFF' : 'ON' });
      return;
    }

    try {
      await callService('light', isOn ? 'turn_off' : 'turn_on');
    } catch {
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
    const z2mBrightnessVal = Math.round((val / 100) * 254);

    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      if (val === 0) {
        await setZ2mState(z2mName, { state: 'OFF' });
      } else {
        await setZ2mState(z2mName, { state: 'ON', brightness: z2mBrightnessVal });
      }
      return;
    }

    try {
      if (val === 0) {
        await callService('light', 'turn_off');
      } else {
        await callService('light', 'turn_on', { brightness_pct: val });
      }
    } catch {
      if (z2mName) {
        if (val === 0) {
          await setZ2mState(z2mName, { state: 'OFF' });
        } else {
          await setZ2mState(z2mName, { state: 'ON', brightness: z2mBrightnessVal });
        }
      }
    }
  };

  const handleKelvinChange = (val: number) => {
    setLocalKelvin(val);
  };

  const handleKelvinCommit = async (val: number) => {
    setLocalKelvin(null);
    const mireds = Math.max(160, Math.min(450, Math.round(1000000 / val)));

    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { color_temp: mireds });
      return;
    }

    try {
      await callService('light', 'turn_on', { color_temp_kelvin: val });
    } catch {
      if (z2mName) {
        await setZ2mState(z2mName, { color_temp: mireds });
      }
    }
  };

  const handleEffect = async (effectName: string) => {
    setActiveEffect(effectName);
    if (z2mName) {
      await setZ2mState(z2mName, { effect: effectName });
    } else {
      callService('light', 'turn_on', { effect: effectName }).catch(() => {});
    }
    setTimeout(() => setActiveEffect(null), 2500);
  };

  const handleColorHex = async (hex: string) => {
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { color: { hex } });
      return;
    }

    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    try {
      await callService('light', 'turn_on', { rgb_color: [r, g, b] });
    } catch {
      if (z2mName) {
        await setZ2mState(z2mName, { color: { hex } });
      }
    }
  };

  const hasAnyVisibleSliders = isOn && (hasControl('brightness') || hasControl('color_temp') || hasControl('cct_presets') || hasControl('brightness_presets') || hasControl('effects') || hasControl('color_picker'));

  return (
    <>
      <div
        className={`relative rounded-2xl p-4 transition-all tile-hover border ${
          isOn
            ? 'glass-panel-glow border-cyan-500/40'
            : 'glass-panel border-white/10 opacity-80 hover:opacity-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              title={isOn ? 'Turn Light OFF' : 'Turn Light ON'}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                isOn
                  ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 shadow-glow scale-105'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Lightbulb className={`w-5 h-5 ${isOn ? 'fill-current' : ''}`} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-sm font-semibold text-white tracking-wide leading-tight">{device.name}</h4>
                {isDirectZ2m && (
                  <span title="Controlled directly via Zigbee2MQTT" className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <Radio className="w-2.5 h-2.5" />
                  </span>
                )}
                {hasControl('signal_lqi') && linkQuality !== undefined && (
                  <span title={`Link Quality: ${linkQuality} / 255 LQI`} className="text-[10px] text-cyan-400/80 flex items-center gap-0.5 font-mono">
                    <Signal className="w-2.5 h-2.5" /> {linkQuality}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {isOn ? `${displayBrightness}% ON` : 'OFF'}
                </span>
                {hasControl('power_wattage') && isOn && (
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-emerald-400">
                    <Zap className="w-2.5 h-2.5" /> {currentWatts}W
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Admin Customize Controls Button */}
            {isAdmin && (
              <button
                onClick={() => setIsCustomizeOpen(true)}
                title="Customize Controls for this device (Admin)"
                className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Optional Full Lighting Studio Modal Button */}
            {hasControl('studio_modal') && (
              <button
                onClick={() => setIsStudioOpen(true)}
                title="Open Lighting Studio"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => toggleFavorite(device.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Controls Section (Only visible when light is ON and controls are enabled) */}
        {hasAnyVisibleSliders && (
          <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in">
            {/* 1. Brightness Slider */}
            {hasControl('brightness') && (
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
                  className="w-full h-2 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
                />

                {/* Optional Brightness Steps */}
                {hasControl('brightness_presets') && (
                  <div className="flex items-center justify-between gap-1.5 mt-1.5">
                    {BRIGHTNESS_STEPS.map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleBrightnessCommit(pct)}
                        className={`flex-1 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all ${
                          displayBrightness === pct
                            ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Color Temperature (CCT) Slider */}
            {hasControl('color_temp') && (
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
                    min={2200}
                    max={6500}
                    step={25}
                    value={displayKelvin}
                    onChange={(e) => handleKelvinChange(Number(e.target.value))}
                    onMouseUp={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                    onTouchEnd={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-white shadow-inner"
                    style={{
                      background: 'linear-gradient(to right, #ff9329 0%, #ffc078 25%, #ffe6cc 50%, #d8eaff 75%, #a6d2ff 100%)',
                    }}
                  />
                </div>

                {/* Optional CCT Tone Presets */}
                {hasControl('cct_presets') && (
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {CCT_QUICK_PRESETS.map((p) => {
                      const isSel = Math.abs(displayKelvin - p.kelvin) < 150;
                      return (
                        <button
                          key={p.label}
                          onClick={() => handleKelvinCommit(p.kelvin)}
                          className={`py-1 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                            isSel
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold shadow-sm'
                              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. Optional Quick Effects Bar */}
            {hasControl('effects') && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" /> Effects:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEffect('breathe')}
                    title="Breathing light pulsation"
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all ${
                      activeEffect === 'breathe'
                        ? 'bg-purple-500 text-slate-950 border-purple-400 font-bold'
                        : 'bg-slate-800/80 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                    }`}
                  >
                    Breathe
                  </button>
                  <button
                    onClick={() => handleEffect('blink')}
                    title="Flash light alert"
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all ${
                      activeEffect === 'blink'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-slate-800/80 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    }`}
                  >
                    ⚡ Blink
                  </button>
                  <button
                    onClick={() => handleEffect('okay')}
                    title="Flash confirmation"
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all ${
                      activeEffect === 'okay'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                        : 'bg-slate-800/80 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    ✅ Okay
                  </button>
                </div>
              </div>
            )}

            {/* 4. Optional Mini Color Palette */}
            {hasControl('color_picker') && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1 overflow-x-auto">
                <span className="text-[10px] font-mono text-slate-400">Mood:</span>
                <div className="flex items-center gap-1.5">
                  {MINI_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.name}
                      onClick={() => handleColorHex(swatch.hex)}
                      title={swatch.name}
                      className="w-4 h-4 rounded-full border border-white/30 hover:scale-125 transition-transform"
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Customize Controls Modal */}
      <CustomizeControlsModal
        device={device}
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
      />

      {/* Lighting Studio Dialog */}
      <LightDetailModal
        device={device}
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
      />
    </>
  );
};
