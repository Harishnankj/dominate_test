import React, { useState, useEffect, useMemo } from 'react';
import {
  Lightbulb,
  Thermometer,
  Snowflake,
  Fan,
  Power,
  Wind,
  Plug,
  Zap,
  Sliders,
  Activity,
  Sun,
  Lock,
  Sparkles,
  X,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Search,
  Settings,
} from 'lucide-react';
import type { QuickControlCategory, QuickControlConfig, Device } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { ApiService } from '../../services/api';
import {
  DEFAULT_QUICK_CONTROLS,
  getDeviceRoleCategory,
  getDevicesForQuickControl,
  parseQuickControls,
} from '../../utils/deviceCategory';

export const QUICK_CONTROL_ICON_MAP: Record<string, any> = {
  Lightbulb,
  Thermometer,
  Snowflake,
  Fan,
  Power,
  Wind,
  Plug,
  Zap,
  Sliders,
  Activity,
  Sun,
  Lock,
  Sparkles,
};

const CATEGORY_OPTIONS: Array<{ value: QuickControlCategory; label: string }> = [
  { value: 'lights', label: 'Lights (All Lights)' },
  { value: 'climate', label: 'AC & Climate' },
  { value: 'fans', label: 'Fans & Ventilation' },
  { value: 'power', label: 'Power Meter / Grid Readout' },
  { value: 'curtains', label: 'Curtains & Blinds' },
  { value: 'plugs', label: 'Smart Plugs & Relays' },
  { value: 'custom', label: 'Custom Device Group' },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  ac: 'bg-cyan-950/70 text-cyan-400 border-cyan-800/40',
  fan: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/40',
  light: 'bg-amber-950/70 text-amber-400 border-amber-800/40',
  plug: 'bg-purple-950/70 text-purple-400 border-purple-800/40',
  meter: 'bg-yellow-950/70 text-yellow-400 border-yellow-800/40',
  curtain: 'bg-indigo-950/70 text-indigo-400 border-indigo-800/40',
  lock: 'bg-rose-950/70 text-rose-400 border-rose-800/40',
  sensor: 'bg-slate-800 text-slate-300 border-slate-700',
};

interface QuickControlsEditModalProps {
  isOpen: boolean;
  initialControlId?: string | null;
  onClose: () => void;
  onOpenAdminDevices?: () => void;
}

export const QuickControlsEditModal: React.FC<QuickControlsEditModalProps> = ({
  isOpen,
  initialControlId,
  onClose,
  onOpenAdminDevices,
}) => {
  const { data, refreshBootstrap } = useBootstrap();
  const allDevices = data?.devices || [];
  const allRooms = data?.rooms || [];

  const [items, setItems] = useState<QuickControlConfig[]>(DEFAULT_QUICK_CONTROLS);
  const [selectedId, setSelectedId] = useState<string>('qc_lights');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loaded = parseQuickControls(data?.config?.quick_controls_json);
      setItems(loaded.map((item) => ({ ...item, device_ids: [...(item.device_ids || [])] })));
      if (initialControlId && loaded.some((i) => i.id === initialControlId)) {
        setSelectedId(initialControlId);
      } else {
        setSelectedId(loaded[0]?.id || 'qc_lights');
      }
      setDeviceSearch('');
      setErrorMsg(null);
    }
  }, [isOpen, initialControlId, data?.config?.quick_controls_json]);

  const selectedItem = items.find((i) => i.id === selectedId) || items[0];

  const autoMatchedDevices = useMemo(() => {
    if (!selectedItem) return [];
    return getDevicesForQuickControl({ ...selectedItem, device_ids: [] }, allDevices);
  }, [selectedItem, allDevices]);

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    return allDevices.filter((dev) => {
      if (!q) return true;
      const roomName = allRooms.find((r) => r.id === dev.room_id)?.name || '';
      const role = getDeviceRoleCategory(dev);
      return (
        dev.name.toLowerCase().includes(q) ||
        roomName.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q) ||
        (dev.entity_id || '').toLowerCase().includes(q)
      );
    });
  }, [allDevices, allRooms, deviceSearch]);

  if (!isOpen) return null;

  const updateSelected = (patch: Partial<QuickControlConfig>) => {
    if (!selectedItem) return;
    setItems((prev) => prev.map((it) => (it.id === selectedItem.id ? { ...it, ...patch } : it)));
  };

  const moveItem = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    setItems(copy);
  };

  const handleAddCustom = () => {
    const newId = `qc_custom_${Date.now().toString(36)}`;
    const newItem: QuickControlConfig = {
      id: newId,
      category: 'custom',
      label: 'Custom Group',
      subtitle: 'Selected devices',
      icon: 'Zap',
      enabled: true,
      device_ids: [],
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newId);
  };

  const handleDeleteCustom = (id: string) => {
    if (items.length <= 1) return;
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || '');
    }
  };

  const handleToggleDevice = (devId: string) => {
    if (!selectedItem) return;
    const currentIds = selectedItem.device_ids || [];
    // If transitioning from auto-detect mode to custom selection, seed with current toggle
    const exists = currentIds.includes(devId);
    const nextIds = exists ? currentIds.filter((id) => id !== devId) : [...currentIds, devId];
    updateSelected({ device_ids: nextIds });
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Reset all Quick Controls back to factory defaults?')) return;
    setItems(DEFAULT_QUICK_CONTROLS.map((i) => ({ ...i, device_ids: [] })));
    setSelectedId(DEFAULT_QUICK_CONTROLS[0].id);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await ApiService.updateConfig({
        quick_controls_json: JSON.stringify(items),
      });
      await refreshBootstrap();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save Quick Controls');
    } finally {
      setSaving(false);
    }
  };

  const isCustomSelection = selectedItem && selectedItem.device_ids && selectedItem.device_ids.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#191A1D] border border-[#383A3E] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#383A3E] flex items-center justify-between bg-[#111214]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#191A1D] border border-[#383A3E] flex items-center justify-center text-white">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#F5F5F5]">Customize Quick Controls</h3>
              <p className="text-xs text-[#A6A6A6] mt-0.5">
                Configure dashboard cards, reorder tiles, and assign ACs, lights, fans, or switches
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

        {/* Body Split Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel: Card List */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#383A3E] bg-[#141518] p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777]">
                Dashboard Cards ({items.filter((i) => i.enabled).length}/{items.length} Active)
              </span>
            </div>

            <div className="space-y-1.5 flex-1">
              {items.map((item, idx) => {
                const Icon = QUICK_CONTROL_ICON_MAP[item.icon] || Power;
                const isSelected = selectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#202226] border-white/40 text-white shadow-sm'
                        : 'bg-[#191A1D]/60 border-[#383A3E]/60 text-[#A6A6A6] hover:text-white hover:border-[#383A3E]'
                    } ${!item.enabled ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{item.label}</div>
                        <div className="text-[10px] font-mono text-[#777777] truncate">
                          {item.device_ids.length > 0 ? `${item.device_ids.length} assigned` : 'Auto-match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-[#A6A6A6]"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-[#A6A6A6]"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddCustom}
              className="w-full py-2 rounded-xl bg-[#191A1D] hover:bg-[#202226] border border-dashed border-[#383A3E] hover:border-white/40 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Quick Control
            </button>
          </div>

          {/* Right Panel: Selected Card Editor */}
          {selectedItem && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Enable & Delete Row */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#111214] border border-[#383A3E]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="qcEnabled"
                    checked={selectedItem.enabled}
                    onChange={(e) => updateSelected({ enabled: e.target.checked })}
                    className="rounded bg-[#191A1D] border-[#383A3E] text-cyan-400 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="qcEnabled" className="cursor-pointer select-none">
                    <span className="text-xs font-bold text-white block">Show card on Dashboard</span>
                    <span className="text-[10px] text-[#777777]">Uncheck to hide this quick control from overview</span>
                  </label>
                </div>

                {selectedItem.category === 'custom' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustom(selectedItem.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>

              {/* Label, Subtitle, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#A6A6A6] mb-1">Card Title</label>
                  <input
                    type="text"
                    value={selectedItem.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    className="w-full bg-[#111214] border border-[#383A3E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#A6A6A6] mb-1">Fallback Subtitle</label>
                  <input
                    type="text"
                    value={selectedItem.subtitle}
                    onChange={(e) => updateSelected({ subtitle: e.target.value })}
                    className="w-full bg-[#111214] border border-[#383A3E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#A6A6A6] mb-1">Behavior Category</label>
                  <select
                    value={selectedItem.category}
                    onChange={(e) => updateSelected({ category: e.target.value as QuickControlCategory })}
                    className="w-full bg-[#111214] border border-[#383A3E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#111214]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-[11px] font-semibold text-[#A6A6A6] mb-1.5">Card Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(QUICK_CONTROL_ICON_MAP).map(([key, IconComp]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSelected({ icon: key })}
                      className={`p-2 rounded-xl border transition-all ${
                        selectedItem.icon === key
                          ? 'bg-white text-[#090A0C] border-white shadow-sm'
                          : 'bg-[#111214] text-[#A6A6A6] border-[#383A3E] hover:text-white'
                      }`}
                      title={key}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Device Assignment Section */}
              <div className="space-y-3 pt-2 border-t border-[#383A3E]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">Controlled Devices Assignment</h4>
                    <p className="text-[11px] text-[#777777]">
                      Auto-detect devices by type/name, or explicitly check devices controlled by "{selectedItem.label}"
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#111214] p-1 rounded-xl border border-[#383A3E] text-[11px]">
                    <button
                      type="button"
                      onClick={() => updateSelected({ device_ids: [] })}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        !isCustomSelection ? 'bg-white text-[#090A0C]' : 'text-[#A6A6A6] hover:text-white'
                      }`}
                    >
                      Auto-Detect ({autoMatchedDevices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCustomSelection && autoMatchedDevices.length > 0) {
                          updateSelected({ device_ids: autoMatchedDevices.map((d) => d.id) });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        isCustomSelection ? 'bg-cyan-400 text-slate-950' : 'text-[#A6A6A6] hover:text-white'
                      }`}
                    >
                      Manual Selection ({selectedItem.device_ids.length})
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter devices by name, room, or entity..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="w-full bg-[#111214] border border-[#383A3E] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-[#777777] focus:outline-none focus:border-white/40"
                  />
                </div>

                {/* Device Checklist */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {filteredDevices.map((dev: Device) => {
                    const roomName = allRooms.find((r) => r.id === dev.room_id)?.name || 'Unassigned';
                    const role = getDeviceRoleCategory(dev);
                    const isAutoMatched = autoMatchedDevices.some((d) => d.id === dev.id);
                    const isChecked = isCustomSelection
                      ? selectedItem.device_ids.includes(dev.id)
                      : isAutoMatched;

                    return (
                      <div
                        key={dev.id}
                        onClick={() => {
                          if (!isCustomSelection) {
                            // Seed from current auto-matched list when clicking in auto mode
                            const baseIds = autoMatchedDevices.map((d) => d.id);
                            const nextIds = baseIds.includes(dev.id)
                              ? baseIds.filter((id) => id !== dev.id)
                              : [...baseIds, dev.id];
                            updateSelected({ device_ids: nextIds });
                          } else {
                            handleToggleDevice(dev.id);
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#202226] border-cyan-500/40 text-white'
                            : 'bg-[#111214]/60 border-[#383A3E]/60 text-[#A6A6A6] hover:border-[#383A3E]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              isChecked
                                ? 'bg-cyan-400 border-cyan-400 text-slate-950'
                                : 'border-[#383A3E] bg-[#191A1D]'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate">{dev.name}</span>
                            <span className="text-[10px] font-mono text-[#777777] block truncate">
                              {roomName} {dev.entity_id ? `• ${dev.entity_id}` : ''}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border shrink-0 ${
                            ROLE_BADGE_COLORS[role] || ROLE_BADGE_COLORS.sensor
                          }`}
                        >
                          {role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#383A3E] bg-[#111214]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-[#A6A6A6] hover:text-white border border-[#383A3E] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
            </button>
            {onOpenAdminDevices && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminDevices();
                }}
                className="px-3 py-2 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-cyan-400 border border-[#383A3E] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Manage Hardware Devices
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A6A6A6] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-white hover:bg-slate-100 text-[#090A0C] text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Quick Controls'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
