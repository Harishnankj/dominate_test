import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Lock,
  Unlock,
  Battery,
  Video,
  Users,
  KeyRound,
  Link2,
  Settings,
  ShieldAlert,
  Fingerprint,
  Eye,
  Bell,
  ChevronRight,
  Clock,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Wifi,
  Camera,
  User,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import type { Device } from '../../types';
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

  // Press & hold state for locking
  const [holdProgress, setHoldProgress] = useState(0);
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
        if (remaining === 0) {
          setOtp(null);
          setOtpExpiry(0);
        }
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

  // Hold-to-lock logic
  const startHold = useCallback(() => {
    if (locked || loading) return;
    holdCompletedRef.current = false;
    holdStartRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setHoldProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
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
    if (holdCompletedRef.current) {
      holdCompletedRef.current = false;
      return;
    }
    if (locked) {
      await doUnlock();
    }
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
    } catch (e: any) {
      setOtp('Error: ' + e.message);
    }
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

  useEffect(() => {
    if (tab === 'album') fetchLogs();
  }, [tab]);

  // SVG circular dial
  const RING_R = 72;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C - (holdProgress / 100) * RING_C;
  const ringColor = locked ? '#FFFFFF' : '#22D68A';
  const battDisp = battery !== null ? battery : (rawStatus['residual_electricity'] ?? 70);

  const faceCount = rawStatus['unlock_face'] ?? 11;
  const fpCount = rawStatus['unlock_fingerprint'] ?? 4;
  const alarmCode = rawStatus['alarm_reminder'] ?? 4105;
  const captureMode = rawStatus['stay_capture_mode'] ?? 'mode_1';
  const linkMode = rawStatus['link_mode'] ?? 'keep';

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Main Dial', icon: <Lock className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Video Surveillance', icon: <Video className="w-3.5 h-3.5" /> },
    { id: 'ai', label: 'Lock AI', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'password', label: 'Temp Passcode', icon: <KeyRound className="w-3.5 h-3.5" /> },
    { id: 'linkage', label: 'Linkage', icon: <Link2 className="w-3.5 h-3.5" /> },
    { id: 'album', label: 'Access Log', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'set', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#111214] border border-[#383A3E] shadow-2xl overflow-hidden">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#383A3E] bg-[#191A1D]/80 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-[#F5F5F5]">{device.name}</h2>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 uppercase tracking-wider font-semibold">
                BK7258 Wi-Fi 6 Video Lock
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#A6A6A6] mt-0.5">
              Device ID: <span className="text-[#F5F5F5]">{tuyaDeviceId}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono bg-[#111214] px-2.5 py-1 rounded-lg border border-[#383A3E]">
              <Battery className="w-4 h-4 text-[#22D68A]" />
              <span className="text-[#22D68A] font-bold">{battDisp}%</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#202226] border border-[#383A3E] text-[#A6A6A6] hover:text-white hover:border-white/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────── */}
        <div className="flex overflow-x-auto border-b border-[#383A3E] bg-[#111214] flex-shrink-0 px-2 scrollbar-none gap-1 py-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-white text-slate-950 font-bold shadow-sm'
                    : 'text-[#A6A6A6] hover:text-white hover:bg-white/5'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── MAIN DIAL TAB ──────────────────────────────── */}
          {tab === 'main' && (
            <div className="flex flex-col items-center py-4 px-2 gap-5">
              {/* Circular Dial */}
              <div className="relative select-none my-2">
                <svg width="210" height="210" className="block" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="105" cy="105" r={RING_R} fill="none" stroke="#202226" strokeWidth="10" />
                  <circle
                    cx="105"
                    cy="105"
                    r={RING_R}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="10"
                    strokeDasharray={RING_C}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    style={{ transition: holdProgress === 0 ? 'stroke-dashoffset 0.2s' : 'none' }}
                  />
                </svg>

                {/* Center Button */}
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
                  <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg border transition-all ${
                    locked
                      ? 'bg-[#191A1D] border-white/40 text-white'
                      : 'bg-white text-slate-950 border-white'
                  }`}>
                    {loading ? (
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    ) : locked ? (
                      <Lock className="w-8 h-8" />
                    ) : (
                      <Unlock className="w-8 h-8" />
                    )}
                    <span className="text-[10px] font-bold mt-1 font-mono uppercase tracking-wider">
                      {loading ? 'WAIT…' : locked ? '1-Click Unlock' : 'Hold to Lock'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Status Message */}
              {lockMsg && (
                <div className={`w-full max-w-sm px-4 py-2.5 rounded-xl text-center text-xs font-bold border ${
                  locked
                    ? 'bg-[#191A1D] border-[#383A3E] text-[#F5F5F5]'
                    : 'bg-[#22D68A]/10 border-[#22D68A]/40 text-[#22D68A]'
                }`}>
                  {lockMsg}
                </div>
              )}

              {/* Dual Action Controls */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <button
                  onClick={doUnlock}
                  disabled={loading}
                  className="py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-60"
                >
                  <Unlock className="w-4 h-4" /> 1-Click Remote Unlock
                </button>
                <button
                  onClick={doLock}
                  disabled={loading}
                  className="py-3 px-4 rounded-xl bg-[#202226] border border-[#383A3E] hover:border-white/40 text-[#F5F5F5] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                >
                  <Lock className="w-4 h-4" /> Lock 4 Deadbolts
                </button>
              </div>

              {/* Shortcut Grid */}
              <div className="grid grid-cols-3 gap-2.5 w-full max-w-sm pt-2">
                {[
                  { id: 'video' as Tab, label: 'Door Camera', icon: <Video className="w-4 h-4" /> },
                  { id: 'password' as Tab, label: 'Guest OTP', icon: <KeyRound className="w-4 h-4" /> },
                  { id: 'album' as Tab, label: 'Audit Logs', icon: <Clock className="w-4 h-4" /> },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTab(f.id)}
                    className="bg-[#191A1D] border border-[#383A3E] rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-white/40 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
                      {f.icon}
                    </div>
                    <span className="text-[10px] text-[#F5F5F5] font-semibold">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── VIDEO SURVEILLANCE TAB ───────────────────────── */}
          {tab === 'video' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#383A3E]">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-[#F5F5F5]">Doorbell Camera & Live Surveillance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchLiveStream}
                      disabled={streamLoading}
                      className="p-1.5 rounded-lg bg-[#111214] border border-[#383A3E] text-[#A6A6A6] hover:text-white hover:border-white/40 transition-colors"
                      title="Reconnect Stream"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${streamLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-white/10 text-white border border-white/20 rounded uppercase font-semibold">
                      BK7258 Wi-Fi 6
                    </span>
                  </div>
                </div>

                <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {streamLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-[#F5F5F5] tracking-wide">Connecting to Doorbell Camera...</p>
                      <p className="text-[10px] text-[#A6A6A6] font-mono">Negotiating RTSP / WebRTC stream via Tuya Cloud</p>
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
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-[#22D68A]/40 text-[10px] font-mono font-bold text-[#22D68A] shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-[#22D68A] animate-pulse" />
                        LIVE (DOORBELL CAMERA)
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-6 gap-3 text-center">
                      <Camera className="w-12 h-12 text-[#777777]" />
                      <div>
                        <p className="text-sm font-bold text-[#F5F5F5]">Camera Standby</p>
                        {streamError ? (
                          <p className="text-xs text-[#FF5757] mt-1 max-w-sm">{streamError}</p>
                        ) : (
                          <p className="text-xs text-[#A6A6A6] mt-1">Camera wakes instantly on doorbell ring or stream request.</p>
                        )}
                      </div>
                      <button
                        onClick={fetchLiveStream}
                        className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Start Live Stream
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 flex items-center gap-3 bg-[#111214] border-t border-[#383A3E]">
                  <button
                    onClick={() => {
                      setLockMsg('Simulating Doorbell Ring...');
                      setTimeout(() => setLockMsg(''), 3000);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#202226] border border-[#383A3E] text-[#F5F5F5] hover:border-white/40 text-xs font-semibold transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5 text-white" /> Simulate Ring
                  </button>
                  <button
                    onClick={doUnlock}
                    disabled={loading}
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-slate-950 text-xs font-bold transition-all disabled:opacity-60 shadow-sm"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Authorize Unlock
                  </button>
                </div>
              </div>

              {/* Doorbell Wakeup Receiver */}
              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#F5F5F5]">Doorbell Wakeup Receiver</div>
                    <div className="text-[10px] text-[#A6A6A6]">Low-power Wi-Fi video lock wakes on doorbell press</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#22D68A]/10 border border-[#22D68A]/30 text-[#22D68A] text-xs font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22D68A]" />
                  LISTENING
                </span>
              </div>
            </div>
          )}

          {/* ── LOCK AI TAB ─────────────────────────────────── */}
          {tab === 'ai' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F0B94D]" />
                    <span className="text-sm font-bold text-[#F5F5F5]">Anti-Tamper & Security Guard</span>
                  </div>
                  <span className="text-xs font-mono text-[#F0B94D] bg-[#F0B94D]/10 px-2.5 py-0.5 rounded-lg border border-[#F0B94D]/30">
                    CODE {alarmCode}
                  </span>
                </div>
                <p className="text-xs text-[#A6A6A6] mb-3">Monitors physical pry attempts, repeated invalid passcodes, and sensor triggers.</p>
                <button className="px-4 py-2 rounded-xl bg-[#202226] border border-[#383A3E] hover:border-white/40 text-[#F5F5F5] text-xs font-bold transition-colors">
                  Silence / Disarm
                </button>
              </div>

              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-4">
                <p className="text-xs font-bold text-[#F5F5F5] mb-3">Stay Capture Mode (Auto-Record Visitors)</p>
                <div className="flex gap-2">
                  {['mode_1', 'mode_2'].map((m) => (
                    <div
                      key={m}
                      className={`flex-1 py-2.5 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                        captureMode === m
                          ? 'border-white bg-white text-slate-950 font-bold'
                          : 'border-[#383A3E] bg-[#111214] text-[#A6A6A6] hover:border-white/30'
                      }`}
                    >
                      {m === 'mode_1' ? '5-Photo Burst' : '10-Second Video'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-4 space-y-3">
                <p className="text-xs font-bold text-[#F5F5F5]">Enrolled Biometrics</p>
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-3 bg-[#111214] border border-[#383A3E] rounded-xl p-3">
                    <Eye className="w-5 h-5 text-white" />
                    <div>
                      <div className="text-sm font-bold text-[#F5F5F5]">{faceCount} Enrolled</div>
                      <div className="text-[10px] text-[#A6A6A6]">3D Facial Recognition</div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3 bg-[#111214] border border-[#383A3E] rounded-xl p-3">
                    <Fingerprint className="w-5 h-5 text-white" />
                    <div>
                      <div className="text-sm font-bold text-[#F5F5F5]">{fpCount} Enrolled</div>
                      <div className="text-[10px] text-[#A6A6A6]">Semiconductor Scanner</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MEMBERS TAB ─────────────────────────────────── */}
          {tab === 'members' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 mb-2">
                {[
                  { label: 'Faces', count: faceCount, icon: <Eye className="w-4 h-4" /> },
                  { label: 'Fingerprints', count: fpCount, icon: <Fingerprint className="w-4 h-4" /> },
                  { label: 'PIN Codes', count: 3, icon: <KeyRound className="w-4 h-4" /> },
                  { label: 'IC Cards', count: 1, icon: <Wifi className="w-4 h-4" /> },
                ].map((item) => (
                  <div key={item.label} className="bg-[#191A1D] border border-[#383A3E] rounded-xl p-3 flex items-center gap-3">
                    <div className="text-white">{item.icon}</div>
                    <div>
                      <div className="text-sm font-bold text-[#F5F5F5]">{item.count}</div>
                      <div className="text-[10px] text-[#A6A6A6]">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              {[
                { name: 'Hari', role: 'Owner', method: 'Face + Fingerprint' },
                { name: 'Office Staff', role: 'Member', method: 'Fingerprint + PIN' },
                { name: 'Guest Access', role: 'Temporary', method: 'Dynamic Passcode' },
              ].map((m) => (
                <div key={m.name} className="bg-[#191A1D] border border-[#383A3E] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#F5F5F5]">{m.name}</div>
                    <div className="text-[10px] text-[#A6A6A6]">{m.method}</div>
                  </div>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                    m.role === 'Owner'
                      ? 'bg-white/10 text-white border-white/30 font-bold'
                      : 'bg-[#202226] text-[#A6A6A6] border-[#383A3E]'
                  }`}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── TEMP PASSCODE TAB ───────────────────────────── */}
          {tab === 'password' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-[#F5F5F5]">Dynamic OTP (5-Minute Temporary Passcode)</span>
                </div>

                {otp ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 py-2">
                      <span className="text-3xl font-mono font-bold tracking-[0.3em] text-[#F5F5F5]">{otp}</span>
                      <button
                        onClick={copyOtp}
                        className="p-2 bg-[#111214] border border-[#383A3E] hover:border-white/40 rounded-lg text-[#A6A6A6] hover:text-white transition-colors"
                        title="Copy OTP"
                      >
                        {otpCopied ? <Check className="w-4 h-4 text-[#22D68A]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="relative w-full max-w-[200px] h-1.5 bg-[#111214] rounded-full overflow-hidden border border-[#383A3E]">
                        <div
                          className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
                          style={{ width: `${(otpCountdown / 300) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[#A6A6A6]">{otpCountdown}s remaining</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={fetchOtp}
                    disabled={otpLoading}
                    className="w-full py-3 rounded-xl bg-white hover:bg-neutral-100 text-slate-950 text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {otpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {otpLoading ? 'Generating…' : 'Generate One-Time Passcode'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── LINKAGE TAB ─────────────────────────────────── */}
          {tab === 'linkage' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#383A3E] bg-[#191A1D] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#F5F5F5]">Connection Link Mode</p>
                    <p className="text-[10px] text-[#A6A6A6]">Current: <span className="text-white font-mono uppercase">{linkMode}</span></p>
                  </div>
                  <span className="text-xs font-mono text-[#22D68A] bg-[#22D68A]/10 border border-[#22D68A]/30 px-2 py-0.5 rounded">ACTIVE</span>
                </div>

                <div className="border-t border-[#383A3E]/50 pt-4">
                  <p className="text-sm font-bold text-[#F5F5F5] mb-2">Auto-Lock Delay</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['5s', '10s', '15s', '30s', 'Manual'].map((d) => (
                      <button
                        key={d}
                        className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                          d === '15s'
                            ? 'bg-white text-slate-950 border-white'
                            : 'bg-[#111214] border-[#383A3E] text-[#A6A6A6] hover:border-white/30'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={doLock}
                className="w-full py-3 rounded-xl bg-[#202226] border border-[#383A3E] hover:border-white/40 text-[#F5F5F5] text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> Engage Full Building Deadbolt Lockdown
              </button>
            </div>
          )}

          {/* ── ACCESS LOG TAB ──────────────────────────────── */}
          {tab === 'album' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-[#F5F5F5]">Access Records & Unlock Audit Trail</span>
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="p-1.5 bg-[#191A1D] border border-[#383A3E] hover:border-white/40 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#A6A6A6] ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {logsLoading ? (
                <div className="text-center text-[#A6A6A6] text-sm py-8">Loading logs…</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-[#777777] text-xs py-8">
                  No recent unlock records found.
                </div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="bg-[#191A1D] border border-[#383A3E] rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-[#F5F5F5] capitalize">
                        {l.type?.replace('_', ' ') || 'Unlock'}
                      </div>
                      <div className="text-[10px] text-[#A6A6A6]">{l.user} · {l.method}</div>
                    </div>
                    <span className="text-[10px] font-mono text-[#777777]">
                      {l.time ? new Date(typeof l.time === 'number' ? l.time : Number(l.time)).toLocaleTimeString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ────────────────────────────────── */}
          {tab === 'set' && (
            <div className="space-y-3">
              <div className="bg-[#191A1D] border border-[#383A3E] rounded-xl p-4">
                <div className="text-xs font-bold text-[#F5F5F5] mb-2.5">Hardware & Telemetry Specifications</div>
                <div className="space-y-1.5 font-mono text-[10px] text-[#A6A6A6]">
                  <div className="flex justify-between py-1 border-b border-[#383A3E]/40">
                    <span>Device ID</span>
                    <span className="text-[#F5F5F5]">{tuyaDeviceId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#383A3E]/40">
                    <span>Category</span>
                    <span className="text-[#F5F5F5]">videolock (BK7258 Wi-Fi 6)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#383A3E]/40">
                    <span>Battery Residual</span>
                    <span className="text-[#22D68A] font-bold">{battDisp}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#383A3E]/40">
                    <span>Inside Handle Trigger</span>
                    <span className="text-[#22D68A]">SECURED & MONITORED</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#383A3E]/40">
                    <span>Enrolled Face IDs</span>
                    <span className="text-[#F5F5F5]">{faceCount} Registered</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Enrolled Fingerprints</span>
                    <span className="text-[#F5F5F5]">{fpCount} Registered</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <div className="border-t border-[#383A3E] px-5 py-3 flex items-center justify-between bg-[#191A1D]/80 flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#A6A6A6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22D68A] animate-pulse" />
            Connected via Tuya Cloud & Local Gateway
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-slate-950 text-xs font-bold transition-all shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockDetailModal;
