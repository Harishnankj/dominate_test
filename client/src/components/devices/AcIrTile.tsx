import React, { useState } from 'react';
import {
  Snowflake,
  Wind,
  Droplets,
  Power,
  Star,
  ChevronDown,
  ChevronUp,
  Leaf,
  RefreshCw,
} from 'lucide-react';
import type { Device } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';

interface AcIrTileProps {
  device: Device;
}

export const AcIrTile: React.FC<AcIrTileProps> = ({ device }) => {
  const { getVirtualState, setVirtualState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();

  // Load virtual state or defaults
  const savedState = getVirtualState(device.id) || {
    power: false,
    temp: 24,
    mode: 'cool',
    fan: 'auto',
    swing: false,
    saver: false,
  };

  const [state, setState] = useState(savedState);
  const [sending, setSending] = useState(false);

  const sendCommand = async (commandKey: string, nextState: typeof state) => {
    setState(nextState);
    setSending(true);
    try {
      await setVirtualState(device.id, nextState);
      await ApiService.sendAcIr(device.id, commandKey, nextState);
    } catch (err) {
      console.warn('[AcIrTile] Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const togglePower = () => {
    const nextPower = !state.power;
    const nextState = { ...state, power: nextPower };
    const cmd = nextPower ? 'on' : 'off';
    sendCommand(cmd, nextState);
  };

  const adjustTemp = (delta: number) => {
    const newTemp = Math.min(30, Math.max(16, state.temp + delta));
    if (newTemp === state.temp) return;
    const nextState = { ...state, temp: newTemp, power: true };
    sendCommand(`temp_${newTemp}`, nextState);
  };

  const setTempDirect = (t: number) => {
    const nextState = { ...state, temp: t, power: true };
    sendCommand(`temp_${t}`, nextState);
  };

  const setMode = (mode: 'cool' | 'dry' | 'fan') => {
    const nextState = { ...state, mode, power: true };
    sendCommand(`mode_${mode}`, nextState);
  };

  const setFan = (fan: 'auto' | '1' | '2' | '3') => {
    const nextState = { ...state, fan, power: true };
    sendCommand(`fan_${fan}`, nextState);
  };

  const toggleSwing = () => {
    const nextSwing = !state.swing;
    const nextState = { ...state, swing: nextSwing };
    sendCommand(nextSwing ? 'swing_on' : 'swing_off', nextState);
  };

  const toggleSaver = () => {
    const nextSaver = !state.saver;
    const nextState = { ...state, saver: nextSaver };
    sendCommand(nextSaver ? 'saver_on' : 'saver_off', nextState);
  };

  return (
    <div
      className={`relative rounded-2xl p-4 transition-all tile-hover border ${
        state.power
          ? 'glass-panel-glow border-cyan-500/40 shadow-glow'
          : 'glass-panel border-white/10 opacity-80 hover:opacity-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePower}
            disabled={sending}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              state.power
                ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 shadow-glow scale-105'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Power className="w-5 h-5" />
          </button>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide leading-tight">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${state.power ? 'text-cyan-400' : 'text-slate-500'}`}>
                {state.power ? `${state.temp}°C • ${state.mode.toUpperCase()}` : 'OFF'}
              </span>
              {sending && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
            </div>
          </div>
        </div>

        <button
          onClick={() => toggleFavorite(device.id)}
          className={`p-1.5 rounded-lg transition-colors ${
            isFavorite(device.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Temperature Display & Controls */}
      <div className="flex items-center justify-between bg-slate-900/60 rounded-xl p-3 border border-white/5 my-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-slate-400 tracking-wider">SETPOINT</span>
          <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {state.temp}
            <span className="text-lg text-cyan-400 font-sans">°C</span>
          </span>
        </div>

        {/* Up / Down Stepper */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustTemp(-1)}
            disabled={state.temp <= 16 || sending}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold text-lg border border-white/10"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => adjustTemp(1)}
            disabled={state.temp >= 30 || sending}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold text-lg border border-white/10"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Temp Preset Pills */}
      <div className="flex items-center justify-between gap-1.5 mb-3 overflow-x-auto pb-1">
        {[18, 20, 22, 24, 26, 28].map((t) => (
          <button
            key={t}
            onClick={() => setTempDirect(t)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              state.temp === t && state.power
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-glow'
                : 'bg-slate-800/80 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {t}°
          </button>
        ))}
      </div>

      {/* Mode Selectors */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <button
          onClick={() => setMode('cool')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            state.mode === 'cool' && state.power
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow'
              : 'bg-slate-800/60 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          <Snowflake className="w-3.5 h-3.5" /> Cool
        </button>
        <button
          onClick={() => setMode('dry')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            state.mode === 'dry' && state.power
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-glow'
              : 'bg-slate-800/60 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" /> Dry
        </button>
        <button
          onClick={() => setMode('fan')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            state.mode === 'fan' && state.power
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-glow'
              : 'bg-slate-800/60 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          <Wind className="w-3.5 h-3.5" /> Fan
        </button>
      </div>

      {/* Fan Speed & Extras */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        {/* Fan Speeds */}
        <div className="flex items-center gap-1">
          {(['auto', '1', '2', '3'] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => setFan(spd)}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all ${
                state.fan === spd && state.power
                  ? 'bg-cyan-500 text-slate-950 shadow-glow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {spd === 'auto' ? 'AUTO' : `F${spd}`}
            </button>
          ))}
        </div>

        {/* Swing & Eco Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleSwing}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all ${
              state.swing && state.power
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Swing
          </button>
          <button
            onClick={toggleSaver}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all ${
              state.saver && state.power
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Leaf className="w-3 h-3" /> Eco
          </button>
        </div>
      </div>
    </div>
  );
};
