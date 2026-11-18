import React, { useState } from 'react';
import {
  Workflow,
  Clock,
  Radio,
  Play,
  CheckCircle2,
  RefreshCw,
  Power,
  Sliders,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';
import type { Automation } from '../types';

interface AutomationsPageProps {
  onOpenAdmin?: () => void;
  onNavigateToScenes?: () => void;
}

export const AutomationsPage: React.FC<AutomationsPageProps> = ({
  onOpenAdmin,
  onNavigateToScenes,
}) => {
  const { data, refreshBootstrap } = useBootstrap();
  const { isAdmin } = useAuth();
  const automations = data?.automations || [];

  const [testingId, setTestingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Filter automations (all automated rules or schedules)
  const scheduledAutomations = automations.filter((auto) => {
    try {
      const tr = JSON.parse(auto.trigger_json || '{}');
      return tr.type === 'time' || tr.type === 'presence' || !tr.type || tr.type !== 'manual';
    } catch {
      return true;
    }
  });

  const activeCount = scheduledAutomations.filter((a) => a.enabled).length;

  const handleTestRun = async (id: string) => {
    setTestingId(id);
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
      setTestingId(null);
    }
  };

  const handleToggleEnable = async (auto: Automation) => {
    setTogglingId(auto.id);
    try {
      const nextState = auto.enabled ? 0 : 1;
      await ApiService.updateAutomation(auto.id, { enabled: nextState });
      await refreshBootstrap();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const formatSchedule = (tr: any) => {
    if (tr.type === 'time') {
      const daysMap: Record<number, string> = {
        0: 'Sun',
        1: 'Mon',
        2: 'Tue',
        3: 'Wed',
        4: 'Thu',
        5: 'Fri',
        6: 'Sat',
      };
      if (Array.isArray(tr.days) && tr.days.length > 0 && tr.days.length < 7) {
        const dayNames = tr.days.map((d: number) => daysMap[d] || d).join(', ');
        return `${dayNames} at ${tr.time}`;
      }
      return `Daily at ${tr.time || '--:--'}`;
    }
    if (tr.type === 'presence') {
      return 'Motion / Presence Sensor';
    }
    return 'Event Triggered';
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Page Header */}
      <div className="bg-[#191A1D] rounded-2xl p-4 md:p-5 border border-[#383A3E] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111214] border border-[#383A3E] text-[#22D68A] flex items-center justify-center">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#F5F5F5]">Local Automations</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-[#22D68A]/10 text-[#22D68A] border border-[#22D68A]/30">
                {activeCount} ACTIVE
              </span>
            </div>
            <p className="text-xs text-[#A6A6A6]">
              Hands-free scheduled hardware routines & sensor rules running 100% locally
            </p>
          </div>
        </div>

        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-[#090A0C] font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Automation
          </button>
        )}
      </div>

      {/* Clarification banner between Automations and Scenes */}
      <div className="bg-[#191A1D]/60 rounded-xl p-3.5 border border-[#383A3E]/60 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#A6A6A6]">
          <span className="w-2 h-2 rounded-full bg-[#22D68A]" />
          <span>
            <strong className="text-[#F5F5F5]">Automations</strong> run automatically on a clock
            schedule or sensor event without human input.
          </span>
        </div>
        {onNavigateToScenes && (
          <button
            onClick={onNavigateToScenes}
            className="shrink-0 text-white hover:text-white/80 font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Switch to Scenes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Automations List */}
      {scheduledAutomations.length === 0 ? (
        <div className="bg-[#191A1D] rounded-2xl p-12 text-center border border-dashed border-[#383A3E] space-y-3">
          <Workflow className="w-10 h-10 text-[#777777] mx-auto" />
          <h3 className="text-sm font-bold text-[#F5F5F5]">No scheduled automations found</h3>
          <p className="text-xs text-[#A6A6A6] max-w-sm mx-auto">
            Create automated rules like scheduled AC shutoffs, evening lighting, or occupancy triggers in Admin Studio.
          </p>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs shadow-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Automation
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scheduledAutomations.map((auto) => {
            let tr: any = {};
            try {
              tr = JSON.parse(auto.trigger_json || '{}');
            } catch (_) {}

            let stepCount = 0;
            try {
              const st = JSON.parse(auto.steps_json || auto.actions_json || '[]');
              stepCount = Array.isArray(st) ? st.length : 0;
            } catch (_) {}

            const isTesting = testingId === auto.id;
            const isSuccess = successId === auto.id;
            const isToggling = togglingId === auto.id;

            return (
              <div
                key={auto.id}
                className="bg-[#191A1D] rounded-2xl p-5 border border-[#383A3E] hover:border-[#4B4E54] flex flex-col justify-between gap-4 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-[#22D68A] shrink-0" />
                      {auto.name}
                    </h3>

                    {/* Enable/Disable Toggle Pill */}
                    <button
                      onClick={() => handleToggleEnable(auto)}
                      disabled={isToggling}
                      title={auto.enabled ? 'Click to pause automation' : 'Click to activate automation'}
                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase transition-all ${
                        auto.enabled
                          ? 'bg-[#22D68A]/10 text-[#22D68A] border border-[#22D68A]/30 hover:bg-[#22D68A]/20'
                          : 'bg-[#111214] text-[#777777] border border-[#383A3E] hover:text-[#A6A6A6]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          auto.enabled ? 'bg-[#22D68A] animate-pulse' : 'bg-[#777777]'
                        }`}
                      />
                      <span>{isToggling ? 'Updating...' : auto.enabled ? 'ACTIVE' : 'PAUSED'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {/* Trigger Badge */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111214] text-[#F5F5F5] border border-[#383A3E] flex items-center gap-1.5">
                      {tr.type === 'time' ? (
                        <Clock className="w-3 h-3 text-[#F0B94D]" />
                      ) : (
                        <Radio className="w-3 h-3 text-[#22D68A]" />
                      )}
                      <span>{formatSchedule(tr)}</span>
                    </span>

                    {/* Action Count */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111214] text-[#A6A6A6] border border-[#383A3E]">
                      {stepCount} {stepCount === 1 ? 'Action' : 'Actions'}
                    </span>

                    {/* Last Run Time */}
                    <span className="text-[10px] font-mono text-[#777777]">
                      {auto.last_run_at
                        ? `Ran ${new Date(auto.last_run_at).toLocaleTimeString()}`
                        : 'Standby'}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-[#383A3E]/50 flex items-center justify-between">
                  <span className="text-[11px] text-[#A6A6A6]">
                    {auto.enabled ? 'Scheduled in background' : 'Suspended'}
                  </span>

                  <div className="flex items-center gap-2">
                    {isAdmin && onOpenAdmin && (
                      <button
                        onClick={onOpenAdmin}
                        className="px-2.5 py-1.5 rounded-lg bg-[#111214] hover:bg-[#202226] text-[#A6A6A6] hover:text-white border border-[#383A3E] text-xs font-medium transition-colors"
                        title="Edit in Admin Studio"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleTestRun(auto.id)}
                      disabled={isTesting}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                        isSuccess
                          ? 'bg-[#22D68A] text-slate-950 font-bold'
                          : 'bg-white text-slate-950 hover:bg-neutral-200 active:scale-95'
                      }`}
                    >
                      {isTesting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>
                        {isTesting ? 'Testing...' : isSuccess ? 'Triggered!' : 'Test Run'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AutomationsPage;
