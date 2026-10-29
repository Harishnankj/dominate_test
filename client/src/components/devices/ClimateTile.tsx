import React from 'react';
import { Thermometer, Star, ChevronDown, ChevronUp } from 'lucide-react';
import type { Device } from '../../types';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';

export const ClimateTile: React.FC<{ device: Device }> = ({ device }) => {
  const { state, attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();

  const currentTemp = attributes.current_temperature ?? 24;
  const targetTemp = attributes.temperature ?? 22;
  const isOff = state === 'off';

  const adjustTemp = (delta: number) => {
    const next = targetTemp + delta;
    callService('climate', 'set_temperature', { temperature: next });
  };

  const setHvacMode = (mode: string) => {
    callService('climate', 'set_hvac_mode', { hvac_mode: mode });
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all tile-hover border ${
      !isOff ? 'glass-panel-glow border-cyan-500/40 shadow-glow' : 'glass-panel border-white/10 opacity-80 hover:opacity-100'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${!isOff ? 'bg-cyan-500 text-slate-950 shadow-glow' : 'bg-slate-800 text-slate-400'}`}>
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">{device.name}</h4>
            <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
              Current: {currentTemp}°C • {state.toUpperCase()}
            </span>
          </div>
        </div>
        <button onClick={() => toggleFavorite(device.id)} className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}>
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between bg-slate-900/60 rounded-xl p-3 border border-white/5 my-2">
        <div>
          <span className="text-[10px] font-mono text-slate-400">TARGET</span>
          <div className="text-3xl font-extrabold font-mono text-white">
            {targetTemp}<span className="text-lg text-cyan-400">°C</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => adjustTemp(-0.5)} className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center">
            <ChevronDown className="w-5 h-5" />
          </button>
          <button onClick={() => adjustTemp(0.5)} className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-2">
        {['off', 'cool', 'heat', 'auto'].map((m) => (
          <button
            key={m}
            onClick={() => setHvacMode(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase ${
              state === m ? 'bg-cyan-500 text-slate-950 shadow-glow' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
};

export const CoverTile: React.FC<{ device: Device }> = ({ device }) => {
  const { state, attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();

  const isOpen = state === 'open';

  return (
    <div className="relative glass-panel rounded-2xl p-4 border border-white/10 tile-hover">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{device.name}</h4>
          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">{state}</span>
        </div>
        <button onClick={() => toggleFavorite(device.id)} className={`p-1.5 rounded-lg ${isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600'}`}>
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => callService('cover', 'open_cover')} className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400">
          Open
        </button>
        <button onClick={() => callService('cover', 'stop_cover')} className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-400">
          Stop
        </button>
        <button onClick={() => callService('cover', 'close_cover')} className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400">
          Close
        </button>
      </div>
    </div>
  );
};
