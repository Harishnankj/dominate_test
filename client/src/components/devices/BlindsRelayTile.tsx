import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Square, Star, AlignJustify } from 'lucide-react';
import type { Device } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';

interface BlindsRelayTileProps {
  device: Device;
}

export const BlindsRelayTile: React.FC<BlindsRelayTileProps> = ({ device }) => {
  const { getVirtualState, setVirtualState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const travelMs = devConfig.travel_ms || 20000;

  const saved = getVirtualState(device.id) || { position: 100, action: 'stop', moving: false };
  const [position, setPosition] = useState(saved.position ?? 100);
  const [moving, setMoving] = useState(saved.moving ?? false);

  const handleAction = async (action: 'open' | 'close' | 'stop') => {
    if (action === 'open') {
      setMoving(true);
      setPosition(100);
    } else if (action === 'close') {
      setMoving(true);
      setPosition(0);
    } else {
      setMoving(false);
    }

    try {
      await ApiService.moveRelayBlinds(device.id, action);
      await setVirtualState(device.id, { position: action === 'open' ? 100 : action === 'close' ? 0 : position, action, moving: action !== 'stop' });
    } catch (err) {
      console.warn('[BlindsRelay] Move error:', err);
    }

    if (action !== 'stop') {
      setTimeout(() => {
        setMoving(false);
      }, travelMs);
    }
  };

  return (
    <div className="relative glass-panel rounded-2xl p-4 border border-white/10 tile-hover">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center">
            <AlignJustify className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide leading-tight">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                {moving ? 'MOVING...' : position > 0 ? `${position}% OPEN` : 'CLOSED'}
              </span>
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

      {/* Visual Blinds Graphic */}
      <div className="h-16 w-full bg-slate-950/80 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden border border-white/5 my-2">
        {[1, 2, 3, 4, 5].map((i) => {
          const slatOpen = position > (5 - i) * 20;
          return (
            <div
              key={i}
              className={`h-1.5 rounded transition-all duration-700 ${
                slatOpen ? 'bg-cyan-500/80 shadow-glow' : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>

      {/* Open, Stop, Close Controls */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        <button
          onClick={() => handleAction('open')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold border border-white/10"
        >
          <ArrowUp className="w-4 h-4 text-cyan-400" /> Open
        </button>
        <button
          onClick={() => handleAction('stop')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold border border-white/10"
        >
          <Square className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Stop
        </button>
        <button
          onClick={() => handleAction('close')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold border border-white/10"
        >
          <ArrowDown className="w-4 h-4 text-cyan-400" /> Close
        </button>
      </div>
    </div>
  );
};
