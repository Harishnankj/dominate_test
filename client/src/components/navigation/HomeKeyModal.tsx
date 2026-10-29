import React, { useState } from 'react';
import { KeyRound, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const HomeKeyModal: React.FC = () => {
  const { verifyHomeKey, homeKeyVerified } = useAuth();
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (homeKeyVerified) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setVerifying(true);
    setError(false);
    const valid = await verifyHomeKey(keyInput.trim());
    setVerifying(false);

    if (!valid) {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 border border-cyan-500/30 text-center shadow-2xl space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-glow">
          <KeyRound className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-white">Office Security Gate</h2>
          <p className="text-xs text-slate-400 mt-1">
            This office OS requires entering the building HomeKey to authenticate LAN access on this device.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Paste your HomeKey here..."
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setError(false);
            }}
            className="w-full glass-input rounded-xl px-4 py-3 text-xs text-center font-mono text-cyan-300"
          />

          {error && (
            <p className="text-xs text-rose-400 font-mono flex items-center justify-center gap-1">
              <ShieldAlert className="w-4 h-4" /> Invalid HomeKey. Please check with your administrator.
            </p>
          )}

          <button
            type="submit"
            disabled={verifying || !keyInput.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {verifying ? 'Verifying...' : 'Unlock Building Access'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
