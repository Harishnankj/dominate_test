import React, { useState } from 'react';
import { Lock, Unlock, Battery, Radio, ShieldCheck, RefreshCw, Key } from 'lucide-react';
import { ApiService } from '../services/api';

export const LockTestingPage: React.FC = () => {
  const [targetLockId, setTargetLockId] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTestUnlock = async (idToUnlock?: string) => {
    const id = idToUnlock || targetLockId;
    if (!id) {
      alert('Please enter or select a Lock ID');
      return;
    }

    setUnlocking(true);
    setResult(null);
    try {
      const res = await ApiService.unlockTtlock(id);
      setResult(res);
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto animate-in fade-in">
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-glow">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">TTLock Smart Door Gateway Testing</h2>
            <p className="text-xs text-slate-400">Direct Remote Unlock Signals & Diagnostic Testing</p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-cyan-400" /> Manual Door Unlock Test
        </h3>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Target Lock ID (e.g. 1928374)"
            value={targetLockId}
            onChange={(e) => setTargetLockId(e.target.value)}
            className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs text-white font-mono"
          />
          <button
            onClick={() => handleTestUnlock()}
            disabled={unlocking || !targetLockId}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-2 disabled:opacity-40"
          >
            {unlocking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Send Unlock Signal
          </button>
        </div>

        {result && (
          <div className={`p-4 rounded-xl border text-xs font-mono animate-in fade-in ${
            result.ok
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
            <span className="font-bold">{result.ok ? '✓ Signal Delivered: ' : '✗ Error: '}</span>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
};
