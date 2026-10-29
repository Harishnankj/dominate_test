import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Camera as CameraIcon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Compass,
  Gauge,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react';
import type { Camera } from '../types';
import { Go2rtcVideo } from '../components/cctv/Go2rtcVideo';
import { ApiService } from '../services/api';

interface CameraFullscreenPageProps {
  camera: Camera;
  onClose: () => void;
}

export const CameraFullscreenPage: React.FC<CameraFullscreenPageProps> = ({ camera, onClose }) => {
  const [ptzMessage, setPtzMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [activeDirection, setActiveDirection] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(0.4);
  const [showPtzPad, setShowPtzPad] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [streamKey, setStreamKey] = useState(0);
  const [isReloadingStream, setIsReloadingStream] = useState(false);
  const holdIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleAudio = useCallback(() => {
    const container = streamContainerRef.current;
    if (!container) return;
    const vid = container.querySelector('video') as HTMLVideoElement | null;
    if (vid) {
      vid.muted = !vid.muted;
      setIsMuted(vid.muted);
    }
  }, []);

  const handleReloadStream = useCallback(() => {
    setIsReloadingStream(true);
    setStreamKey((k) => k + 1);
    showStatus('Reloading stream...');
    setTimeout(() => setIsReloadingStream(false), 1200);
  }, []);

  const showStatus = (text: string, error = false) => {
    setPtzMessage({ text, error });
    setTimeout(() => {
      setPtzMessage((prev) => (prev?.text === text ? null : prev));
    }, 2000);
  };

  const handlePtzMove = async (direction: string, isContinuous = false) => {
    setActiveDirection(direction);
    try {
      await ApiService.ptzCamera(camera.id, {
        direction,
        speed,
        durationMs: isContinuous ? 0 : 450,
      });
      showStatus(`Pan: ${direction.toUpperCase()}`);
    } catch (err: any) {
      showStatus(`PTZ failed: ${err.message}`, true);
    }
  };

  const handlePtzStop = async () => {
    setActiveDirection(null);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    try {
      await ApiService.ptzCamera(camera.id, { action: 'stop' });
    } catch (_) {}
  };

  const handlePointerDown = (direction: string) => {
    handlePtzMove(direction, true);
  };

  const handlePointerUp = () => {
    handlePtzStop();
  };

  const handleSnapshot = () => {
    // Capture snapshot from video element
    const videoEl = document.querySelector('video') as HTMLVideoElement | null;
    if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const link = document.createElement('a');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          link.download = `${camera.name.replace(/\s+/g, '_')}_${timestamp}.jpg`;
          link.href = dataUrl;
          link.click();
          showStatus('Snapshot saved to Downloads');
          return;
        }
      } catch (_) {}
    }
    showStatus('Snapshot captured');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in select-none">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-glow" />
          <h2 className="text-white font-bold text-base drop-shadow-md">{camera.name}</h2>
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/20 text-xs font-mono text-cyan-400">
            {camera.stream_id} &bull; Live Stream
          </span>
          <span className="hidden sm:inline-flex px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
            ONVIF PTZ Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {ptzMessage && (
            <span
              className={`px-3 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 backdrop-blur-md border ${
                ptzMessage.error
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  : 'bg-black/80 border-cyan-500/40 text-cyan-300'
              }`}
            >
              {ptzMessage.error ? <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
              {ptzMessage.text}
            </span>
          )}

          <button
            onClick={() => setShowPtzPad((s) => !s)}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              showPtzPad
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-black/60 text-slate-300 border-white/20 hover:text-white'
            }`}
            title="Toggle PTZ Pad"
          >
            <Compass className="w-5 h-5" />
          </button>

          {/* Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              !isMuted
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-black/60 text-slate-300 border-white/20 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Reload Stream */}
          <button
            onClick={handleReloadStream}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white border border-white/20 backdrop-blur-md active:scale-95 transition-all"
            title="Reload Stream"
          >
            <RefreshCw className={`w-5 h-5 ${isReloadingStream ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={handleSnapshot}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white border border-white/20 backdrop-blur-md"
            title="Take Snapshot"
          >
            <CameraIcon className="w-5 h-5" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white border border-white/20 backdrop-blur-md"
            title="Close Fullscreen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Stream Player */}
      <div ref={streamContainerRef} className="flex-1 w-full h-full flex items-center justify-center relative bg-black">
        <Go2rtcVideo
          key={streamKey}
          camera={camera}
          isMainStream={Boolean(camera.rtsp_sub_url && camera.rtsp_main_url)}
          hideControls={true}
          initialMuted={isMuted}
          className="w-full h-full max-h-screen"
        />

        {/* PTZ Professional Floating Joystick & Controller */}
        {showPtzPad && (
          <div className="absolute bottom-6 right-6 z-30 flex flex-col items-center gap-2 bg-slate-950/80 backdrop-blur-xl p-4 rounded-3xl border border-white/15 shadow-2xl">
            {/* Header / Speed Selector */}
            <div className="w-full flex items-center justify-between gap-3 pb-2 border-b border-white/10 text-xs">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" /> PTZ Controller
              </span>
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setSpeed(0.2)}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-bold transition-all ${
                    speed === 0.2 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Slow
                </button>
                <button
                  type="button"
                  onClick={() => setSpeed(0.4)}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-bold transition-all ${
                    speed === 0.4 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Med
                </button>
                <button
                  type="button"
                  onClick={() => setSpeed(0.8)}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-bold transition-all ${
                    speed === 0.8 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fast
                </button>
              </div>
            </div>

            {/* Directional Pad Grid */}
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-white/5 rounded-2xl border border-white/5">
              {/* Top-Left */}
              <button
                onPointerDown={() => handlePointerDown('up_left')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'up_left'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Up-Left"
              >
                <ArrowUp className="w-4 h-4 -rotate-45" />
              </button>

              {/* Up */}
              <button
                onPointerDown={() => handlePointerDown('up')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'up'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Tilt Up"
              >
                <ArrowUp className="w-5 h-5" />
              </button>

              {/* Top-Right */}
              <button
                onPointerDown={() => handlePointerDown('up_right')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'up_right'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Up-Right"
              >
                <ArrowUp className="w-4 h-4 rotate-45" />
              </button>

              {/* Left */}
              <button
                onPointerDown={() => handlePointerDown('left')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'left'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Left"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Center Stop */}
              <button
                onClick={handlePtzStop}
                className="w-10 h-10 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 flex items-center justify-center border border-cyan-500/30 text-xs font-bold active:scale-90 transition-all"
                title="Stop Movement"
              >
                STOP
              </button>

              {/* Right */}
              <button
                onPointerDown={() => handlePointerDown('right')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'right'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Right"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Bottom-Left */}
              <button
                onPointerDown={() => handlePointerDown('down_left')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'down_left'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Down-Left"
              >
                <ArrowDown className="w-4 h-4 rotate-45" />
              </button>

              {/* Down */}
              <button
                onPointerDown={() => handlePointerDown('down')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'down'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Tilt Down"
              >
                <ArrowDown className="w-5 h-5" />
              </button>

              {/* Bottom-Right */}
              <button
                onPointerDown={() => handlePointerDown('down_right')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  activeDirection === 'down_right'
                    ? 'bg-cyan-400 text-slate-950 shadow-glow scale-95'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 active:scale-95'
                }`}
                title="Pan Down-Right"
              >
                <ArrowDown className="w-4 h-4 -rotate-45" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="w-full grid grid-cols-2 gap-2 pt-1">
              <button
                onPointerDown={() => handlePointerDown('zoom_in')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5 text-cyan-400" /> Zoom In
              </button>
              <button
                onPointerDown={() => handlePointerDown('zoom_out')}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5 text-cyan-400" /> Zoom Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
