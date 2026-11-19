import React, { useState } from 'react';
import {
  Sparkles,
  Sun,
  Moon,
  Power,
  Play,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Plus,
  ArrowRight,
  Workflow,
  Wand2,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import type { Automation, PresetScene } from '../types';
import { PresetEditModal, PRESET_ICON_MAP } from '../components/scenes/PresetEditModal';

interface ScenesPageProps {
  onOpenAdmin?: () => void;
  onNavigateToAutomations?: () => void;
}

export const ScenesPage: React.FC<ScenesPageProps> = ({
  onOpenAdmin,
  onNavigateToAutomations,
}) => {
  const { data, setZ2mState, setTuyaState } = useBootstrap();
  const { isAdmin } = useAuth();

  const allDevices = data?.devices || [];
  const automations = data?.automations || [];

  const [runningSceneId, setRunningSceneId] = useState<string | null>(null);
  const [successSceneId, setSuccessSceneId] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<PresetScene | null>(null);

  // Architectural Presets: load dynamically from database / bootstrap, fallback to defaults
  const presetScenes: PresetScene[] =
    data?.presets && data.presets.length > 0
      ? data.presets
      : [
          {
            id: 'work_mode',
            name: 'Work Mode',
            desc: 'Optimized 4000K daylight lighting, comfortable 23°C climate',
            icon: 'Sun',
            accent_color: 'text-[#F0B94D]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'ON', brightness: 85, color_temp: 350 },
              { type: 'directive', target: 'climate', state: 'ON', temp: 23 },
            ]),
            sort_order: 1,
          },
          {
            id: 'meeting_mode',
            name: 'Meeting Mode',
            desc: 'Conference lighting & presentation ambience across rooms',
            icon: 'Sparkles',
            accent_color: 'text-[#22D68A]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'ON', brightness: 60 },
            ]),
            sort_order: 2,
          },
          {
            id: 'night_mode',
            name: 'Night Mode',
            desc: 'Secure all building entrances and power down work fixtures',
            icon: 'Moon',
            accent_color: 'text-indigo-400',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'locks', action: 'lock' },
              { type: 'directive', target: 'lights', state: 'OFF' },
            ]),
            sort_order: 3,
          },
          {
            id: 'all_off',
            name: 'All Off',
            desc: 'Emergency / end-of-day shutoff for all lighting and fixtures',
            icon: 'Power',
            accent_color: 'text-[#FF5757]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'OFF' },
              { type: 'directive', target: 'plugs', state: 'OFF' },
            ]),
            sort_order: 4,
          },
        ];

  // Custom user-defined scenes (trigger_json = { type: 'manual' })
  const customScenes = automations.filter((auto) => {
    try {
      const tr = JSON.parse(auto.trigger_json || '{}');
      return tr.type === 'manual';
    } catch {
      return false;
    }
  });

  const handleRunPreset = async (scene: PresetScene) => {
    setRunningSceneId(scene.id);
    setSuccessSceneId(null);
    try {
      // 1. Dual execution: call server endpoint
      await ApiService.runPreset(scene.id);

      // 2. Also run quick local actuation fallback
      let actions: any[] = [];
      try {
        actions = JSON.parse(scene.actions_json || '[]');
      } catch (_) {}

      for (const item of actions) {
        if (item.target === 'lights' || item.type === 'all_lights') {
          const isOff = item.state === 'OFF';
          const bPct = item.brightness ?? 80;
          for (const dev of allDevices) {
            let cfg: any = {};
            try { cfg = JSON.parse(dev.config_json); } catch (_) {}
            const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
            const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
            if (dev.type === 'dimmable_light') {
              if (zName) setZ2mState(zName, isOff ? { state: 'OFF' } : { state: 'ON', brightness: Math.round((bPct / 100) * 254), color_temp: item.color_temp ?? 350 }).catch(() => {});
              if (tuyaId) setTuyaState(tuyaId, { switch_led: !isOff }).catch(() => {});
            } else if (dev.type === 'switch_light') {
              if (zName) setZ2mState(zName, { state: isOff ? 'OFF' : 'ON' }).catch(() => {});
              if (tuyaId) setTuyaState(tuyaId, { switch_1: !isOff }).catch(() => {});
            }
          }
        } else if (item.target === 'locks' && item.action === 'lock') {
          ApiService.lockAllDoors().catch(() => {});
        } else if (item.target === 'plugs' && item.state === 'OFF') {
          for (const dev of allDevices) {
            if (dev.type === 'switch_light') {
              let cfg: any = {};
              try { cfg = JSON.parse(dev.config_json); } catch (_) {}
              const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
              const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
              if (zName) setZ2mState(zName, { state: 'OFF' }).catch(() => {});
              if (tuyaId) setTuyaState(tuyaId, { switch_1: false }).catch(() => {});
            }
          }
        }
      }

      setSuccessSceneId(scene.id);
      setTimeout(() => setSuccessSceneId(null), 3000);
    } catch (err: any) {
      alert(`Scene execution failed: ${err.message}`);
    } finally {
      setRunningSceneId(null);
    }
  };

  const handleRunCustomScene = async (auto: Automation) => {
    setRunningSceneId(auto.id);
    setSuccessSceneId(null);
    try {
      const res = await ApiService.runAutomation(auto.id);
      if (res.ok) {
        setSuccessSceneId(auto.id);
        setTimeout(() => setSuccessSceneId(null), 3000);
      } else {
        alert('Scene failed to trigger');
      }
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setRunningSceneId(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Page Header */}
      <div className="bg-[#191A1D] rounded-2xl p-4 md:p-5 border border-[#383A3E] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#F5F5F5]">Smart Scenes</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-white/10 text-[#F5F5F5] border border-white/20">
                {presetScenes.length + customScenes.length} PRESETS
              </span>
            </div>
            <p className="text-xs text-[#A6A6A6]">
              One-tap multi-device presets to instantly configure lighting, climate, and security
            </p>
          </div>
        </div>

        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-[#111214] hover:bg-[#202226] text-white border border-[#383A3E] hover:border-white/40 font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Sliders className="w-4 h-4" /> Manage in Admin Studio
          </button>
        )}
      </div>

      {/* Clarification banner between Scenes and Automations */}
      <div className="bg-[#191A1D]/60 rounded-xl p-3.5 border border-[#383A3E]/60 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#A6A6A6]">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span>
            <strong className="text-[#F5F5F5]">Scenes</strong> are instant environment presets
            activated manually on-demand.
          </span>
        </div>
        {onNavigateToAutomations && (
          <button
            onClick={onNavigateToAutomations}
            className="shrink-0 text-[#22D68A] hover:text-[#22D68A]/80 font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Switch to Automations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Section 1: Architectural Preset Scenes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold tracking-wider text-[#A6A6A6] uppercase flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5 text-white" /> Architectural Environment Presets
          </h3>
          <span className="text-[11px] font-mono text-[#777777]">One-Touch Actuation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetScenes.map((scene) => {
            const Icon = typeof scene.icon === 'string' ? PRESET_ICON_MAP[scene.icon] || Sun : scene.icon || Sun;
            const isRunning = runningSceneId === scene.id;
            const isSuccess = successSceneId === scene.id;
            const colorClass = scene.accent_color || (scene as any).accentColor || 'text-white';

            return (
              <div
                key={scene.id}
                className="bg-[#191A1D] rounded-2xl p-5 border border-[#383A3E] hover:border-[#4B4E54] flex flex-col justify-between gap-4 transition-all relative group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#111214] border border-[#383A3E] flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${colorClass}`} />
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => setEditingPreset(scene)}
                        className="px-2.5 py-1 rounded-lg bg-[#111214] hover:bg-[#202226] text-[#A6A6A6] hover:text-white border border-[#383A3E] hover:border-white/40 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Customize preset for building"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-[#F5F5F5]">{scene.name}</h4>
                  <p className="text-xs text-[#A6A6A6] leading-relaxed">{scene.desc}</p>
                </div>

                <button
                  onClick={() => handleRunPreset(scene)}
                  disabled={isRunning}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isSuccess
                      ? 'bg-[#22D68A] text-slate-950 font-bold'
                      : 'bg-white text-slate-950 hover:bg-neutral-200 active:scale-95'
                  }`}
                >
                  {isRunning ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isRunning ? 'Applying...' : isSuccess ? 'Activated!' : 'Activate Scene'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Custom User-Created Manual Scenes */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold tracking-wider text-[#A6A6A6] uppercase flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-white" /> Custom Multi-Device Scenes
          </h3>
          <span className="text-[11px] font-mono text-[#777777]">
            {customScenes.length} Custom
          </span>
        </div>

        {customScenes.length === 0 ? (
          <div className="bg-[#191A1D] rounded-2xl p-8 text-center border border-dashed border-[#383A3E] space-y-3">
            <Sparkles className="w-8 h-8 text-[#777777] mx-auto" />
            <h4 className="text-sm font-bold text-[#F5F5F5]">No custom manual scenes created yet</h4>
            <p className="text-xs text-[#A6A6A6] max-w-sm mx-auto">
              You can create custom multi-device presets (e.g. "Focus Time", "Friday Evening") in Admin Studio by choosing "Manual Scene Only" trigger.
            </p>
            {isAdmin && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="mt-2 px-4 py-2 rounded-xl bg-[#111214] hover:bg-[#202226] text-white border border-[#383A3E] font-semibold text-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Custom Scene
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customScenes.map((auto) => {
              let stepCount = 0;
              try {
                const st = JSON.parse(auto.steps_json || auto.actions_json || '[]');
                stepCount = Array.isArray(st) ? st.length : 0;
              } catch (_) {}

              const isRunning = runningSceneId === auto.id;
              const isSuccess = successSceneId === auto.id;

              return (
                <div
                  key={auto.id}
                  className="bg-[#191A1D] rounded-2xl p-5 border border-[#383A3E] hover:border-[#4B4E54] flex flex-col justify-between gap-4 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-white shrink-0" />
                        {auto.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111214] text-[#A6A6A6] border border-[#383A3E]">
                        {stepCount} {stepCount === 1 ? 'Action' : 'Actions'}
                      </span>
                    </div>
                    <p className="text-xs text-[#A6A6A6] mt-2">
                      {auto.last_run_at
                        ? `Last triggered ${new Date(auto.last_run_at).toLocaleTimeString()}`
                        : 'Manual trigger ready'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#383A3E]/50 flex items-center justify-between">
                    <span className="text-[11px] text-[#A6A6A6]">Instant Local Trigger</span>
                    <button
                      onClick={() => handleRunCustomScene(auto)}
                      disabled={isRunning}
                      className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                        isSuccess
                          ? 'bg-[#22D68A] text-slate-950 font-bold'
                          : 'bg-white text-slate-950 hover:bg-neutral-200 active:scale-95'
                      }`}
                    >
                      {isRunning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{isRunning ? 'Applying...' : isSuccess ? 'Applied!' : 'Run Scene'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preset Scene Customization Modal (Admin) */}
      <PresetEditModal
        isOpen={!!editingPreset}
        preset={editingPreset}
        onClose={() => setEditingPreset(null)}
      />
    </div>
  );
};

export default ScenesPage;
