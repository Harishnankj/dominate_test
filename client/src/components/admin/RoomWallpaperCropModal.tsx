import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  Minimize2,
  Move,
  RotateCcw,
  Check,
  Sparkles,
  Grid,
} from 'lucide-react';

export type WallpaperFitMode = 'cover' | 'contain';

export interface CropState {
  fitMode: WallpaperFitMode;
  zoom: number;
  panX: number;
  panY: number;
  rotationDeg: number;
  ambientBlur: boolean;
  aspectRatio: '16:9' | '16:10' | '4:3';
}

const ASPECT_DIMENSIONS: Record<CropState['aspectRatio'], { w: number; h: number; label: string }> = {
  '16:9': { w: 1600, h: 900, label: '16:9 Wide' },
  '16:10': { w: 1600, h: 1000, label: '16:10 Screen' },
  '4:3': { w: 1600, h: 1200, label: '4:3 Card' },
};

function renderWallpaperToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  state: CropState
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return;

  const canvasW = canvas.width;
  const canvasH = canvas.height;

  // Clear with deep dark background
  ctx.fillStyle = '#090A0C';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const isRotated90 = Math.abs(state.rotationDeg) % 180 === 90;
  const effW = isRotated90 ? img.naturalHeight : img.naturalWidth;
  const effH = isRotated90 ? img.naturalWidth : img.naturalHeight;

  // Ambient blurred backdrop when in Fit (contain) mode or if zoomed out
  if (state.ambientBlur) {
    const coverScale = Math.max(canvasW / effW, canvasH / effH);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.filter = 'blur(26px) brightness(0.65)';
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate((state.rotationDeg * Math.PI) / 180);
    ctx.scale(coverScale * 1.08, coverScale * 1.08);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }

  const baseScale =
    state.fitMode === 'cover'
      ? Math.max(canvasW / effW, canvasH / effH)
      : Math.min(canvasW / effW, canvasH / effH);
  const scale = baseScale * state.zoom;

  ctx.save();
  ctx.translate(canvasW / 2 + state.panX * canvasW, canvasH / 2 + state.panY * canvasH);
  ctx.rotate((state.rotationDeg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

interface RoomWallpaperCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  roomName?: string;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => Promise<void> | void;
}

export const RoomWallpaperCropModal: React.FC<RoomWallpaperCropModalProps> = ({
  isOpen,
  imageSrc,
  roomName,
  onClose,
  onApply,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [applying, setApplying] = useState(false);

  const [cropState, setCropState] = useState<CropState>({
    fitMode: 'cover',
    zoom: 1,
    panX: 0,
    panY: 0,
    rotationDeg: 0,
    ambientBlur: true,
    aspectRatio: '16:9',
  });

  // Pointer drag tracking
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Reset crop state whenever a new image opens
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setImgLoaded(false);
      setImgError(null);
      return;
    }

    setImgLoaded(false);
    setImgError(null);
    setCropState({
      fitMode: 'cover',
      zoom: 1,
      panX: 0,
      panY: 0,
      rotationDeg: 0,
      ambientBlur: true,
      aspectRatio: '16:9',
    });

    const img = new window.Image();
    if (!imageSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      loadedImgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      setImgError('Unable to load image for cropping. External URLs may block cross-origin canvas editing — try uploading the photo file directly.');
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Draw live preview whenever state updates
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = loadedImgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const dims = ASPECT_DIMENSIONS[cropState.aspectRatio];
    // Preview canvas at half export resolution for silky smooth real-time dragging
    const targetW = Math.round(dims.w / 2);
    const targetH = Math.round(dims.h / 2);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    renderWallpaperToCanvas(canvas, img, cropState);
  }, [cropState, imgLoaded]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  if (!isOpen || !imageSrc) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imgLoaded) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: cropState.panX,
      startPanY: cropState.panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (e.clientX - dragRef.current.startX) / rect.width;
    const dy = (e.clientY - dragRef.current.startY) / rect.height;
    setCropState((prev) => ({
      ...prev,
      panX: Math.max(-0.85, Math.min(0.85, dragRef.current.startPanX + dx)),
      panY: Math.max(-0.85, Math.min(0.85, dragRef.current.startPanY + dy)),
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!imgLoaded) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setCropState((prev) => ({
      ...prev,
      zoom: Number(Math.max(0.5, Math.min(3.5, prev.zoom + delta)).toFixed(2)),
    }));
  };

  const handleApplyCrop = async () => {
    const img = loadedImgRef.current;
    if (!img || !imgLoaded) return;
    setApplying(true);
    try {
      const dims = ASPECT_DIMENSIONS[cropState.aspectRatio];
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = dims.w;
      exportCanvas.height = dims.h;
      renderWallpaperToCanvas(exportCanvas, img, cropState);
      const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);
      await onApply(dataUrl);
    } catch (err: any) {
      setImgError(err.message || 'Failed to export cropped image');
    } finally {
      setApplying(false);
    }
  };

  const aspectInfo = ASPECT_DIMENSIONS[cropState.aspectRatio];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#191A1D] border border-[#383A3E] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383A3E] flex items-center justify-between bg-[#111214]/80">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Move className="w-4 h-4 text-cyan-400" />
              Adjust &amp; Crop Room Wallpaper {roomName ? `• ${roomName}` : ''}
            </h3>
            <p className="text-[11px] text-[#A6A6A6] mt-0.5">
              Drag photo to reposition, scroll or slide to zoom, and choose Fill or Fit framing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#A6A6A6] hover:text-white hover:bg-[#202226] border border-transparent hover:border-[#383A3E]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Crop Viewport */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {imgError ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center space-y-2">
              <p className="font-semibold">{imgError}</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                className="relative w-full max-w-2xl rounded-2xl overflow-hidden border border-[#383A3E] bg-black shadow-inner select-none"
                style={{ aspectRatio: `${aspectInfo.w} / ${aspectInfo.h}` }}
              >
                <canvas
                  ref={previewCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onWheel={handleWheel}
                  className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
                />

                {/* Rule of Thirds Alignment Grid */}
                {showGrid && imgLoaded && (
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div key={idx} className="border border-white/10" />
                    ))}
                  </div>
                )}

                {!imgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs font-mono text-cyan-400">
                    Loading image preview...
                  </div>
                )}

                {/* Subtle Bottom Help Badge */}
                {imgLoaded && (
                  <div className="absolute bottom-2.5 left-3 pointer-events-none px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                    <Move className="w-3 h-3 text-cyan-400" />
                    Drag to pan • {Math.round(cropState.zoom * 100)}% zoom
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toolbar Controls */}
          <div className="bg-[#111214] rounded-2xl p-4 border border-[#383A3E] space-y-4">
            {/* Row 1: Fit Mode & Aspect Ratio & Rotate */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Fit vs Fill */}
              <div className="flex items-center gap-1.5 bg-[#191A1D] p-1 rounded-xl border border-[#383A3E]">
                <button
                  type="button"
                  onClick={() => setCropState((p) => ({ ...p, fitMode: 'cover', zoom: 1, panX: 0, panY: 0 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cropState.fitMode === 'cover'
                      ? 'bg-white text-[#090A0C] shadow-xs'
                      : 'text-[#A6A6A6] hover:text-white'
                  }`}
                >
                  <Maximize className="w-3.5 h-3.5" /> Crop &amp; Fill
                </button>
                <button
                  type="button"
                  onClick={() => setCropState((p) => ({ ...p, fitMode: 'contain', zoom: 1, panX: 0, panY: 0 }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cropState.fitMode === 'contain'
                      ? 'bg-white text-[#090A0C] shadow-xs'
                      : 'text-[#A6A6A6] hover:text-white'
                  }`}
                >
                  <Minimize2 className="w-3.5 h-3.5" /> Fit Whole Photo
                </button>
              </div>

              {/* Aspect Presets */}
              <div className="flex items-center gap-1 bg-[#191A1D] p-1 rounded-xl border border-[#383A3E]">
                {(Object.keys(ASPECT_DIMENSIONS) as Array<CropState['aspectRatio']>).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setCropState((p) => ({ ...p, aspectRatio: ratio }))}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
                      cropState.aspectRatio === ratio
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-[#A6A6A6] hover:text-white'
                    }`}
                  >
                    {ASPECT_DIMENSIONS[ratio].label}
                  </button>
                ))}
              </div>

              {/* Rotate, Blur Toggle, Grid, Reset */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCropState((p) => ({ ...p, rotationDeg: (p.rotationDeg + 90) % 360 }))
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-xs font-semibold text-white border border-[#383A3E] flex items-center gap-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" /> 90°
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrid((g) => !g)}
                  className={`p-1.5 rounded-xl border transition-colors ${
                    showGrid
                      ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50'
                      : 'bg-[#191A1D] text-[#A6A6A6] border-[#383A3E]'
                  }`}
                  title="Toggle alignment grid"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCropState((p) => ({
                      ...p,
                      zoom: 1,
                      panX: 0,
                      panY: 0,
                      rotationDeg: 0,
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-[#191A1D] hover:bg-[#202226] text-xs font-semibold text-[#A6A6A6] hover:text-white border border-[#383A3E] flex items-center gap-1"
                  title="Reset Crop & Position"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Row 2: Zoom Slider & Ambient Backdrop */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#383A3E]/60">
              <div className="flex items-center gap-3 flex-1">
                <button
                  type="button"
                  onClick={() =>
                    setCropState((p) => ({ ...p, zoom: Math.max(0.5, Number((p.zoom - 0.1).toFixed(2))) }))
                  }
                  className="p-1.5 rounded-lg bg-[#191A1D] text-[#A6A6A6] hover:text-white border border-[#383A3E]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.02"
                  value={cropState.zoom}
                  onChange={(e) => setCropState((p) => ({ ...p, zoom: Number(e.target.value) }))}
                  className="flex-1 accent-cyan-400 h-1.5 bg-[#202226] rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCropState((p) => ({ ...p, zoom: Math.min(3.0, Number((p.zoom + 0.1).toFixed(2))) }))
                  }
                  className="p-1.5 rounded-lg bg-[#191A1D] text-[#A6A6A6] hover:text-white border border-[#383A3E]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-white w-12 text-right">
                  {Math.round(cropState.zoom * 100)}%
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#A6A6A6] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cropState.ambientBlur}
                  onChange={(e) => setCropState((p) => ({ ...p, ambientBlur: e.target.checked }))}
                  className="rounded bg-[#191A1D] border-[#383A3E] text-cyan-400 focus:ring-0"
                />
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ambient blur edge fill (for Fit mode)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#383A3E] bg-[#111214]/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A6A6A6] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={!imgLoaded || applying || !!imgError}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{applying ? 'Saving Photo...' : 'Apply & Save Photo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
