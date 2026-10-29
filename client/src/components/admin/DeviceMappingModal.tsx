import React, { useState, useEffect } from 'react';
import { X, Search, Check, Cpu, Plus, Sparkles, Sliders, Radio } from 'lucide-react';
import type { Device, DeviceType, HaHub, IrProfile, Room } from '../../types';
import { ApiService } from '../../services/api';

interface DeviceMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  rooms?: Room[];
  hubs: HaHub[];
  irProfiles: IrProfile[];
  onSave: (device: Partial<Device>) => Promise<void>;
  initialDevice?: Device | null;
  onOpenIrEditor?: () => void;
}

export const DeviceMappingModal: React.FC<DeviceMappingModalProps> = ({
  isOpen,
  onClose,
  roomId,
  rooms = [],
  hubs,
  irProfiles,
  onSave,
  initialDevice,
  onOpenIrEditor,
}) => {
  const [targetRoomId, setTargetRoomId] = useState<string>(initialDevice?.room_id || roomId || (rooms[0]?.id || ''));
  const [selectedHubId, setSelectedHubId] = useState<string>(initialDevice?.ha_hub_id || hubs[0]?.id || '');
  const [deviceType, setDeviceType] = useState<DeviceType>(initialDevice?.type || 'switch_light');
  const [name, setName] = useState(initialDevice?.name || '');
  const [selectedEntityId, setSelectedEntityId] = useState(initialDevice?.entity_id || '');
  const [z2mFriendlyName, setZ2mFriendlyName] = useState(initialDevice?.z2m_friendly_name || '');
  const [showOnDashboard, setShowOnDashboard] = useState(initialDevice?.show_on_default_dashboard === 1);

  // Config fields
  const [maxWattage, setMaxWattage] = useState(18);
  const [irProfileId, setIrProfileId] = useState(irProfiles[0]?.id || '');
  const [upEntityId, setUpEntityId] = useState('');
  const [downEntityId, setDownEntityId] = useState('');
  const [travelMs, setTravelMs] = useState(20000);
  const [lockId, setLockId] = useState('');

  // Discovered HA entities
  const [entities, setEntities] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialDevice) {
      setSelectedHubId(initialDevice.ha_hub_id || hubs[0]?.id || '');
      setTargetRoomId(initialDevice.room_id || roomId || (rooms[0]?.id || ''));
      setDeviceType(initialDevice.type);
      setName(initialDevice.name);
      setSelectedEntityId(initialDevice.entity_id || '');
      setZ2mFriendlyName(initialDevice.z2m_friendly_name || '');
      setShowOnDashboard(initialDevice.show_on_default_dashboard === 1);

      try {
        const cfg = JSON.parse(initialDevice.config_json || '{}');
        if (cfg.max_wattage) setMaxWattage(cfg.max_wattage);
        if (cfg.ir_profile_id) setIrProfileId(cfg.ir_profile_id);
        if (cfg.up_entity_id) setUpEntityId(cfg.up_entity_id);
        if (cfg.down_entity_id) setDownEntityId(cfg.down_entity_id);
        if (cfg.travel_ms) setTravelMs(cfg.travel_ms);
        if (cfg.lockId) setLockId(cfg.lockId);
      } catch (_) {}
    } else {
      setTargetRoomId(roomId || (rooms[0]?.id || ''));
      setName('');
      setSelectedEntityId('');
    }
  }, [initialDevice, hubs, roomId, rooms]);

  // Fetch entities whenever hub changes
  useEffect(() => {
    if (selectedHubId) {
      setLoadingEntities(true);
      ApiService.discoverHaEntities(selectedHubId)
        .then((res) => {
          setEntities(res.entities || []);
        })
        .catch((err) => {
          console.warn('[Discovery] Failed:', err);
          setEntities([]);
        })
        .finally(() => setLoadingEntities(false));
    }
  }, [selectedHubId]);

  if (!isOpen) return null;

  // Filter entities according to search and device type suggestion
  const filteredEntities = entities.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchQuery = e.entity_id.toLowerCase().includes(q) || (e.friendly_name && e.friendly_name.toLowerCase().includes(q));
    return matchQuery;
  });

  const handleSelectEntity = (ent: any) => {
    setSelectedEntityId(ent.entity_id);
    if (!name) {
      setName(ent.friendly_name || ent.entity_id);
    }

    // Auto-detect device type if not explicitly set
    if (!initialDevice) {
      if (ent.domain === 'light') {
        setDeviceType('dimmable_light');
      } else if (ent.domain === 'climate') {
        setDeviceType('climate');
      } else if (ent.domain === 'cover') {
        setDeviceType('cover');
      } else if (ent.domain === 'binary_sensor') {
        setDeviceType('presence_sensor');
      } else if (ent.domain === 'text' && ent.entity_id.includes('ir_code')) {
        setDeviceType('ac_ir');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const finalRoomId = targetRoomId || roomId || (rooms[0]?.id || '');
    if (!finalRoomId) {
      alert('Please create or select a room first.');
      return;
    }

    const config: Record<string, any> = {};
    if (deviceType === 'dimmable_light') {
      config.max_wattage = maxWattage;
    } else if (deviceType === 'ac_ir') {
      config.ir_profile_id = irProfileId;
    } else if (deviceType === 'blinds_relay') {
      config.up_entity_id = upEntityId;
      config.down_entity_id = downEntityId;
      config.travel_ms = travelMs;
    } else if (deviceType === 'ttlock') {
      config.lockId = lockId || selectedEntityId;
    }

    await onSave({
      id: initialDevice?.id,
      room_id: finalRoomId,
      ha_hub_id: selectedHubId || null,
      type: deviceType,
      name,
      subtitle: deviceType,
      entity_id: selectedEntityId || null,
      z2m_friendly_name: z2mFriendlyName.trim() || null,
      config_json: JSON.stringify(config),
      show_on_default_dashboard: showOnDashboard ? 1 : 0,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] glass-panel rounded-2xl border border-white/20 p-6 overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">
              {initialDevice ? 'Edit Device Mapping' : 'Add New Device'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 flex-1">
          {/* Target Room selector if multiple rooms available */}
          {rooms && rooms.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Room</label>
              <select
                value={targetRoomId || roomId}
                onChange={(e) => setTargetRoomId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Hub & Device Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Home Assistant Hub</label>
              <select
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
              >
                {hubs.map((h) => (
                  <option key={h.id} value={h.id} className="bg-slate-900 text-white">
                    {h.name} ({h.local_url})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Device Control Type</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white capitalize"
              >
                <option value="switch_light" className="bg-slate-900">On/Off Switch / Light</option>
                <option value="dimmable_light" className="bg-slate-900">Dimmable / Tunable Light</option>
                <option value="ac_ir" className="bg-slate-900">Zigbee2MQTT AC IR Blaster</option>
                <option value="climate" className="bg-slate-900">Native Climate AC</option>
                <option value="blinds_relay" className="bg-slate-900">Motorized Blinds (Dual Relays)</option>
                <option value="cover" className="bg-slate-900">Native Cover Blinds</option>
                <option value="presence_sensor" className="bg-slate-900">Presence / Occupancy Sensor</option>
                <option value="exhaust_fan" className="bg-slate-900">Exhaust / Ventilation Fan</option>
                <option value="ttlock" className="bg-slate-900">TTLock Smart Lock</option>
              </select>
            </div>
          </div>

          {/* Device Friendly Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name in UI</label>
            <input
              type="text"
              required
              placeholder="e.g. Executive Desk Light, Ceiling AC, Door Sensor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Live Searchable HA Entity Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Live Home Assistant Entity ({loadingEntities ? 'Scanning hub...' : `${entities.length} entities available`})
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search entities by name or entity_id (e.g. light.0x5c..., switch.meeting...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-1 divide-y divide-white/5">
              {filteredEntities.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  {loadingEntities ? 'Querying live WebSocket states...' : 'No matching entities found on this hub'}
                </div>
              ) : (
                filteredEntities.slice(0, 50).map((ent) => {
                  const isSelected = selectedEntityId === ent.entity_id;
                  return (
                    <div
                      key={ent.entity_id}
                      onClick={() => handleSelectEntity(ent)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold block truncate text-white">{ent.friendly_name}</span>
                        <span className="font-mono text-[10px] text-slate-400 truncate block">{ent.entity_id}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-black/60 font-mono text-[9px] text-slate-400">
                          {ent.domain}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {selectedEntityId && (
              <p className="mt-1 text-[11px] font-mono text-cyan-400 truncate">
                Selected: <span className="font-bold">{selectedEntityId}</span>
              </p>
            )}
          </div>

          {/* Zigbee2MQTT Direct Friendly Name / Topic */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Zigbee2MQTT Friendly Name (Direct Control / Failover)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Optional</span>
            </div>
            <input
              type="text"
              placeholder="e.g. 0x00158d0006f12345 or office_ceiling_light"
              value={z2mFriendlyName}
              onChange={(e) => setZ2mFriendlyName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              If Home Assistant goes down, this device continues working seamlessly over local MQTT.
            </p>
          </div>

          {/* Type-Specific Configurations */}
          {deviceType === 'dimmable_light' && (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Max Wattage (for power gauge)</label>
              <input
                type="number"
                value={maxWattage}
                onChange={(e) => setMaxWattage(Number(e.target.value))}
                className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
          )}

          {deviceType === 'ac_ir' && (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Base64 IR Command Profile</label>
                {onOpenIrEditor && (
                  <button
                    type="button"
                    onClick={onOpenIrEditor}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Open IR Learner / Editor
                  </button>
                )}
              </div>
              <select
                value={irProfileId}
                onChange={(e) => setIrProfileId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
              >
                {irProfiles.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name} ({p.brand || 'Universal'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {deviceType === 'blinds_relay' && (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Up Switch Entity</label>
                  <input
                    type="text"
                    placeholder="e.g. switch.blinds_l1"
                    value={upEntityId}
                    onChange={(e) => setUpEntityId(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Down Switch Entity</label>
                  <input
                    type="text"
                    placeholder="e.g. switch.blinds_l2"
                    value={downEntityId}
                    onChange={(e) => setDownEntityId(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Travel Duration (ms)</label>
                <input
                  type="number"
                  value={travelMs}
                  onChange={(e) => setTravelMs(Number(e.target.value))}
                  className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {deviceType === 'ttlock' && (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
              <label className="block text-xs font-semibold text-slate-300 mb-1">TTLock Lock ID</label>
              <input
                type="text"
                placeholder="e.g. 1294821"
                value={lockId}
                onChange={(e) => setLockId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
          )}

          {/* Show on Default Dashboard */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showOnDash"
              checked={showOnDashboard}
              onChange={(e) => setShowOnDashboard(e.target.checked)}
              className="rounded bg-slate-800 border-white/20 text-cyan-400 focus:ring-0"
            />
            <label htmlFor="showOnDash" className="text-xs text-slate-300 select-none">
              Pin to Main Overview Dashboard
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-brand-500 shadow-glow hover:opacity-90 active:scale-95 transition-all"
            >
              Save Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
