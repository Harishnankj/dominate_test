import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Lock, Unlock, Battery, Video, Users, KeyRound, Link2, Settings,
  ShieldAlert, Fingerprint, Eye, Bell, ChevronRight, Clock, RefreshCw,
  Copy, Check, AlertTriangle, Wifi, Camera, User, Play,
} from 'lucide-react';
import type { Device, Camera as CameraType } from '../../types';
import { ApiService } from '../../services/api';
import { Go2rtcVideo } from '../cctv/Go2rtcVideo';

type Tab = 'main' | 'video' | 'ai' | 'members' | 'password' | 'linkage' | 'album' | 'set';

interface LockDetailModalProps {
  device: Device;
  tuyaDeviceId: string;
  onClose: () => void;
}

const HOLD_DURATION = 1200; // ms

const LockDetailModal: React.FC<LockDetailModalProps> = ({ device, tuyaDeviceId, onClose }) => {
  const [tab, setTab] = useState<Tab>('main');
  const [locked, setLocked] = useState(true);
  const [battery, setBattery] = useState<number | null>(null);
  const [rawStatus, setRawStatus] = useState<Record<string, any>>({});
  const [lockMsg, setLockMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // Press & hold state
  const [holdProgress, setHoldProgress] = useState(0); // 0-100
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const holdCompletedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // OTP state
  const [otp, setOtp] = useState<string | null>(null);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Live Camera Stream
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const fetchLiveStream = useCallback(async () => {
    setStreamLoading(true);
    setStreamError(null);
    try {
      const res = await ApiService.getTuyaLiveStream(tuyaDeviceId);
      if (res.ok && res.stream_id) {
        setStreamId(res.stream_id);
      } else {
        setStreamError(res.message || 'Stream allocation failed');
      }
    } catch (e: any) {
      setStreamError(e.message || 'Network error');
    } finally {
      setStreamLoading(false);
    }
  }, [tuyaDeviceId]);

  useEffect(() => {
    if (tab === 'video') {
      fetchLiveStream();
    }
  }, [tab, fetchLiveStream]);

  // Fetch live status on mount
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line
  }, [tuyaDeviceId]);

  // OTP countdown
  useEffect(() => {
    if (otpExpiry > 0) {
      const iv = setInterval(() => {
        const remaining = Math.max(0, Math.round((otpExpiry - Date.now()) / 1000));
        setOtpCountdown(remaining);
        if (remaining === 0) { setOtp(null); setOtpExpiry(0); }
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [otpExpiry]);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await ApiService.getTuyaLockStatus(tuyaDeviceId);
      if (res.ok) {
        setLocked(res.locked ?? true);
        if (res.battery !== undefined) setBattery(res.battery);
        if (res.rawStatus) setRawStatus(res.rawStatus);
      }
    } catch (_) {}
    setStatusLoading(false);
  };

  // ── Hold-to-lock ─────────────────────────────────────────────
  const startHold = useCallback(() => {
    if (locked || loading) return; // already locked → 1-click unlock
    holdCompletedRef.current = false;
    holdStartRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Hold complete → fire lock
        holdCompletedRef.current = true;
        setHoldProgress(0);
        doLock();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [locked, loading]);

  const cancelHold = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    holdTimerRef.current && clearInterval(holdTimerRef.current);
    setHoldProgress(0);
  }, []);

  const handleDial = useCallback(async () => {
    if (holdCompletedRef.current) { holdCompletedRef.current = false; return; }
    if (locked) {
      // 1-click unlock
      await doUnlock();
    }
    // If unlocked → user must hold, single click does nothing
  }, [locked, loading]);

  const doLock = async () => {
    setLoading(true);
    setLockMsg('');
    try {
      const res = await ApiService.lockTuyaDevice(tuyaDeviceId);
      if (res.ok) {
        setLocked(true);
        setLockMsg(res.message || '4-Point Deadbolts Secured');
      } else {
        setLockMsg(res.message || 'Lock failed');
      }
    } catch (e: any) {
      setLockMsg(e.message || 'Error');
    }
    setLoading(false);
    setTimeout(() => setLockMsg(''), 5000);
  };

  const doUnlock = async () => {
    setLoading(true);
    setLockMsg('');
    try {
      const res = await ApiService.unlockTuyaDevice(tuyaDeviceId);
      if (res.ok) {
        setLocked(false);
        setLockMsg(res.message || 'Door Unlocked');
      } else {
        setLockMsg(res.message || 'Unlock failed');
      }
    } catch (e: any) {
      setLockMsg(e.message || 'Error');
    }
    setLoading(false);
    setTimeout(() => setLockMsg(''), 5000);
  };

  const fetchOtp = async () => {
    setOtpLoading(true);
    try {
      const res = await ApiService.generateTuyaOtp(tuyaDeviceId);
      if (res.ok && res.otp) {
        setOtp(res.otp);
        setOtpExpiry(Date.now() + (res.expiresIn || 300) * 1000);
      } else {
        setOtp(res.message || 'Error');
      }
    } catch (e: any) { setOtp('Error: ' + e.message); }
    setOtpLoading(false);
  };

  const copyOtp = () => {
    if (otp) {
      navigator.clipboard.writeText(otp).catch(() => {});
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2000);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await ApiService.getTuyaLockLogs(tuyaDeviceId);
      if (res.ok && res.logs) setLogs(res.logs);
    } catch (_) {}
    setLogsLoading(false);
  };

  // Load logs when album tab opens
  useEffect(() => {
    if (tab === 'album') fetchLogs();
  }, [tab]);

  // ── SVG ring progress ─────────────────────────────────────
  const RING_R = 72;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C - (holdProgress / 100) * RING_C;
  const ringColor = locked ? '#06b6d4' : '#FF6036';
  const battDisp = battery !== null ? battery : (rawStatus['residual_electricity'] ?? 70);

  // Enum helpers
  const faceCount = rawStatus['unlock_face'] ?? 11;
  const fpCount = rawStatus['unlock_fingerprint'] ?? 4;
  const alarmCode = rawStatus['alarm_reminder'] ?? 4105;
  const captureMode = rawStatus['stay_capture_mode'] ?? 'mode_1';
  const linkMode = rawStatus['link_mode'] ?? 'keep';

  // ── TABS CONFIG ───────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Main Dial', icon: <Lock className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Video Surveillance', icon: <Video className="w-3.5 h-3.5" /> },
    { id: 'ai', label: 'Lock AI', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'password', label: 'Temp Passcode', icon: <KeyRound className="w-3.5 h-3.5" /> },
    { id: 'linkage', label: 'Smart Linkage', icon: <Link2 className="w-3.5 h-3.5" /> },
    { id: 'album', label: 'Album/Log', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'set', label: 'Set', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[95vh] flex flex-col rounded-2xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900/80 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{device.name}</h2>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-wider">Tuya Video Lock</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              ID: <span className="text-cyan-500">{tuyaDeviceId}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-mono">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{battDisp}%</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────── */}
        <div className="flex overflow-x-auto border-b border-white/10 bg-slate-900/50 flex-shrink-0 scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-all border-b-2 ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MAIN DIAL ───────────────────────────────── */}
          {tab === 'main' && (
            <div className="flex flex-col items-center py-6 px-4 gap-4">

              {/* Circular dial */}
              <div className="relative select-none">
                <svg width="200" height="200" className="block" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background ring */}
                  <circle cx="100" cy="100" r={RING_R} fill="none" stroke="#1e293b" strokeWidth="10" />
                  {/* Progress ring */}
                  <circle
                    cx="100" cy="100" r={RING_R}
                    fill="none" stroke={ringColor} strokeWidth="10"
                    strokeDasharray={RING_C} strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    style={{ transition: holdProgress === 0 ? 'stroke-dashoffset 0.2s' : 'none' }}
                  />
                </svg>

                {/* Center button */}
                <button
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-full cursor-pointer active:scale-95 transition-transform"
                  onClick={handleDial}
                  onMouseDown={!locked ? startHold : undefined}
                  onMouseUp={!locked ? cancelHold : undefined}
                  onMouseLeave={!locked ? cancelHold : undefined}
                  onTouchStart={!locked ? startHold : undefined}
                  onTouchEnd={!locked ? cancelHold : undefined}
                  disabled={loading}
                  style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
                >
                  <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg ${
                    locked ? 'bg-slate-800 border-2 border-cyan-400/50' : 'bg-orange-500/10 border-2 border-orange-500/50'
                  }`}>
                    {loading ? (
                      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                    ) : locked ? (
                      <Lock className="w-8 h-8 text-cyan-400" />
                    ) : (
                      <Unlock className="w-8 h-8 text-orange-400" />
                    )}
                    <span className={`text-[9px] font-bold mt-1 ${locked ? 'text-cyan-300' : 'text-orange-300'}`}>
                      {loading ? 'WAIT…' : locked ? '1-Click Unlock' : 'Hold to lock'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Battery */}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span>Battery: <strong className="text-emerald-400">{battDisp}%</strong></span>
                <button onClick={fetchStatus} className="ml-2 p-1 hover:bg-white/10 rounded" title="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${statusLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Status message */}
              {lockMsg && (
                <div className={`w-full max-w-sm px-4 py-2.5 rounded-xl text-center text-xs font-bold border ${
                  locked ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                }`}>
                  🔒 {lockMsg}
                </div>
              )}

              {/* Album/Log banner */}
              <button
                onClick={() => setTab('album')}
                className="w-full max-w-sm glass-panel border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">Album / Log</div>
                    <div className="text-[10px] text-slate-400">Recent unlock activity</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              {/* 6 feature tiles */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                {[
                  { id: 'video' as Tab, label: 'Video', icon: <Video className="w-5 h-5" /> },
                  { id: 'ai' as Tab, label: 'Lock AI', icon: <ShieldAlert className="w-5 h-5" /> },
                  { id: 'members' as Tab, label: 'Members', icon: <Users className="w-5 h-5" /> },
                  { id: 'password' as Tab, label: 'Temp PIN', icon: <KeyRound className="w-5 h-5" /> },
                  { id: 'linkage' as Tab, label: 'Linkage', icon: <Link2 className="w-5 h-5" /> },
                  { id: 'set' as Tab, label: 'Set', icon: <Settings className="w-5 h-5" /> },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setTab(f.id)}
                    className="glass-panel border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <span className="text-[10px] text-slate-300 font-semibold">{f.label}</span>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="text-[10px] text-slate-600 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Synced with Tuya Smart Life Cloud & Local Hub
              </div>
            </div>
          )}

          {/* ── VIDEO SURVEILLANCE ──────────────────────── */}
          {tab === 'video' && (
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">Video Surveillance & Doorbell Feed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchLiveStream}
                      disabled={streamLoading}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
                      title="Reconnect Stream"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${streamLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded uppercase">BK7258 Wi-Fi 6 Camera</span>
                  </div>
                </div>

                <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {streamLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                      <p className="text-xs font-bold text-white tracking-wide">Connecting to Door Camera...</p>
                      <p className="text-[10px] text-slate-500 font-mono">Negotiating RTSP / WebRTC stream via Tuya Cloud</p>
                    </div>
                  ) : streamId ? (
                    <div className="relative w-full h-full">
                      <Go2rtcVideo
                        camera={{
                          id: `cam_tuya_${tuyaDeviceId}`,
                          name: `${device.name} Entrance Camera`,
                          stream_id: streamId,
                          search_tags: 'doorlock tuya entrance camera',
                          sort_order: 0,
                        }}
                        isMainStream={true}
                        className="w-full h-full object-cover"
                        initialMuted={true}
                      />
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-400 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE (TUYA DOORBELL CAMERA)
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-6 gap-3 text-center">
                      <Camera className="w-14 h-14 text-cyan-400/40" />
                      <div>
                        <p className="text-sm font-bold text-cyan-300">Entrance Camera Inactive</p>
                        {streamError && (
                          <p className="text-xs text-rose-400 mt-1 max-w-sm">{streamError}</p>
                        )}
                      </div>
                      <button
                        onClick={fetchLiveStream}
                        className="mt-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-glow"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Start Live Stream
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 flex items-center gap-3">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 text-xs font-semibold transition-colors">
                    <Bell className="w-3.5 h-3.5" /> Simulate Ring
                  </button>
                  <button
                    onClick={doUnlock}
                    disabled={loading}
                    className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-60"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Authorize Unlock
                  </button>
                </div>
              </div>

              {/* Doorbell Wakeup */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Doorbell Wakeup Receiver</div>
                    <div className="text-[10px] text-slate-500">Low-power Wi-Fi video lock wakes on doorbell press</div>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors">Simulate Ring</button>
              </div>
            </div>
          )}

          {/* ── LOCK AI ─────────────────────────────────── */}
          {tab === 'ai' && (
            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-300">Anti-Tamper Alarm</span>
                  </div>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">CODE {alarmCode}</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Tamper alert is active. Disarm to silence.</p>
                <button className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors">Disarm Alert</button>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs font-bold text-white mb-3">Stay Capture Mode</p>
                <div className="flex gap-2">
                  {['mode_1', 'mode_2'].map(m => (
                    <div key={m} className={`flex-1 py-2 rounded-lg border text-center text-xs font-semibold transition-all cursor-pointer ${
                      captureMode === m ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 text-slate-500 hover:border-white/20'
                    }`}>
                      {m === 'mode_1' ? '5-Photo Burst' : '10-Second Video'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                <p className="text-xs font-bold text-white">Enrolled Biometrics</p>
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-2 bg-slate-800/80 rounded-lg p-3">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">{faceCount}</div>
                      <div className="text-[10px] text-slate-500">Faces</div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-slate-800/80 rounded-lg p-3">
                    <Fingerprint className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">{fpCount}</div>
                      <div className="text-[10px] text-slate-500">Fingerprints</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MEMBERS ─────────────────────────────────── */}
          {tab === 'members' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 mb-2">
                {[
                  { label: 'Faces', count: faceCount, icon: <Eye className="w-4 h-4" /> },
                  { label: 'Fingerprints', count: fpCount, icon: <Fingerprint className="w-4 h-4" /> },
                  { label: 'PIN Codes', count: 3, icon: <KeyRound className="w-4 h-4" /> },
                  { label: 'IC Cards', count: 1, icon: <Wifi className="w-4 h-4" /> },
                ].map(item => (
                  <div key={item.label} className="glass-panel border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="text-cyan-400">{item.icon}</div>
                    <div>
                      <div className="text-sm font-bold text-white">{item.count}</div>
                      <div className="text-[10px] text-slate-500">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              {[
                { name: 'Hari', role: 'Owner', method: 'Face + Fingerprint' },
                { name: 'Staff', role: 'Member', method: 'Fingerprint + PIN' },
                { name: 'Guest', role: 'Temp Access', method: 'Temp Passcode' },
              ].map(m => (
                <div key={m.name} className="glass-panel border border-white/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{m.name}</div>
                    <div className="text-[10px] text-slate-500">{m.method}</div>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    m.role === 'Owner' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                    m.role === 'Member' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                    'bg-slate-700 text-slate-400 border-slate-600'
                  }`}>{m.role}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── TEMP PASSCODE ────────────────────────────── */}
          {tab === 'password' && (
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">Dynamic OTP (5-min)</span>
                </div>

                {otp ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-mono font-bold tracking-[0.3em] text-cyan-300">{otp}</span>
                      <button onClick={copyOtp} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        {otpCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="relative w-full max-w-[200px] h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-cyan-500 rounded-full transition-all"
                          style={{ width: `${(otpCountdown / 300) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400">{otpCountdown}s</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={fetchOtp}
                    disabled={otpLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {otpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {otpLoading ? 'Generating…' : 'Generate OTP'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SMART LINKAGE ────────────────────────────── */}
          {tab === 'linkage' && (
            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Link Mode</p>
                    <p className="text-[10px] text-slate-500">Current: <span className="text-cyan-400 font-mono">{linkMode.toUpperCase()}</span></p>
                  </div>
                  <div className="w-10 h-5 bg-cyan-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <p className="text-sm font-bold text-white mb-2">Auto-Lock Delay</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['5s', '10s', '15s', '30s', 'Manual'].map(d => (
                      <button key={d} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                        d === '15s' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-slate-500 hover:border-white/20'
                      }`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold tracking-wider transition-all border border-rose-500/30"
              >
                🔒 Full Building Lockdown
              </button>
            </div>
          )}

          {/* ── ALBUM / LOG ──────────────────────────────── */}
          {tab === 'album' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">Access Log</span>
                <button onClick={fetchLogs} disabled={logsLoading} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {logsLoading ? (
                <div className="text-center text-slate-500 text-sm py-8">Loading…</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-slate-600 text-xs py-8">No recent log entries.<br />Logs may require Tuya IoT "Device Logs" subscription.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="glass-panel border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-white capitalize">{l.type?.replace('_', ' ') || 'Unlock'}</div>
                      <div className="text-[10px] text-slate-500">{l.user} · {l.method}</div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {l.time ? new Date(typeof l.time === 'number' ? l.time : Number(l.time)).toLocaleTimeString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── SET ─────────────────────────────────────── */}
          {tab === 'set' && (
            <div className="p-4 space-y-3">
              {[
                { label: 'Keypad Sound', desc: 'Beep on keypad input', value: true },
                { label: 'Door Sensor', desc: rawStatus['door_open_alarm'] ? 'OPEN' : 'CLOSED', value: !rawStatus['door_open_alarm'], color: 'emerald' },
                { label: 'Connection Mode', desc: `Link: ${linkMode.toUpperCase()}`, value: true },
                { label: 'Stay Capture', desc: captureMode.replace('_', ' ').toUpperCase(), value: captureMode !== 'off' },
              ].map(s => (
                <div key={s.label} className="glass-panel border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{s.label}</div>
                    <div className="text-[10px] text-slate-500">{s.desc}</div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative cursor-pointer ${s.value ? 'bg-cyan-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.value ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}

              <div className="glass-panel border border-white/10 rounded-xl p-4">
                <div className="text-xs font-bold text-white mb-2">Device Info</div>
                <div className="space-y-1 font-mono text-[10px] text-slate-500">
                  <div className="flex justify-between"><span>Device ID</span><span className="text-cyan-400 text-[9px]">{tuyaDeviceId}</span></div>
                  <div className="flex justify-between"><span>Category</span><span className="text-slate-300">videolock</span></div>
                  <div className="flex justify-between"><span>Chip</span><span className="text-slate-300">BK7258 Wi-Fi 6</span></div>
                  <div className="flex justify-between"><span>Battery</span><span className="text-emerald-400">{battDisp}%</span></div>
                  <div className="flex justify-between"><span>Faces</span><span className="text-slate-300">{faceCount}</span></div>
                  <div className="flex justify-between"><span>Fingerprints</span><span className="text-slate-300">{fpCount}</span></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Synced with Tuya Smart Life Cloud & Local Hub
          </div>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockDetailModal;

