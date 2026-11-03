import React, { useState } from 'react';
import {
  Radio,
  Lock,
  Unlock,
  Fan,
  Star,
  Battery,
  CheckCircle2,
  AlertCircle,
  Wind,
  Thermometer,
  Droplets,
  Zap,
  Gauge,
  Activity,
  RotateCw,
  Power,
  ShieldCheck,
} from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
import { useBootstrap } from '../../context/BootstrapContext';
import { ApiService } from '../../services/api';

export const PresenceSensorTile: React.FC<{ device: Device }> = ({ device }) => {
  const { state, attributes } = useEntity(device.entity_id, device.ha_hub_id);
  const isOccupied = state === 'on' || state === 'detected';

  return (
    <div className={`relative rounded-2xl p-4 transition-all tile-hover border ${
      isOccupied
        ? 'glass-panel-glow border-emerald-500/40 shadow-glow-emerald'
        : 'glass-panel border-white/10 opacity-80'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center ${
            isOccupied ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald' : 'bg-slate-800 text-slate-400'
          }`}>
            <Radio className="w-5 h-5" />
            {isOccupied && <span className="absolute inset-0 rounded-xl border-2 border-emerald-400 animate-radar pointer-events-none" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isOccupied ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isOccupied ? 'OCCUPIED' : 'CLEAR'}
              </span>
            </div>
          </div>
        </div>

        <span className="text-[10px] font-mono text-slate-400">
          {attributes.last_detected ? new Date(attributes.last_detected).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
        </span>
      </div>
    </div>
  );
};

export const ExhaustFanTile: React.FC<{ device: Device }> = ({ device }) => {
  const { state, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();
  const isOn = state === 'on';

  const toggle = () => {
    const domain = device.entity_id ? device.entity_id.split('.')[0] : 'switch';
    callService(domain, isOn ? 'turn_off' : 'turn_on');
  };

  return (
    <div
      onClick={toggle}
      className={`relative rounded-2xl p-4 transition-all cursor-pointer tile-hover border select-none ${
        isOn ? 'glass-panel-glow border-cyan-500/40' : 'glass-panel border-white/10 opacity-80'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            isOn ? 'bg-cyan-500 text-slate-950 shadow-glow' : 'bg-slate-800 text-slate-400'
          }`}>
            <Fan className={`w-5 h-5 ${isOn ? 'animate-spin-slow' : ''}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-cyan-400' : 'text-slate-500'}`}>
              {isOn ? 'VENTILATING' : 'IDLE'}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(device.id);
          }}
          className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export const TtlockTile: React.FC<{ device: Device }> = ({ device }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const lockId = devConfig.lockId || device.entity_id;

  const handleUnlock = async () => {
    if (!lockId || loading) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await ApiService.unlockTtlock(lockId);
      if (res.ok) {
        setUnlocked(true);
        setMsg('Unlocked');
        setTimeout(() => setUnlocked(false), 5000);
      } else {
        setMsg(res.message || 'Failed');
      }
    } catch (err: any) {
      setMsg(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all tile-hover border ${
      unlocked ? 'glass-panel-glow border-emerald-500/40 shadow-glow-emerald' : 'glass-panel border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            unlocked ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald' : 'bg-slate-800 text-cyan-400'
          }`}>
            {unlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${unlocked ? 'text-emerald-400' : 'text-slate-400'}`}>
                {unlocked ? 'ACCESS GRANTED' : 'SECURED'}
              </span>
              {msg && <span className="text-[10px] text-cyan-300">({msg})</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
          <Battery className="w-3.5 h-3.5 text-emerald-400" /> 95%
        </div>
      </div>

      <button
        onClick={handleUnlock}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-brand-600 hover:from-cyan-500 hover:to-brand-500 active:scale-95 text-white text-xs font-bold tracking-wider shadow-glow transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="animate-spin text-white">⟳ Unlocking...</span>
        ) : (
          <>
            <Unlock className="w-4 h-4" /> 1-Click Remote Unlock
          </>
        )}
      </button>
    </div>
  );
};

export const EnvironmentalSensorTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();
  const { attributes } = useEntity(device.entity_id, device.ha_hub_id);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const temp = liveState.temperature ?? attributes.temperature;
  const humidity = liveState.humidity ?? attributes.humidity;
  const co2 = liveState.co2 ?? attributes.co2;
  const voc = liveState.voc ?? attributes.voc;
  const formaldehyd = liveState.formaldehyd ?? attributes.formaldehyd;
  const lqi = liveState.linkquality;

  const co2Num = typeof co2 === 'number' ? co2 : parseFloat(co2);
  const co2Level = !isNaN(co2Num)
    ? co2Num < 800
      ? { label: 'OPTIMAL', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' }
      : co2Num < 1200
      ? { label: 'MODERATE', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' }
      : { label: 'POOR (VENTILATE)', color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' }
    : null;

  return (
    <div className="relative rounded-2xl p-4 glass-panel border border-white/10 tile-hover transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-glow">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              {co2Level ? (
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border ${co2Level.color}`}>
                  {co2Level.label}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">AIR MONITOR</span>
              )}
              {lqi !== undefined && (
                <span className="text-[9px] font-mono text-slate-500">LQI {lqi}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(device.id);
          }}
          className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5">
        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono mb-0.5">
            <Thermometer className="w-3 h-3 text-amber-400" /> TEMP
          </div>
          <span className="text-xs font-mono font-bold text-white">
            {temp !== undefined ? `${temp}°C` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono mb-0.5">
            <Droplets className="w-3 h-3 text-cyan-400" /> HUMIDITY
          </div>
          <span className="text-xs font-mono font-bold text-white">
            {humidity !== undefined ? `${humidity}%` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono mb-0.5">
            <Activity className="w-3 h-3 text-emerald-400" /> CO2
          </div>
          <span className="text-xs font-mono font-bold text-white">
            {co2 !== undefined ? `${co2} ppm` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono mb-0.5">
            <Gauge className="w-3 h-3 text-purple-400" /> VOC / HCHO
          </div>
          <span className="text-xs font-mono font-bold text-white">
            {voc !== undefined ? `${voc} ppb` : formaldehyd !== undefined ? `${formaldehyd} µg` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const EnergyMeterTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState, setZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();
  const { attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const power = liveState.power_a ?? liveState.power ?? attributes.power;
  const voltage = liveState.voltage_a ?? liveState.voltage ?? attributes.voltage;
  const current = liveState.current_a ?? liveState.current ?? attributes.current;
  const energy = liveState.energy ?? attributes.energy;
  const rawState = liveState.state ?? 'ON';
  const isOn = String(rawState).toUpperCase() === 'ON';
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (toggling) return;
    setToggling(true);
    const targetState = isOn ? 'OFF' : 'ON';
    try {
      // 1. Try direct Z2M first
      if (z2mKey) {
        await setZ2mState(z2mKey, { state: targetState });
      }
      // 2. Also try Home Assistant entity if mapped
      if (device.entity_id) {
        const domain = device.entity_id.split('.')[0] || 'switch';
        await callService(domain, isOn ? 'turn_off' : 'turn_on', { entity_id: device.entity_id }).catch(() => {});
      }
    } catch (_) {}
    finally {
      setTimeout(() => setToggling(false), 500);
    }
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all tile-hover border space-y-3 ${
      isOn ? 'glass-panel border-cyan-500/30' : 'glass-panel border-white/10 opacity-75'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            isOn ? 'bg-amber-500 text-slate-950 shadow-glow' : 'bg-slate-800 text-slate-400'
          }`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isOn ? 'BREAKER ACTIVE' : 'BREAKER OFF'}
              </span>
              {liveState.linkquality !== undefined && (
                <span className="text-[9px] font-mono text-slate-500">LQI {liveState.linkquality}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
              isOn
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {toggling ? '...' : isOn ? 'TRIP / OFF' : 'TURN ON'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Electrical Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5">
        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <span className="text-[10px] font-mono text-amber-400 block mb-0.5">POWER (W)</span>
          <span className="text-sm font-mono font-bold text-white">
            {power !== undefined ? `${power} W` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <span className="text-[10px] font-mono text-cyan-400 block mb-0.5">VOLTAGE (V)</span>
          <span className="text-sm font-mono font-bold text-white">
            {voltage !== undefined ? `${voltage} V` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <span className="text-[10px] font-mono text-indigo-400 block mb-0.5">CURRENT (A)</span>
          <span className="text-sm font-mono font-bold text-white">
            {current !== undefined ? `${current} A` : '--'}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2.5 border border-white/5">
          <span className="text-[10px] font-mono text-emerald-400 block mb-0.5">TOTAL ENERGY</span>
          <span className="text-sm font-mono font-bold text-white">
            {energy !== undefined ? `${energy} kWh` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const SmartKnobTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const battery = liveState.battery;
  const action = liveState.action;
  const operationMode = liveState.operation_mode;

  return (
    <div className="relative rounded-2xl p-4 glass-panel border border-white/10 tile-hover transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shadow-glow">
            <RotateCw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-purple-300 uppercase font-bold">SMART ROTARY KNOB</span>
              {action && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-mono uppercase font-bold animate-pulse">
                  {action}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {battery !== undefined && (
            <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
              <Battery className="w-3.5 h-3.5 text-emerald-400" /> {battery}%
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs font-mono text-slate-400">
        <span>Operation Mode: <strong className="text-slate-200">{operationMode || 'Command'}</strong></span>
        <span>Last Trigger: <strong className="text-cyan-400">{action || 'Standby'}</strong></span>
      </div>
    </div>
  );
};
