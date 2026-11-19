import React, { useState, useEffect } from 'react';
import {
  Sun,
  Sparkles,
  Moon,
  Power,
  Flame,
  Zap,
  Shield,
  Coffee,
  Sliders,
  Fan,
  Lock,
  Unlock,
  Lightbulb,
  Clock,
  Activity,
  Eye,
  Laptop,
  Wand2,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Play,
  RotateCcw,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useBootstrap } from '../../context/BootstrapContext';
import { ApiService } from '../../services/api';
import type { PresetScene } from '../../types';

export const PRESET_ICON_MAP: Record<string, any> = {
  Sun,
  Sparkles,
  Moon,
  Power,
  Flame,
  Zap,
  Shield,
  Coffee,
  Sliders,
  Fan,
  Lock,
  Unlock,
  Lightbulb,
  Clock,
  Activity,
  Eye,
  Laptop,
  Wand2,
};

export const PRESET_COLOR_OPTIONS = [
  { label: 'Amber', value: 'text-[#F0B94D]', hex: '#F0B94D' },
  { label: 'Emerald', value: 'text-[#22D68A]', hex: '#22D68A' },
  { label: 'Indigo', value: 'text-indigo-400', hex: '#818CF8' },
  { label: 'Rose', value: 'text-[#FF5757]', hex: '#FF5757' },
  { label: 'Cyan', value: 'text-cyan-400', hex: '#22D3EE' },
  { label: 'Purple', value: 'text-purple-400', hex: '#C084FC' },
];

interface PresetEditModalProps {
  isOpen: boolean;
  preset: PresetScene | null;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const PresetEditModal: React.FC<PresetEditModalProps> = ({
  isOpen,
  preset,
  onClose,
  onSaveSuccess,
}) => {
  const { data, refreshBootstrap } = useBootstrap();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('Sun');
  const [accentColor, setAccentColor] = useState('text-[#F0B94D]');

  // Global Directive states
  const [lightsDirective, setLightsDirective] = useState<'NO_CHANGE' | 'ON' | 'OFF'>('NO_CHANGE');
  const [lightsBrightness, setLightsBrightness] = useState<number>(85);
  const [locksDirective, setLocksDirective] = useState<'NO_CHANGE' | 'lock' | 'unlock'>('NO_CHANGE');
  const [climateDirective, setClimateDirective] = useState<'NO_CHANGE' | 'ON' | 'OFF'>('NO_CHANGE');
  const [climateTemp, setClimateTemp] = useState<number>(23);
  const [plugsDirective, setPlugsDirective] = useState<'NO_CHANGE' | 'ON' | 'OFF'>('NO_CHANGE');

  // Specific device action overrides
  const [deviceSteps, setDeviceSteps] = useState<any[]>([]);

  // Action status indicators
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active tab inside modal
  const [activeTab, setActiveTab] = useState<'directives' | 'devices' | 'style'>('directives');

  useEffect(() => {
    if (preset) {
      setName(preset.name || '');
      setDesc(preset.desc || '');
      setIcon(preset.icon || 'Sun');
      setAccentColor(preset.accent_color || 'text-[#F0B94D]');

      // Parse actions_json
      let parsedActions: any[] = [];
      try {
        parsedActions = JSON.parse(preset.actions_json || '[]');
      } catch (_) {}

      // Reset directives
      let foundLights = false;
      let foundLocks = false;
      let foundClimate = false;
      let foundPlugs = false;
      const customSteps: any[] = [];

      for (const item of parsedActions) {
        if (item.target === 'lights' || item.type === 'all_lights') {
          foundLights = true;
          setLightsDirective(item.state === 'OFF' ? 'OFF' : 'ON');
          if (item.brightness !== undefined) setLightsBrightness(item.brightness);
        } else if (item.target === 'locks') {
          foundLocks = true;
          setLocksDirective(item.action === 'lock' ? 'lock' : 'unlock');
        } else if (item.target === 'climate') {
          foundClimate = true;
          setClimateDirective(item.state === 'OFF' ? 'OFF' : 'ON');
          if (item.temp !== undefined) setClimateTemp(item.temp);
        } else if (item.target === 'plugs') {
          foundPlugs = true;
          setPlugsDirective(item.state === 'OFF' ? 'OFF' : 'ON');
        } else if (item.device_id) {
          customSteps.push(item);
        }
      }

      if (!foundLights) setLightsDirective('NO_CHANGE');
      if (!foundLocks) setLocksDirective('NO_CHANGE');
      if (!foundClimate) setClimateDirective('NO_CHANGE');
      if (!foundPlugs) setPlugsDirective('NO_CHANGE');

      setDeviceSteps(customSteps);
      setTestResult(null);
      setErrorMsg(null);
    }
  }, [preset, isOpen]);

  if (!isOpen || !preset) return null;

  const CurrentIcon = PRESET_ICON_MAP[icon] || Sun;

  // Build the unified actions array
  const buildActionsArray = () => {
    const actions: any[] = [];

    if (lightsDirective !== 'NO_CHANGE') {
      actions.push({
        type: 'directive',
        target: 'lights',
        state: lightsDirective,
        ...(lightsDirective === 'ON' ? { brightness: Number(lightsBrightness), color_temp: 350 } : {}),
      });
    }

    if (locksDirective !== 'NO_CHANGE') {
      actions.push({
        type: 'directive',
        target: 'locks',
        action: locksDirective,
      });
    }

    if (climateDirective !== 'NO_CHANGE') {
      actions.push({
        type: 'directive',
        target: 'climate',
        state: climateDirective,
        ...(climateDirective === 'ON' ? { temp: Number(climateTemp) } : {}),
      });
    }

    if (plugsDirective !== 'NO_CHANGE') {
      actions.push({
        type: 'directive',
        target: 'plugs',
        state: plugsDirective,
      });
    }

    // Add device specific steps
    for (const step of deviceSteps) {
      if (step.device_id) {
        actions.push(step);
      }
    }

    return actions;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please specify a preset scene name');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const actions = buildActionsArray();

    try {
      const res = await ApiService.updatePreset(preset.id, {
        name: name.trim(),
        desc: desc.trim(),
        icon,
        accent_color: accentColor,
        actions_json: JSON.stringify(actions),
      });

      if (res.ok) {
        await refreshBootstrap();
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      } else {
        setErrorMsg('Failed to save preset changes.');
      }
    } catch (err: any) {
      setErrorMsg(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestRun = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    try {
      // Save pending actions first so test runs accurately
      const actions = buildActionsArray();
      await ApiService.updatePreset(preset.id, {
        name: name.trim(),
        desc: desc.trim(),
        icon,
        accent_color: accentColor,
        actions_json: JSON.stringify(actions),
      });

      const res = await ApiService.runPreset(preset.id);
      if (res.ok) {
        setTestResult(`Successfully executed scene! Actuated ${res.executedActions ?? 0} hardware items.`);
        setTimeout(() => setTestResult(null), 5000);
      } else {
        setErrorMsg('Preset execution failed on server.');
      }
    } catch (err: any) {
      setErrorMsg(`Execution test error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetDefault = async () => {
    if (!window.confirm(`Reset "${preset.name}" to factory default settings?`)) return;

    setIsResetting(true);
    try {
      const res = await ApiService.resetPreset(preset.id);
      if (res.ok) {
        await refreshBootstrap();
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      } else {
        setErrorMsg('Failed to reset preset.');
      }
    } catch (err: any) {
      setErrorMsg(`Reset error: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddDeviceStep = () => {
    const firstDev = (data?.devices || [])[0];
    if (!firstDev) return;
    setDeviceSteps([
      ...deviceSteps,
      {
        type: 'device',
        device_id: firstDev.id,
        action: 'turn_on',
        brightness: 100,
      },
    ]);
  };

  const handleRemoveDeviceStep = (idx: number) => {
    setDeviceSteps(deviceSteps.filter((_, i) => i !== idx));
  };

  const handleUpdateDeviceStep = (idx: number, patch: any) => {
    const next = [...deviceSteps];
    next[idx] = { ...next[idx], ...patch };
    setDeviceSteps(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#191A1D] border border-[#383A3E] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#383A3E] flex items-center justify-between bg-[#111214]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111214] border border-[#383A3E] flex items-center justify-center shadow-inner">
              <CurrentIcon className={`w-5 h-5 ${accentColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#F5F5F5]">Customize Preset Scene</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-[#A6A6A6] mt-0.5">
                Configure one-touch hardware behavior for {preset.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A6A6A6] hover:text-white hover:bg-[#202226] border border-transparent hover:border-[#383A3E] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-[#383A3E] bg-[#111214]/30">
          <button
            type="button"
            onClick={() => setActiveTab('directives')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'directives'
                ? 'text-white border-white bg-[#191A1D]'
                : 'text-[#A6A6A6] border-transparent hover:text-white hover:bg-[#202226]'
            }`}
          >
            Building Directives
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'devices'
                ? 'text-white border-white bg-[#191A1D]'
                : 'text-[#A6A6A6] border-transparent hover:text-white hover:bg-[#202226]'
            }`}
          >
            <span>Device Overrides</span>
            {deviceSteps.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px]">
                {deviceSteps.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'style'
                ? 'text-white border-white bg-[#191A1D]'
                : 'text-[#A6A6A6] border-transparent hover:text-white hover:bg-[#202226]'
            }`}
          >
            Appearance & Icon
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {testResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Common Info: Title & Subtitle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A6A6A6] mb-1.5">Preset Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Work Mode"
                className="w-full bg-[#111214] border border-[#383A3E] rounded-xl px-3 py-2 text-xs text-white placeholder-[#777777] focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A6A6A6] mb-1.5">Description Subtitle</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Optimized 4000K daylight, 23°C climate"
                className="w-full bg-[#111214] border border-[#383A3E] rounded-xl px-3 py-2 text-xs text-white placeholder-[#777777] focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* TAB 1: Building Directives */}
          {activeTab === 'directives' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-[11px] text-[#A6A6A6] bg-[#111214]/60 p-3 rounded-xl border border-[#383A3E]/60 leading-relaxed">
                Global directives apply to all matching building hardware (lights, locks, climate, and plugs) with a single tap.
              </div>

              {/* 1. All Lights Directive */}
              <div className="p-4 rounded-2xl bg-[#111214]/60 border border-[#383A3E] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#F0B94D]" />
                    <span className="text-xs font-bold text-white">All Lights Directive</span>
                  </div>
                  <div className="flex rounded-xl bg-[#191A1D] p-1 border border-[#383A3E] text-xs">
                    {(['NO_CHANGE', 'ON', 'OFF'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setLightsDirective(opt)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          lightsDirective === opt
                            ? opt === 'ON'
                              ? 'bg-[#22D68A] text-slate-950 shadow-sm'
                              : opt === 'OFF'
                              ? 'bg-[#FF5757] text-white shadow-sm'
                              : 'bg-white text-slate-950 shadow-sm'
                            : 'text-[#A6A6A6] hover:text-white'
                        }`}
                      >
                        {opt === 'NO_CHANGE' ? 'No Change' : opt === 'ON' ? 'Turn All ON' : 'Turn All OFF'}
                      </button>
                    ))}
                  </div>
                </div>

                {lightsDirective === 'ON' && (
                  <div className="pt-2 border-t border-[#383A3E]/60 flex items-center gap-4">
                    <label className="text-xs text-[#A6A6A6] whitespace-nowrap">Default Brightness:</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={lightsBrightness}
                      onChange={(e) => setLightsBrightness(Number(e.target.value))}
                      className="flex-1 accent-[#22D68A] h-1.5 bg-[#202226] rounded-lg cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-white w-10 text-right">
                      {lightsBrightness}%
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Security Doors (TTLock) */}
              <div className="p-4 rounded-2xl bg-[#111214]/60 border border-[#383A3E] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">Entrance & Doors (TTLock)</span>
                  </div>
                  <div className="flex rounded-xl bg-[#191A1D] p-1 border border-[#383A3E] text-xs">
                    {(['NO_CHANGE', 'lock', 'unlock'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setLocksDirective(opt)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          locksDirective === opt
                            ? opt === 'lock'
                              ? 'bg-indigo-500 text-white shadow-sm'
                              : opt === 'unlock'
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'bg-white text-slate-950 shadow-sm'
                            : 'text-[#A6A6A6] hover:text-white'
                        }`}
                      >
                        {opt === 'NO_CHANGE' ? 'No Change' : opt === 'lock' ? 'Lock All Doors' : 'Unlock Doors'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Climate / ACs */}
              <div className="p-4 rounded-2xl bg-[#111214]/60 border border-[#383A3E] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fan className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">AC & Climate Directive</span>
                  </div>
                  <div className="flex rounded-xl bg-[#191A1D] p-1 border border-[#383A3E] text-xs">
                    {(['NO_CHANGE', 'ON', 'OFF'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setClimateDirective(opt)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          climateDirective === opt
                            ? opt === 'ON'
                              ? 'bg-cyan-400 text-slate-950 shadow-sm'
                              : opt === 'OFF'
                              ? 'bg-[#FF5757] text-white shadow-sm'
                              : 'bg-white text-slate-950 shadow-sm'
                            : 'text-[#A6A6A6] hover:text-white'
                        }`}
                      >
                        {opt === 'NO_CHANGE' ? 'No Change' : opt === 'ON' ? 'Turn All ON' : 'Turn All OFF'}
                      </button>
                    ))}
                  </div>
                </div>

                {climateDirective === 'ON' && (
                  <div className="pt-2 border-t border-[#383A3E]/60 flex items-center gap-4">
                    <label className="text-xs text-[#A6A6A6] whitespace-nowrap">Target Temp:</label>
                    <input
                      type="range"
                      min="18"
                      max="28"
                      value={climateTemp}
                      onChange={(e) => setClimateTemp(Number(e.target.value))}
                      className="flex-1 accent-cyan-400 h-1.5 bg-[#202226] rounded-lg cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-cyan-400 w-12 text-right">
                      {climateTemp}°C
                    </span>
                  </div>
                )}
              </div>

              {/* 4. Smart Plugs & Relays */}
              <div className="p-4 rounded-2xl bg-[#111214]/60 border border-[#383A3E] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Power className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-white">Smart Plugs & Relays</span>
                  </div>
                  <div className="flex rounded-xl bg-[#191A1D] p-1 border border-[#383A3E] text-xs">
                    {(['NO_CHANGE', 'OFF', 'ON'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPlugsDirective(opt)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          plugsDirective === opt
                            ? opt === 'OFF'
                              ? 'bg-[#FF5757] text-white shadow-sm'
                              : opt === 'ON'
                              ? 'bg-[#22D68A] text-slate-950 shadow-sm'
                              : 'bg-white text-slate-950 shadow-sm'
                            : 'text-[#A6A6A6] hover:text-white'
                        }`}
                      >
                        {opt === 'NO_CHANGE' ? 'No Change' : opt === 'OFF' ? 'Power OFF All' : 'Power ON All'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Specific Device Overrides */}
          {activeTab === 'devices' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Fine-Grained Device Actions</h4>
                  <p className="text-[11px] text-[#A6A6A6]">
                    Specify individual target states for specific devices in specific rooms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDeviceStep}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Device Step
                </button>
              </div>

              {deviceSteps.length === 0 ? (
                <div className="p-8 text-center bg-[#111214]/60 border border-dashed border-[#383A3E] rounded-2xl space-y-2">
                  <SlidersHorizontal className="w-8 h-8 text-[#777777] mx-auto" />
                  <p className="text-xs text-[#A6A6A6]">No device overrides configured.</p>
                  <p className="text-[11px] text-[#777777]">
                    Global directives above will apply. Click &quot;Add Device Step&quot; if you want custom actions for specific individual devices.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {deviceSteps.map((st, idx) => {
                    const dev = (data?.devices || []).find((d) => d.id === st.device_id);
                    const room = dev ? (data?.rooms || []).find((r) => r.id === dev.room_id) : null;

                    return (
                      <div
                        key={idx}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[#111214] p-3 rounded-xl border border-[#383A3E]"
                      >
                        <span className="text-xs font-mono text-[#777777] w-5 text-center font-bold">
                          {idx + 1}
                        </span>

                        <select
                          value={st.device_id}
                          onChange={(e) => handleUpdateDeviceStep(idx, { device_id: e.target.value })}
                          className="flex-1 min-w-[200px] bg-[#191A1D] border border-[#383A3E] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          {(data?.devices || []).map((d) => {
                            const r = (data?.rooms || []).find((rm) => rm.id === d.room_id);
                            return (
                              <option key={d.id} value={d.id}>
                                {r ? `${r.name} • ` : ''}{d.name} ({d.type})
                              </option>
                            );
                          })}
                        </select>

                        <select
                          value={st.action}
                          onChange={(e) => handleUpdateDeviceStep(idx, { action: e.target.value })}
                          className="w-32 bg-[#191A1D] border border-[#383A3E] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        >
                          <option value="turn_on">Turn ON</option>
                          <option value="turn_off">Turn OFF</option>
                          <option value="toggle">Toggle</option>
                          <option value="lock">Lock</option>
                          <option value="unlock">Unlock</option>
                        </select>

                        {st.action === 'turn_on' && dev?.type === 'dimmable_light' && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-[#A6A6A6]">Bright:</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={st.brightness ?? 100}
                              onChange={(e) =>
                                handleUpdateDeviceStep(idx, { brightness: Number(e.target.value) })
                              }
                              className="w-14 bg-[#191A1D] border border-[#383A3E] rounded-lg px-1.5 py-1 text-xs text-white font-mono text-center"
                            />
                            <span className="text-[#777777]">%</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveDeviceStep(idx)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Style, Icon & Color */}
          {activeTab === 'style' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Color Accent Picker */}
              <div>
                <label className="block text-xs font-semibold text-[#A6A6A6] mb-2">Accent Color Theme</label>
                <div className="flex flex-wrap gap-2.5">
                  {PRESET_COLOR_OPTIONS.map((c) => {
                    const isSelected = accentColor === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setAccentColor(c.value)}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#111214] border-white text-white shadow-sm ring-1 ring-white/50'
                            : 'bg-[#111214]/60 border-[#383A3E] text-[#A6A6A6] hover:text-white'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Picker Grid */}
              <div>
                <label className="block text-xs font-semibold text-[#A6A6A6] mb-2">Preset Icon</label>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                  {Object.entries(PRESET_ICON_MAP).map(([key, IconComp]) => {
                    const isSelected = icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setIcon(key)}
                        className={`p-3 rounded-xl border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-white text-slate-950 border-white shadow-md scale-105'
                            : 'bg-[#111214] border-[#383A3E] text-[#A6A6A6] hover:text-white hover:border-[#4B4E54]'
                        }`}
                        title={key}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-[#383A3E] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefault}
                disabled={isResetting}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[#777777] hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
                title="Restore default factory settings for this preset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <button
                type="button"
                onClick={handleTestRun}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-[#111214] hover:bg-[#202226] text-white border border-[#383A3E] text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Test Run Scene</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#A6A6A6] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
