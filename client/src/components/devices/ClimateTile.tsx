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
    <div className={`relative rounded-2xl p-4 transition-all duration-200 border ${
      !isOff
        ? 'bg-[#191A1D] border-white/40 shadow-sm'
        : 'bg-[#191A1D] border-[#383A3E] hover:border-[#4B4E54]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            !isOff ? 'bg-white text-slate-950 font-bold' : 'bg-[#111214] border border-[#383A3E] text-[#777777]'
          }`}>
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${!isOff ? 'bg-[#22D68A]' : 'bg-[#777777]'}`} />
              <span className="text-[10px] font-mono text-[#A6A6A6] uppercase font-bold">
                {currentTemp}°C • {state.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => toggleFavorite(device.id)}
          className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between bg-[#111214] rounded-xl p-3 border border-[#383A3E]/50 my-2">
        <div>
          <span className="text-[10px] font-mono text-[#A6A6A6]">TARGET TEMPERATURE</span>
          <div className="text-3xl font-extrabold font-mono text-white">
            {targetTemp}<span className="text-lg text-[#A6A6A6]">°C</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustTemp(-0.5)}
            className="w-10 h-10 rounded-xl bg-[#202226] border border-[#383A3E] hover:border-white/40 text-white flex items-center justify-center transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => adjustTemp(0.5)}
            className="w-10 h-10 rounded-xl bg-[#202226] border border-[#383A3E] hover:border-white/40 text-white flex items-center justify-center transition-colors"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-2">
        {['off', 'cool', 'heat', 'auto'].map((m) => (
          <button
            key={m}
            onClick={() => setHvacMode(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all ${
              state === m
                ? 'bg-white text-slate-950 font-bold shadow-sm'
                : 'bg-[#111214] border border-[#383A3E] text-[#A6A6A6] hover:text-white hover:border-white/30'
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
  const { state, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const { isFavorite, toggleFavorite } = useAuth();

  const isOpen = state === 'open';

  return (
    <div className="relative rounded-2xl p-4 bg-[#191A1D] border border-[#383A3E] hover:border-[#4B4E54] transition-all">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-[#F5F5F5]">{device.name}</h4>
          <span className={`text-[10px] font-mono uppercase font-bold ${isOpen ? 'text-[#22D68A]' : 'text-[#777777]'}`}>
            {state}
          </span>
        </div>
        <button
          onClick={() => toggleFavorite(device.id)}
          className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => callService('cover', 'open_cover')}
          className="py-2 rounded-xl bg-[#111214] border border-[#383A3E] hover:border-white/40 text-xs font-semibold text-white transition-colors"
        >
          Open
        </button>
        <button
          onClick={() => callService('cover', 'stop_cover')}
          className="py-2 rounded-xl bg-[#111214] border border-[#383A3E] hover:border-white/40 text-xs font-semibold text-[#A6A6A6] transition-colors"
        >
          Stop
        </button>
        <button
          onClick={() => callService('cover', 'close_cover')}
          className="py-2 rounded-xl bg-[#111214] border border-[#383A3E] hover:border-white/40 text-xs font-semibold text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
