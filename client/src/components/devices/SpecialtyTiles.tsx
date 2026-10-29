import React, { useState } from 'react';
import { Radio, Lock, Unlock, Fan, Star, Battery, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
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
