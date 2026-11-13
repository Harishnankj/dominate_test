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
      <div className="bg-[#191A1D] rounded-2xl p-4 border border-[#383A3E] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#F5F5F5]">Smart Scenes & Local Automations</h2>
            <p className="text-xs text-[#A6A6A6]">One-tap architectural presets & scheduled hardware routines</p>
          </div>
        </div>

        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-[#111214] hover:bg-[#202226] text-white border border-[#383A3E] hover:border-white/40 font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Manage in Admin Studio
          </button>
        )}
      </div>

      {/* Scenes List */}
      {automations.length === 0 ? (
        <div className="bg-[#191A1D] rounded-2xl p-12 text-center border border-dashed border-[#383A3E] space-y-3">
          <Wand2 className="w-10 h-10 text-[#777777] mx-auto" />
          <h3 className="text-sm font-bold text-[#F5F5F5]">No smart scenes or automations configured yet</h3>
          <p className="text-xs text-[#A6A6A6] max-w-sm mx-auto">
            Automations and scheduled routines can be created and managed in Admin Studio.
          </p>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs shadow-sm inline-flex items-center gap-2"
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
                className="bg-[#191A1D] rounded-2xl p-5 border border-[#383A3E] hover:border-[#4B4E54] flex flex-col justify-between gap-4 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-white shrink-0" />
                      {auto.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        auto.enabled
                          ? 'bg-[#22D68A]/10 text-[#22D68A] border border-[#22D68A]/30'
                          : 'bg-[#111214] text-[#777777] border border-[#383A3E]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${auto.enabled ? 'bg-[#22D68A]' : 'bg-[#777777]'}`} />
                      {auto.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111214] text-[#F5F5F5] border border-[#383A3E] flex items-center gap-1">
                      {tr.type === 'time' ? (
                        <>
                          <Clock className="w-3 h-3 text-[#F0B94D]" /> Daily at {tr.time}
                        </>
                      ) : tr.type === 'presence' ? (
                        <>
                          <Radio className="w-3 h-3 text-[#22D68A]" /> Sensor Trigger
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3 text-white" /> Manual Scene
                        </>
                      )}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111214] text-[#A6A6A6] border border-[#383A3E]">
                      {stepCount} {stepCount === 1 ? 'Action' : 'Actions'}
                    </span>

                    <span className="text-[10px] font-mono text-[#777777]">
                      {auto.last_run_at
                        ? `Ran ${new Date(auto.last_run_at).toLocaleTimeString()}`
                        : 'Standby'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#383A3E]/50 flex items-center justify-between">
                  <span className="text-[11px] text-[#A6A6A6]">
                    {auto.enabled ? 'Instant Local Trigger' : 'Paused in Admin Studio'}
                  </span>

                  <button
                    onClick={() => handleRunAutomation(auto.id)}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      isSuccess
                        ? 'bg-[#22D68A] text-slate-950 font-bold'
                        : 'bg-white text-slate-950 hover:bg-neutral-200 active:scale-95'
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
