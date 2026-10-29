import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Check,
  SunMedium,
  Flame,
  Sparkles,
  Percent,
  Zap,
  SlidersHorizontal,
  Palette,
  Signal,
  Save,
  RotateCcw,
} from 'lucide-react';
import type { Device } from '../../types';
import { ApiService } from '../../services/api';
import { useBootstrap } from '../../context/BootstrapContext';
import {
  DIMMABLE_LIGHT_CONTROLS,
  DEFAULT_ENABLED_LIGHT_CONTROLS,
  type DeviceControlDef,
} from './deviceControlConfigs';

interface CustomizeControlsModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeControlsModal: React.FC<CustomizeControlsModalProps> = ({
  device,
  isOpen,
  onClose,
}) => {
  const { refreshBootstrap } = useBootstrap();

  let devConfig: any = {};
  try {
    devConfig = JSON.parse(device.config_json || '{}');
  } catch (_) {}

  const initialEnabled: string[] = Array.isArray(devConfig.enabled_controls)
    ? devConfig.enabled_controls
    : DEFAULT_ENABLED_LIGHT_CONTROLS;

  const [selectedControls, setSelectedControls] = useState<string[]>(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cfg: any = {};
    try {
      cfg = JSON.parse(device.config_json || '{}');
    } catch (_) {}
    setSelectedControls(
      Array.isArray(cfg.enabled_controls) ? cfg.enabled_controls : DEFAULT_ENABLED_LIGHT_CONTROLS
    );
  }, [device, isOpen]);

  if (!isOpen) return null;

  const handleToggle = (controlId: string) => {
    setSelectedControls((prev) =>
      prev.includes(controlId) ? prev.filter((id) => id !== controlId) : [...prev, controlId]
    );
  };

  const handleApplyPreset = (preset: 'minimal' | 'recommended' | 'all') => {
    if (preset === 'minimal') {
      setSelectedControls(['brightness', 'color_temp']);
    } else if (preset === 'recommended') {
      setSelectedControls(['brightness', 'color_temp', 'cct_presets', 'power_wattage']);
    } else if (preset === 'all') {
      setSelectedControls(DIMMABLE_LIGHT_CONTROLS.map((c) => c.id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let cfg: any = {};
      try {
        cfg = JSON.parse(device.config_json || '{}');
      } catch (_) {}

      cfg.enabled_controls = selectedControls;

      await ApiService.updateDevice(device.id, {
        config_json: JSON.stringify(cfg),
      });

      setSuccessMsg('Controls updated successfully!');
      await refreshBootstrap();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 700);
    } catch (err: any) {
      alert(`Failed to save controls: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const renderIcon = (name: string) => {
    switch (name) {
      case 'SunMedium':
        return <SunMedium className="w-4 h-4 text-cyan-400" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-amber-400" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'Percent':
        return <Percent className="w-4 h-4 text-emerald-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'SlidersHorizontal':
        return <SlidersHorizontal className="w-4 h-4 text-sky-400" />;
      case 'Palette':
        return <Palette className="w-4 h-4 text-fuchsia-400" />;
      case 'Signal':
        return <Signal className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sliders className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Customize Controls for "{device.name}"
              </h3>
              <p className="text-xs text-slate-400">
                Only the controls checked below will be visible on this device in the UI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-3 bg-slate-950/30 border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400">Quick Presets:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyPreset('minimal')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10"
            >
              Minimal
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('recommended')}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30"
            >
              With Presets
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('all')}
              className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/30"
            >
              All Controls
            </button>
          </div>
        </div>

        {/* Body - Control Options */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {DIMMABLE_LIGHT_CONTROLS.map((ctrl) => {
            const isEnabled = selectedControls.includes(ctrl.id);
            return (
              <div
                key={ctrl.id}
                onClick={() => handleToggle(ctrl.id)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isEnabled
                    ? 'bg-slate-800/90 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-950/40 border-white/5 opacity-70 hover:opacity-100 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                      isEnabled
                        ? 'bg-cyan-500/20 border-cyan-500/40'
                        : 'bg-slate-800/60 border-white/10'
                    }`}
                  >
                    {renderIcon(ctrl.iconName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{ctrl.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                        {ctrl.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ctrl.description}</p>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                    isEnabled
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-800 border-white/20'
                  }`}
                >
                  {isEnabled && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-white">{selectedControls.length}</span> of{' '}
            {DIMMABLE_LIGHT_CONTROLS.length} controls enabled
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 hover:opacity-90 shadow-glow flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {saving ? (
                <span>Saving...</span>
              ) : successMsg ? (
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved!
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Save Controls
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

