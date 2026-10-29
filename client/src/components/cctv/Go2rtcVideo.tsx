import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Maximize2,
  RefreshCw,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  Volume2,
  VolumeX,
  AlertCircle,
} from 'lucide-react';
import type { Camera } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { ApiService } from '../../services/api';
import { VideoRTC } from './video-rtc.js';

interface Go2rtcVideoProps {
  camera: Camera;
  isMainStream?: boolean;
  onFullscreen?: () => void;
  hideControls?: boolean;
  className?: string;
  initialMuted?: boolean;
}

export const Go2rtcVideo: React.FC<Go2rtcVideoProps> = ({
  camera,
  isMainStream = false,
  onFullscreen,
  hideControls = false,
  className = '',
  initialMuted = true,
}) => {
  const { data } = useBootstrap();

  const streamId = camera.stream_id;

  // Resolves the WebSocket URL: directly connects to Go2RTC port 1984 (or configured base URL)
  const wsUrl = useMemo(() => {
    const wsProtocol =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Normalize 'localhost' to '127.0.0.1' to avoid Chrome IPv6 [::1] loopback connection drops on Windows
    let host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
    if (host === 'localhost') {
      host = '127.0.0.1';
    }

    let port = '1984';

    if (data?.config?.go2rtc_base_url) {
      try {
        const u = new URL(data.config.go2rtc_base_url);
        if (u.port) port = u.port;
        if (u.hostname && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1' && u.hostname !== '') {
          host = u.hostname;
        }
      } catch (_) {}
    }

    return `${wsProtocol}//${host}:${port}/api/ws?src=${encodeURIComponent(streamId)}`;
  }, [data?.config?.go2rtc_base_url, streamId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [hasAudio, setHasAudio] = useState(false);
  const [showMiniPtz, setShowMiniPtz] = useState(false);
  const [miniPtzDir, setMiniPtzDir] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rtcRef = useRef<VideoRTC | null>(null);

  // Initialize and mount VideoRTC
  useEffect(() => {
    if (!videoRef.current) return;

    if (reloadKey === 0) {
      setIsPlaying(false);
    }
    setHasError(false);

    const video = videoRef.current;
    const rtc = new VideoRTC(video);
    rtcRef.current = rtc;
    rtc.mode = 'webrtc';
    rtc.media = 'video,audio';
    rtc.background = true;

    video.muted = isMuted;
    video.defaultMuted = isMuted;

    // Safety timeout: if stream does not deliver playable frames within 15 seconds, display retry state
    const connectionTimeout = setTimeout(() => {
      if (!video.srcObject || (video.paused && video.readyState < 2)) {
        setIsReloading(false);
        setIsPlaying(false);
        setHasError(true);
      } else {
        handleStreamLive();
      }
    }, 15000);

    const checkAudioTracks = () => {
      if (video.srcObject instanceof MediaStream) {
        if (video.srcObject.getAudioTracks().length > 0) {
          setHasAudio(true);
        }
      }
    };

    const handleStreamLive = () => {
      clearTimeout(connectionTimeout);
      setIsPlaying(true);
      setIsReloading(false);
      setHasError(false);
      checkAudioTracks();
    };

    rtc.onConnected = handleStreamLive;

    const onPlaying = () => {
      handleStreamLive();
    };

    video.addEventListener('playing', onPlaying);

    // Connect stream
    rtc.src = wsUrl;

    return () => {
      clearTimeout(connectionTimeout);
      video.removeEventListener('playing', onPlaying);
      try {
        rtc.destroy();
      } catch (_) {}
      rtcRef.current = null;
    };
  }, [wsUrl, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mute state changes to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.defaultMuted = isMuted;
    }
  }, [isMuted]);

  // Manual reload button handler: increments reloadKey to trigger a clean effect remount
  const handleRetry = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsReloading(true);
      setHasError(false);
      setReloadKey((k) => k + 1);
    },
    []
  );

  // Toggle Mute / Sound
  const handleToggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMuted((prev) => !prev);
  }, []);

  const handleMiniPtz = async (dir: string) => {
    setMiniPtzDir(dir);
    try {
      await ApiService.ptzCamera(camera.id, { direction: dir, speed: 0.4, durationMs: 400 });
    } catch (_) {}
    setTimeout(() => setMiniPtzDir(null), 400);
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-950 rounded-2xl overflow-hidden border border-white/10 group ${className}`}
    >
      {/* Native HTML5 video element controlled by VideoRTC */}
      <video
        ref={videoRef}
        playsInline
        muted={isMuted}
        className="w-full h-full block bg-black object-cover"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Error state overlay with retry button */}
      {hasError && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-xs z-10 p-4">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div className="p-2 rounded-full bg-red-950/60 border border-red-500/40 text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-300">Stream Connection Timeout</span>
            <button
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect Stream
            </button>
          </div>
        </div>
      )}

      {/* Subtle connection spinner (fades out as soon as video frames render) */}
      {(!isPlaying || isReloading) && !hasError && (
        <div className={`absolute inset-0 flex items-center justify-center ${isPlaying ? 'bg-black/50' : 'bg-black/75'} backdrop-blur-xs pointer-events-none z-10 transition-opacity duration-300`}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-[11px] font-mono text-cyan-300">
              {isReloading ? 'Reloading stream...' : 'Connecting stream...'}
            </span>
          </div>
        </div>
      )}

      {/* Top Overlay Badge (hidden in dedicated fullscreen view) */}
      {!hideControls && (
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-semibold text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {camera.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-cyan-400 border border-cyan-800/40">
            {streamId}
          </span>
          {hasAudio && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 text-[9px] font-mono text-cyan-300 border border-cyan-800/50">
              AUDIO
            </span>
          )}
          {camera.ptz_enabled !== 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-[9px] font-mono text-emerald-300 border border-emerald-800/50">
              PTZ
            </span>
          )}
        </div>
      )}

      {/* Control Buttons (hidden in dedicated fullscreen view) */}
      {!hideControls && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* Mute/Unmute Toggle */}
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Audio (Hear Sound)' : 'Mute Audio'}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-all ${
              !isMuted
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-glow'
                : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border-white/10'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {camera.ptz_enabled !== 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMiniPtz((s) => !s);
              }}
              title="Pan / Tilt Camera"
              className={`p-1.5 rounded-lg border backdrop-blur-md transition-all ${
                showMiniPtz
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-glow'
                  : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border-white/10'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleRetry}
            disabled={isReloading}
            title="Reload stream"
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {onFullscreen && (
            <button
              onClick={onFullscreen}
              title="Expand Fullscreen"
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 backdrop-blur-md shadow-glow active:scale-95 transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Audio toggle for fullscreen mode */}
      {hideControls && (
        <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Audio (Hear Sound)' : 'Mute Audio'}
            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
              !isMuted
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-glow'
                : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white border-white/10'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Mini On-Card PTZ Controller Overlay */}
      {showMiniPtz && !hideControls && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 z-20 bg-slate-950/90 backdrop-blur-xl p-2 rounded-2xl border border-white/15 shadow-2xl flex flex-col items-center gap-1 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between w-full pb-1 border-b border-white/10 text-[10px] text-slate-300 font-bold px-1 gap-2">
            <span className="flex items-center gap-1 text-cyan-400">
              <Compass className="w-3 h-3" /> Quick Rotate
            </span>
            <button
              onClick={() => setShowMiniPtz(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => handleMiniPtz('up')}
            className={`p-1.5 rounded-lg transition-all ${
              miniPtzDir === 'up'
                ? 'bg-cyan-400 text-slate-950 shadow-glow'
                : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
            }`}
            title="Tilt Up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleMiniPtz('left')}
              className={`p-1.5 rounded-lg transition-all ${
                miniPtzDir === 'left'
                  ? 'bg-cyan-400 text-slate-950 shadow-glow'
                  : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
              }`}
              title="Pan Left"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => ApiService.ptzCamera(camera.id, { action: 'stop' }).catch(() => {})}
              className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/15 text-[9px] font-bold text-slate-300 flex items-center justify-center border border-white/10"
              title="Stop"
            >
              &bull;
            </button>
            <button
              onClick={() => handleMiniPtz('right')}
              className={`p-1.5 rounded-lg transition-all ${
                miniPtzDir === 'right'
                  ? 'bg-cyan-400 text-slate-950 shadow-glow'
                  : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
              }`}
              title="Pan Right"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => handleMiniPtz('down')}
            className={`p-1.5 rounded-lg transition-all ${
              miniPtzDir === 'down'
                ? 'bg-cyan-400 text-slate-950 shadow-glow'
                : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
            }`}
            title="Tilt Down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tags pill */}
      {camera.search_tags && !hideControls && (
        <div className="absolute bottom-3 left-3 pointer-events-none z-10">
          <span className="text-[10px] font-mono text-slate-400 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/5">
            {camera.search_tags}
          </span>
        </div>
      )}
    </div>
  );
};
