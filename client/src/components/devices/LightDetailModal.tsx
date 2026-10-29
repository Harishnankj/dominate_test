import React, { useState } from 'react';
import {
  X,
  Lightbulb,
  SunMedium,
  Flame,
  Palette,
  Sparkles,
  SlidersHorizontal,
  Zap,
  Radio,
  Signal,
  Check,
  RotateCcw,
  Power,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type { Device, Z2mDevice } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useBootstrap } from '../../context/BootstrapContext';

interface LightDetailModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
}

// Convert Kelvin to approx CSS hex color for glowing preview
function kelvinToHex(kelvin: number): string {
  const temp = kelvin / 100;
  let red: number, green: number, blue: number;

  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
    blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    blue = 255;
  }

  red = Math.min(255, Math.max(0, Math.round(red)));
  green = Math.min(255, Math.max(0, Math.round(green)));
  blue = Math.min(255, Math.max(0, Math.round(blue)));

  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

// Tone descriptions for Kelvin ranges
function getToneDescription(kelvin: number): { label: string; desc: string } {
  if (kelvin <= 2400) return { label: 'Candlelight (Warmest)', desc: 'Ultra-warm amber glow for evening relaxation and bedtime' };
  if (kelvin <= 2900) return { label: 'Warm White (Cozy)', desc: 'Inviting golden glow ideal for living spaces and dining' };
  if (kelvin <= 3600) return { label: 'Soft White (Comfort)', desc: 'Balanced gentle warmth for general daytime comfort' };
  if (kelvin <= 4600) return { label: 'Neutral White (Focus)', desc: 'Clean natural daylight balanced for office work and reading' };
  if (kelvin <= 5600) return { label: 'Bright Daylight (Studio)', desc: 'Crisp vibrant illumination for detailed tasks' };
  return { label: 'Cool Daylight (Maximum Clarity)', desc: 'Energizing cool white for high alertness and productivity' };
}

const CCT_PRESETS = [
  { name: 'Candle', kelvin: 2222, mireds: 450, icon: '🕯️', desc: 'Ultra-warm 2200K' },
  { name: 'Warm White', kelvin: 2700, mireds: 370, icon: '🛋️', desc: 'Warm 2700K' },
  { name: 'Neutral', kelvin: 4000, mireds: 250, icon: '📖', desc: 'Daylight 4000K' },
  { name: 'Coolest', kelvin: 6250, mireds: 160, icon: '❄️', desc: 'Cool White 6250K' },
];

const BRIGHTNESS_PRESETS = [10, 25, 50, 75, 100];

const COLOR_SWATCHES = [
  { name: 'Warm Amber', hex: '#FFA726' },
  { name: 'Sunset Coral', hex: '#FF7043' },
  { name: 'Crimson', hex: '#EF5350' },
  { name: 'Rose', hex: '#EC407A' },
  { name: 'Violet', hex: '#AB47BC' },
  { name: 'Deep Purple', hex: '#7E57C2' },
  { name: 'Electric Blue', hex: '#42A5F5' },
  { name: 'Cyan Neon', hex: '#26C6DA' },
  { name: 'Emerald', hex: '#26A69A' },
  { name: 'Mint Green', hex: '#66BB6A' },
  { name: 'Lime', hex: '#D4E157' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

export const LightDetailModal: React.FC<LightDetailModalProps> = ({ device, isOpen, onClose }) => {
  const { state, attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { getZ2mState, setZ2mState, getZ2mDevice } = useBootstrap();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const maxWatts = devConfig.max_wattage || 18;

  const z2mName = device.z2m_friendly_name || devConfig.z2m_friendly_name;
  const z2mState = z2mName ? getZ2mState(z2mName) : undefined;
  const z2mDev: Z2mDevice | undefined = z2mName ? getZ2mDevice(z2mName) : undefined;

  const effectiveState =
    state !== 'unavailable'
      ? state
      : z2mState?.state
      ? z2mState.state.toLowerCase()
      : 'off';
  const isOn = effectiveState === 'on';

  const haBrightness = attributes.brightness ? Math.round((attributes.brightness / 255) * 100) : (isOn ? 100 : 0);
  const z2mBrightness = z2mState?.brightness !== undefined ? Math.round((z2mState.brightness / 254) * 100) : (isOn ? 100 : 0);
  const currentBrightness = state !== 'unavailable' ? haBrightness : z2mBrightness;

  const currentKelvin =
    attributes.color_temp_kelvin ||
    (z2mState?.color_temp ? Math.round(1000000 / z2mState.color_temp) : 4000);

  const [activeTab, setActiveTab] = useState<'brightness' | 'cct' | 'color' | 'effects' | 'settings'>('cct');
  const [localBrightness, setLocalBrightness] = useState<number | null>(null);
  const [localKelvin, setLocalKelvin] = useState<number | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [transitionTime, setTransitionTime] = useState<number>(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const displayBrightness = localBrightness !== null ? localBrightness : currentBrightness;
  const displayKelvin = localKelvin !== null ? localKelvin : currentKelvin;
  const toneInfo = getToneDescription(displayKelvin);
  const glowHex = kelvinToHex(displayKelvin);
  const currentWatts = isOn ? Math.round((displayBrightness / 100) * maxWatts * 10) / 10 : 0;
  const linkQuality = z2mState?.linkquality || z2mDev?.linkquality;

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  // Toggle On / Off
  const handleToggle = async () => {
    const targetState = isOn ? 'OFF' : 'ON';
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { state: targetState });
      showToast(`Light turned ${targetState}`);
      return;
    }

    try {
      await callService('light', isOn ? 'turn_off' : 'turn_on');
      showToast(`Light turned ${targetState}`);
    } catch {
      if (z2mName) {
        await setZ2mState(z2mName, { state: targetState });
        showToast(`Light turned ${targetState}`);
      }
    }
  };

  // Commit Brightness
  const handleBrightnessCommit = async (val: number) => {
    setLocalBrightness(null);
    const z2mVal = Math.round((val / 100) * 254);

    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      if (val === 0) {
        await setZ2mState(z2mName, { state: 'OFF' });
      } else {
        await setZ2mState(z2mName, { state: 'ON', brightness: z2mVal });
      }
      showToast(`Brightness set to ${val}%`);
      return;
    }

    try {
      if (val === 0) {
        await callService('light', 'turn_off');
      } else {
        await callService('light', 'turn_on', { brightness_pct: val });
      }
      showToast(`Brightness set to ${val}%`);
    } catch {
      if (z2mName) {
        if (val === 0) {
          await setZ2mState(z2mName, { state: 'OFF' });
        } else {
          await setZ2mState(z2mName, { state: 'ON', brightness: z2mVal });
        }
        showToast(`Brightness set to ${val}%`);
      }
    }
  };

  // Commit Kelvin / Color Temp
  const handleKelvinCommit = async (val: number) => {
    setLocalKelvin(null);
    // Convert Kelvin to Mireds (1,000,000 / K), bounded to [160, 450]
    const mireds = Math.max(160, Math.min(450, Math.round(1000000 / val)));

    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { color_temp: mireds });
      showToast(`Color temperature set to ${val}K (${mireds} mireds)`);
      return;
    }

    try {
      await callService('light', 'turn_on', { color_temp_kelvin: val });
      showToast(`Color temperature set to ${val}K`);
    } catch {
      if (z2mName) {
        await setZ2mState(z2mName, { color_temp: mireds });
        showToast(`Color temperature set to ${val}K (${mireds} mireds)`);
      }
    }
  };

  // Trigger Color (RGB Hex)
  const handleColorHex = async (hex: string) => {
    if (z2mName && (state === 'unavailable' || !device.entity_id)) {
      await setZ2mState(z2mName, { color: { hex } });
      showToast(`Color tone set to ${hex}`);
      return;
    }

    // Convert hex to rgb for HA
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    try {
      await callService('light', 'turn_on', { rgb_color: [r, g, b] });
      showToast(`Color tone set`);
    } catch {
      if (z2mName) {
        await setZ2mState(z2mName, { color: { hex } });
        showToast(`Color tone set to ${hex}`);
      }
    }
  };

  // Trigger Effect
  const handleTriggerEffect = async (effectName: string) => {
    setActiveEffect(effectName);
    if (z2mName) {
      await setZ2mState(z2mName, { effect: effectName });
      showToast(`Effect '${effectName}' triggered`);
    } else {
      try {
        await callService('light', 'turn_on', { effect: effectName });
        showToast(`Effect '${effectName}' triggered`);
      } catch (err: any) {
        showToast(`Effect trigger failed: ${err.message}`);
      }
    }
    setTimeout(() => setActiveEffect(null), 3000);
  };

  // Update Power-On Behavior
  const handlePowerOnBehavior = async (behavior: string) => {
    if (z2mName) {
      await setZ2mState(z2mName, { power_on_behavior: behavior });
      showToast(`Power-on behavior set to '${behavior}'`);
    }
  };

  // Update Startup Color Temp
  const handleStartupColorTemp = async (val: string | number) => {
    if (z2mName) {
      const payloadVal = val === 'previous' ? 65535 : Number(val);
      await setZ2mState(z2mName, { color_temp_startup: payloadVal });
      showToast(`Startup color temp saved`);
    }
  };

  // Update Transition
  const handleTransitionCommit = async (sec: number) => {
    setTransitionTime(sec);
    if (z2mName) {
      await setZ2mState(z2mName, { transition: sec });
      showToast(`Transition set to ${sec}s`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden">
        {/* Glow Header Background */}
        <div
          className="absolute top-0 left-0 right-0 h-32 opacity-25 blur-3xl pointer-events-none transition-all duration-700"
          style={{ backgroundColor: isOn ? glowHex : '#1e293b' }}
        />

        {/* Modal Top Bar */}
        <div className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                isOn
                  ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
              style={isOn ? { boxShadow: `0 0 24px ${glowHex}88` } : undefined}
            >
              <Lightbulb className={`w-6 h-6 ${isOn ? 'fill-current' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">{device.name}</h3>
                {z2mName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5" /> Direct Zigbee2MQTT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{z2mDev?.definition?.description || z2mDev?.definition?.model || 'Smart Light'}</span>
                {linkQuality !== undefined && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
                    <Signal className="w-3 h-3" /> {linkQuality} LQI
                  </span>
                )}
                {isOn && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                    <Zap className="w-3 h-3" /> {currentWatts}W
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Master Power Toggle */}
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                isOn
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-glow'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isOn ? 'Turn OFF' : 'Turn ON'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div className="px-6 py-2 bg-cyan-500/20 border-b border-cyan-500/30 text-xs text-cyan-300 font-mono flex items-center justify-between animate-in slide-in-from-top-1">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-cyan-400" /> {feedbackMsg}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="relative z-10 px-6 py-2.5 bg-slate-900/60 border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('cct')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'cct'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Color Tone (CCT)</span>
          </button>

          <button
            onClick={() => setActiveTab('brightness')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'brightness'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-glow'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <SunMedium className="w-3.5 h-3.5" />
            <span>Brightness ({displayBrightness}%)</span>
          </button>

          <button
            onClick={() => setActiveTab('color')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'color'
                ? 'bg-fuchsia-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Color & Moods</span>
          </button>

          <button
            onClick={() => setActiveTab('effects')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'effects'
                ? 'bg-purple-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Light Effects</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'settings'
                ? 'bg-slate-700 text-cyan-300 font-bold shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Hardware & Settings</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CCT COLOR TEMPERATURE */}
          {activeTab === 'cct' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Visual Kelvin Orb Preview */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-500 border border-white/20"
                    style={{
                      backgroundColor: glowHex,
                      boxShadow: `0 0 32px ${glowHex}bb`,
                    }}
                  >
                    <Flame className="w-8 h-8 text-slate-950/80" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-white font-mono">{displayKelvin}K</span>
                      <span className="text-xs font-mono text-slate-400">
                        ({Math.round(1000000 / displayKelvin)} mireds)
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-amber-300">{toneInfo.label}</p>
                    <p className="text-xs text-slate-400 max-w-sm mt-0.5">{toneInfo.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleKelvinCommit(Math.max(2200, displayKelvin - 250))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-amber-300 border border-amber-500/20"
                  >
                    -250K (Warmer)
                  </button>
                  <button
                    onClick={() => handleKelvinCommit(Math.min(6500, displayKelvin + 250))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-sky-300 border border-sky-500/20"
                  >
                    +250K (Cooler)
                  </button>
                </div>
              </div>

              {/* Interactive Kelvin Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" /> Continuous Temperature Spectrum
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{displayKelvin} Kelvin</span>
                </div>
                <div className="relative py-2">
                  <input
                    type="range"
                    min={2200}
                    max={6500}
                    step={25}
                    value={displayKelvin}
                    onChange={(e) => setLocalKelvin(Number(e.target.value))}
                    onMouseUp={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                    onTouchEnd={(e) => handleKelvinCommit(Number(e.currentTarget.value))}
                    className="w-full h-4 rounded-xl appearance-none cursor-pointer border border-white/20 accent-white shadow-inner"
                    style={{
                      background: 'linear-gradient(to right, #ff9329 0%, #ffc078 25%, #ffe6cc 50%, #d8eaff 75%, #a6d2ff 100%)',
                    }}
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
                    <span>2200K Candle</span>
                    <span>2700K Warm</span>
                    <span>4000K Neutral</span>
                    <span>5000K Daylight</span>
                    <span>6500K Cool</span>
                  </div>
                </div>
              </div>

              {/* CCT Quick Presets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Quick Temperature Tone Presets
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CCT_PRESETS.map((preset) => {
                    const isSelected = Math.abs(displayKelvin - preset.kelvin) < 150;
                    const hex = kelvinToHex(preset.kelvin);
                    return (
                      <button
                        key={preset.name}
                        onClick={() => handleKelvinCommit(preset.kelvin)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-slate-800 border-amber-400 shadow-glow scale-[1.02]'
                            : 'glass-panel border-white/10 hover:border-white/20 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg">{preset.icon}</span>
                          <div
                            className="w-4 h-4 rounded-full border border-white/30"
                            style={{ backgroundColor: hex }}
                          />
                        </div>
                        <div className="text-xs font-bold text-white">{preset.name}</div>
                        <div className="text-[11px] font-mono text-amber-300 font-semibold mt-0.5">
                          {preset.kelvin}K
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRIGHTNESS & DIMMING */}
          {activeTab === 'brightness' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="glass-panel p-6 rounded-2xl border border-white/10 text-center space-y-4">
                <div className="inline-flex p-4 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <SunMedium className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-4xl font-black text-white font-mono">{displayBrightness}%</div>
                  <p className="text-xs text-slate-400 mt-1">
                    {displayBrightness === 0 ? 'Light is turned off' : `Approx ${currentWatts} Watts consumed`}
                  </p>
                </div>

                <div className="max-w-md mx-auto pt-2">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={displayBrightness}
                    onChange={(e) => setLocalBrightness(Number(e.target.value))}
                    onMouseUp={(e) => handleBrightnessCommit(Number(e.currentTarget.value))}
                    onTouchEnd={(e) => handleBrightnessCommit(Number(e.currentTarget.value))}
                    className="w-full h-3 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-2">
                    <span>1% Dim</span>
                    <span>50% Balanced</span>
                    <span>100% Maximum</span>
                  </div>
                </div>
              </div>

              {/* Brightness Presets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Instant Brightness Steps
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {BRIGHTNESS_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handleBrightnessCommit(pct)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold font-mono transition-all border ${
                        displayBrightness === pct
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-glow'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/10'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Fine Adjustment Controls */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleBrightnessCommit(Math.max(1, displayBrightness - 5))}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300 border border-white/10"
                >
                  -5% Dimmer
                </button>
                <button
                  onClick={() => handleBrightnessCommit(Math.max(1, displayBrightness - 1))}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-400 border border-white/10"
                >
                  -1%
                </button>
                <button
                  onClick={() => handleBrightnessCommit(Math.min(100, displayBrightness + 1))}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-400 border border-white/10"
                >
                  +1%
                </button>
                <button
                  onClick={() => handleBrightnessCommit(Math.min(100, displayBrightness + 5))}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300 border border-white/10"
                >
                  +5% Brighter
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: COLOR & MOODS */}
          {activeTab === 'color' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Color Tone & Mood Swatches</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select a color atmosphere for your space or pick a custom hex value.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-300">Custom Picker:</label>
                  <input
                    type="color"
                    onChange={(e) => handleColorHex(e.target.value)}
                    className="w-9 h-9 rounded-xl bg-transparent cursor-pointer border border-white/20 p-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    onClick={() => handleColorHex(swatch.hex)}
                    className="glass-panel p-3 rounded-2xl border border-white/10 hover:border-cyan-400 hover:scale-105 transition-all text-center group"
                  >
                    <div
                      className="w-12 h-12 rounded-xl mx-auto mb-2 shadow-md border border-white/20 group-hover:shadow-glow transition-all"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="text-[11px] font-semibold text-white block truncate">{swatch.name}</span>
                    <span className="text-[9px] font-mono text-slate-400 block">{swatch.hex}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LIGHT EFFECTS */}
          {activeTab === 'effects' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="glass-panel p-4 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-white">Zigbee2MQTT Light Dynamic Effects</h4>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Trigger hardware animations supported directly by your light controller.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Breathe */}
                <button
                  onClick={() => handleTriggerEffect('breathe')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeEffect === 'breathe'
                      ? 'bg-purple-500/20 border-purple-400 shadow-glow animate-pulse'
                      : 'glass-panel border-white/10 hover:border-purple-400/50 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">✨</span>
                    <span className="text-[10px] font-mono uppercase font-bold text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                      breathe
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Breathing Pulse</h5>
                  <p className="text-xs text-slate-400 mt-1">
                    Light gently fades up and down in a calm breathing rhythm.
                  </p>
                </button>

                {/* Blink */}
                <button
                  onClick={() => handleTriggerEffect('blink')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeEffect === 'blink'
                      ? 'bg-amber-500/20 border-amber-400 shadow-glow'
                      : 'glass-panel border-white/10 hover:border-amber-400/50 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">⚡</span>
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      blink
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Alert Flash</h5>
                  <p className="text-xs text-slate-400 mt-1">
                    Flashes the light once for alert, doorbell, or scene trigger.
                  </p>
                </button>

                {/* Okay */}
                <button
                  onClick={() => handleTriggerEffect('okay')}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeEffect === 'okay'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-glow'
                      : 'glass-panel border-white/10 hover:border-emerald-400/50 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">✅</span>
                    <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      okay
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Confirmation Flash</h5>
                  <p className="text-xs text-slate-400 mt-1">
                    Double-flash confirmation indicating action success.
                  </p>
                </button>

                {/* Stop Effect */}
                <button
                  onClick={() => handleTriggerEffect('stop_effect')}
                  className="p-4 rounded-2xl border glass-panel border-white/10 hover:border-rose-400/50 hover:bg-slate-800/80 text-left transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">⏹️</span>
                    <span className="text-[10px] font-mono uppercase font-bold text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                      stop
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Stop Active Effect</h5>
                  <p className="text-xs text-slate-400 mt-1">
                    Immediately aborts any ongoing pulse or blink animation.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: HARDWARE & Z2M CONFIG */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Power-On Behavior */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">Power-On Recovery Behavior</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Select what the light should do when mains power is restored after a power outage.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'previous', label: 'Restore Previous', desc: 'Return to last state' },
                    { id: 'off', label: 'Always OFF', desc: 'Stay safely turned off' },
                    { id: 'on', label: 'Always ON', desc: 'Turn on immediately' },
                    { id: 'toggle', label: 'Toggle State', desc: 'Invert state' },
                  ].map((opt) => {
                    const isSelected = (z2mState?.power_on_behavior || 'previous') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handlePowerOnBehavior(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                            : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Startup Color Temp */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">Startup Color Temperature</h4>
                </div>
                <p className="text-xs text-slate-400">
                  The default temperature the light driver boots with after cold power restoration.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { val: 'previous', label: 'Previous', mireds: 'Memory' },
                    { val: 450, label: 'Warmest', mireds: '2200K' },
                    { val: 370, label: 'Neutral', mireds: '2700K' },
                    { val: 250, label: 'Cool', mireds: '4000K' },
                    { val: 160, label: 'Coolest', mireds: '6250K' },
                  ].map((opt) => {
                    const currentVal = z2mState?.color_temp_startup;
                    const isSelected =
                      opt.val === 'previous'
                        ? currentVal === 65535 || currentVal === 'previous'
                        : currentVal === opt.val;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleStartupColorTemp(opt.val)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white font-semibold'
                            : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] font-mono text-amber-300 mt-0.5">{opt.mireds}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transition Time */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-bold text-white">Fade Transition Duration</h4>
                  </div>
                  <span className="text-xs font-mono text-cyan-300 font-bold">{transitionTime}s</span>
                </div>
                <p className="text-xs text-slate-400">
                  Controls how smoothly the driver transitions between on/off, brightness, and color changes.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  {[0, 0.5, 1.0, 2.0].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => handleTransitionCommit(sec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                        transitionTime === sec
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                      }`}
                    >
                      {sec === 0 ? 'Instant (0s)' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagnostic Information */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hardware & Network Telemetry
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">DEVICE MODEL</span>
                    <span className="text-white font-semibold">{z2mDev?.definition?.model || 'ZG50CC-CCT-DRIVER'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">VENDOR</span>
                    <span className="text-white font-semibold">{z2mDev?.definition?.vendor || 'Envilar / Sunricher'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">IEEE ADDRESS</span>
                    <span className="text-cyan-300 font-semibold">{z2mDev?.ieee_address || z2mName || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">LINK QUALITY (LQI)</span>
                    <span className="text-emerald-400 font-semibold">{linkQuality !== undefined ? `${linkQuality} / 255` : 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="relative z-10 px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Zigbee2MQTT Synchronization Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

