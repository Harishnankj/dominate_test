import React, { useState } from 'react';
import { X, Send, Radio, Sparkles, Check, RefreshCw, KeyRound, Copy } from 'lucide-react';
import type { IrProfile, HaHub } from '../../types';
import { ApiService } from '../../services/api';

interface IrCodeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  hubs: HaHub[];
  initialProfile?: IrProfile | null;
  onSaved: () => void;
}

export const IrCodeEditorModal: React.FC<IrCodeEditorModalProps> = ({
  isOpen,
  onClose,
  hubs,
  initialProfile,
  onSaved,
}) => {
  const [name, setName] = useState(initialProfile?.name || 'Custom AC Profile');
  const [brand, setBrand] = useState(initialProfile?.brand || 'Custom');

  let initialCommands: Record<string, string> = {};
  try {
    initialCommands = JSON.parse(initialProfile?.commands_json || '{}');
  } catch (_) {}

  const [commands, setCommands] = useState<Record<string, string>>(initialCommands);
  const [activeTab, setActiveTab] = useState<'paste' | 'learn'>('paste');

  // Test send state
  const [testHubId, setTestHubId] = useState(hubs[0]?.id || '');
  const [testEntityId, setTestEntityId] = useState('');
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testSuccessKey, setTestSuccessKey] = useState<string | null>(null);

  // Live learn state
  const [learnEntity, setLearnEntity] = useState('');
  const [sensorEntity, setSensorEntity] = useState('');
  const [learningKey, setLearningKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCommandChange = (key: string, val: string) => {
    setCommands((prev) => ({ ...prev, [key]: val }));
  };

  const handleTestSend = async (key: string) => {
    const code = commands[key];
    if (!code || !testEntityId) return;

    setTestingKey(key);
    setTestSuccessKey(null);
    try {
      await ApiService.testIrCode({
        hub_id: testHubId,
        entity_id: testEntityId,
        code,
      });
      setTestSuccessKey(key);
      setTimeout(() => setTestSuccessKey(null), 2500);
    } catch (err: any) {
      alert(`Test IR failed: ${err.message}`);
    } finally {
      setTestingKey(null);
    }
  };

  const handleLiveLearn = async (key: string) => {
    if (!learnEntity || !sensorEntity) {
      alert('Please enter both learn switch entity and sensor entity');
      return;
    }

    setLearningKey(key);
    try {
      const res = await ApiService.learnIrCode({
        hub_id: testHubId,
        learn_entity: learnEntity,
        sensor_entity: sensorEntity,
      });
      if (res.ok && res.code) {
        setCommands((prev) => ({ ...prev, [key]: res.code! }));
      } else {
        alert(res.message || 'Failed to capture code');
      }
    } catch (err: any) {
      alert(`Learn failed: ${err.message}`);
    } finally {
      setLearningKey(null);
    }
  };

  const handleSave = async () => {
    try {
      if (initialProfile) {
        await ApiService.updateIrProfile(initialProfile.id, { name, brand, commands });
      } else {
        await ApiService.addIrProfile({ name, brand, commands });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Failed to save IR profile: ${err.message}`);
    }
  };

  const standardKeys = [
    { key: 'on', label: 'Power ON' },
    { key: 'off', label: 'Power OFF' },
    { key: 'mode_cool', label: 'Mode: Cool' },
    { key: 'mode_dry', label: 'Mode: Dry' },
    { key: 'mode_fan', label: 'Mode: Fan' },
    { key: 'fan_auto', label: 'Fan: Auto' },
    { key: 'fan_1', label: 'Fan: Low (1)' },
    { key: 'fan_2', label: 'Fan: Mid (2)' },
    { key: 'fan_3', label: 'Fan: High (3)' },
    { key: 'swing_on', label: 'Swing ON' },
    { key: 'swing_off', label: 'Swing OFF' },
    { key: 'saver_on', label: 'Eco / Saver ON' },
    { key: 'saver_off', label: 'Eco / Saver OFF' },
  ];

  // Temperatures 16 to 30
  const tempKeys = Array.from({ length: 15 }, (_, i) => ({
    key: `temp_${16 + i}`,
    label: `Temp ${16 + i}°C`,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] glass-panel rounded-2xl border border-white/20 p-6 overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Interactive AC IR Profile Learner & Editor</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Name & Brand */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">AC Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        {/* Test Target Hub & Entity Bar */}
        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-mono text-slate-400 uppercase">Test Blaster Entity</label>
            <input
              type="text"
              placeholder="e.g. text.meeting_room_ir_code_to_send"
              value={testEntityId}
              onChange={(e) => setTestEntityId(e.target.value)}
              className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white font-mono"
            />
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'paste' ? 'bg-cyan-500 text-slate-950 font-bold shadow-glow' : 'text-slate-400'
              }`}
            >
              Paste & Test Mode
            </button>
            <button
              onClick={() => setActiveTab('learn')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'learn' ? 'bg-cyan-500 text-slate-950 font-bold shadow-glow' : 'text-slate-400'
              }`}
            >
              Live Z2M Learn Mode
            </button>
          </div>
        </div>

        {/* Live Learn Setup if active */}
        {activeTab === 'learn' && (
          <div className="bg-cyan-950/20 border border-cyan-800/40 p-3 rounded-xl mb-4 grid grid-cols-2 gap-3 animate-in fade-in">
            <div>
              <label className="block text-[10px] font-mono text-cyan-400">Z2M Learn Switch Entity</label>
              <input
                type="text"
                placeholder="e.g. switch.meeting_room_learn_ir_code"
                value={learnEntity}
                onChange={(e) => setLearnEntity(e.target.value)}
                className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-cyan-400">Z2M Learned Code Sensor Entity</label>
              <input
                type="text"
                placeholder="e.g. sensor.meeting_room_learned_ir_code"
                value={sensorEntity}
                onChange={(e) => setSensorEntity(e.target.value)}
                className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              />
            </div>
          </div>
        )}

        {/* Command Keys Grid */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
          <h4 className="text-xs font-mono text-cyan-400 uppercase font-bold tracking-wider pt-1">
            System & Function Commands
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            {standardKeys.map((item) => (
              <div key={item.key} className="flex items-center gap-2 bg-slate-950/40 p-2 rounded-xl border border-white/5">
                <span className="w-28 text-xs font-semibold text-slate-300 truncate">{item.label}</span>
                <input
                  type="text"
                  placeholder="Base64 or Pronto IR string"
                  value={commands[item.key] || ''}
                  onChange={(e) => handleCommandChange(item.key, e.target.value)}
                  className="flex-1 glass-input rounded-lg px-2 py-1 text-xs font-mono text-white"
                />

                {activeTab === 'paste' ? (
                  <button
                    onClick={() => handleTestSend(item.key)}
                    disabled={!commands[item.key] || !testEntityId || testingKey === item.key}
                    title="Send Test IR Code"
                    className={`p-1.5 rounded-lg transition-all ${
                      testSuccessKey === item.key
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 disabled:opacity-30'
                    }`}
                  >
                    {testingKey === item.key ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : testSuccessKey === item.key ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleLiveLearn(item.key)}
                    disabled={learningKey === item.key}
                    title="Capture live from remote"
                    className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    {learningKey === item.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                    Learn
                  </button>
                )}
              </div>
            ))}
          </div>

          <h4 className="text-xs font-mono text-cyan-400 uppercase font-bold tracking-wider pt-3">
            Temperature Setpoints (16°C – 30°C)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            {tempKeys.map((item) => (
              <div key={item.key} className="flex items-center gap-2 bg-slate-950/40 p-2 rounded-xl border border-white/5">
                <span className="w-28 text-xs font-semibold text-slate-300 truncate">{item.label}</span>
                <input
                  type="text"
                  placeholder="Base64 IR code"
                  value={commands[item.key] || ''}
                  onChange={(e) => handleCommandChange(item.key, e.target.value)}
                  className="flex-1 glass-input rounded-lg px-2 py-1 text-xs font-mono text-white"
                />

                {activeTab === 'paste' ? (
                  <button
                    onClick={() => handleTestSend(item.key)}
                    disabled={!commands[item.key] || !testEntityId || testingKey === item.key}
                    title="Send Test IR Code"
                    className={`p-1.5 rounded-lg transition-all ${
                      testSuccessKey === item.key
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 disabled:opacity-30'
                    }`}
                  >
                    {testingKey === item.key ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : testSuccessKey === item.key ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleLiveLearn(item.key)}
                    disabled={learningKey === item.key}
                    className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    {learningKey === item.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                    Learn
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-3">
          <span className="text-xs text-slate-400">
            {Object.keys(commands).filter((k) => commands[k]).length} codes defined
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-brand-500 rounded-xl shadow-glow hover:opacity-90 active:scale-95"
            >
              Save IR Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
