import React, { useState } from 'react';
import {
  Wand2,
  Clock,
  Radio,
  Play,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';

interface ScenesPageProps {
  onOpenAdmin?: () => void;
}

export const ScenesPage: React.FC<ScenesPageProps> = ({ onOpenAdmin }) => {
  const { data } = useBootstrap();
  const { isAdmin } = useAuth();
  const automations = data?.automations || [];

  const [runningId, setRunningId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleRunAutomation = async (id: string) => {
    setRunningId(id);
    setSuccessId(null);
    try {
      const res = await ApiService.runAutomation(id);
      if (res.ok) {
        setSuccessId(id);
        setTimeout(() => setSuccessId(null), 3000);
      } else {
        alert('Automation failed to trigger');
      }
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-glow">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Smart Scenes & Local Automations</h2>
            <p className="text-xs text-slate-400">One-tap office scenes & scheduled local routines</p>
          </div>
        </div>

        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Manage in Admin Studio
          </button>
        )}
      </div>

      {/* Scenes List */}
      {automations.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-dashed border-white/10 space-y-3">
          <Wand2 className="w-10 h-10 text-cyan-400 mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-white">No smart scenes or automations configured yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Automations and scheduled routines can be created and managed in Admin Studio.
          </p>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow inline-flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Open Admin Studio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {automations.map((auto) => {
            let tr: any = {};
            try {
              tr = JSON.parse(auto.trigger_json || '{}');
            } catch (_) {}

            let stepCount = 0;
            try {
              const st = JSON.parse(auto.steps_json || auto.actions_json || '[]');
              stepCount = Array.isArray(st) ? st.length : 0;
            } catch (_) {}

            const isRunning = runningId === auto.id;
            const isSuccess = successId === auto.id;

            return (
              <div
                key={auto.id}
                className="glass-panel rounded-2xl p-5 border border-white/10 flex flex-col justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                      {auto.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                        auto.enabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-white/5'
                      }`}
                    >
                      {auto.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-white/5 flex items-center gap-1">
                      {tr.type === 'time' ? (
                        <>
                          <Clock className="w-3 h-3" /> Daily at {tr.time}
                        </>
                      ) : tr.type === 'presence' ? (
                        <>
                          <Radio className="w-3 h-3 text-emerald-400" /> Sensor Trigger
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3 text-indigo-400" /> Manual Scene
                        </>
                      )}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-white/5">
                      {stepCount} {stepCount === 1 ? 'Action' : 'Actions'}
                    </span>

                    <span className="text-[10px] font-mono text-slate-400">
                      {auto.last_run_at
                        ? `Ran ${new Date(auto.last_run_at).toLocaleTimeString()}`
                        : 'Not triggered yet'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {auto.enabled ? 'Ready to trigger' : 'Paused in Admin Studio'}
                  </span>

                  <button
                    onClick={() => handleRunAutomation(auto.id)}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      isSuccess
                        ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald'
                        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-glow active:scale-95'
                    }`}
                  >
                    {isRunning ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    {isRunning ? 'Activating...' : isSuccess ? 'Activated!' : 'Run Scene'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
