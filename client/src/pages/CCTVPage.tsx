import React, { useState } from 'react';
import { Video, Search, Maximize2 } from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { Go2rtcVideo } from '../components/cctv/Go2rtcVideo';
import type { Camera } from '../types';

interface CCTVPageProps {
  onOpenFullscreen: (camera: Camera) => void;
  onOpenAdmin: () => void;
  activeFullscreenCameraId?: string | null;
}

export const CCTVPage: React.FC<CCTVPageProps> = ({
  onOpenFullscreen,
  onOpenAdmin,
  activeFullscreenCameraId = null,
}) => {
  const { data } = useBootstrap();
  const cameras = data?.cameras || [];
  const floors = data?.floors || [];

  const [selectedFloorId, setSelectedFloorId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCameras = cameras.filter((cam) => {
    const matchFloor = selectedFloorId === 'all' || cam.floor_id === selectedFloorId;
    const matchSearch =
      cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.stream_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.search_tags.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFloor && matchSearch;
  });

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header & Filters */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-glow">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Live Go2RTC CCTV Wall</h2>
            <p className="text-xs text-slate-400">Zero-Latency WebRTC & MSE Multi-Stream Player</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>

          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="glass-input rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="all" className="bg-slate-900">All Zones & Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id} className="bg-slate-900">
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CCTV Grids */}
      {filteredCameras.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-white/10 space-y-3">
          <Video className="w-10 h-10 text-cyan-400 mx-auto opacity-50" />
          <h4 className="text-sm font-bold text-white">No cameras configured</h4>
          <p className="text-xs text-slate-400">
            Add cameras or sync from Go2RTC server in Admin Studio.
          </p>
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow"
          >
            Configure CCTV
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCameras.map((camera) => (
            <div key={camera.id} className="aspect-video w-full">
              {activeFullscreenCameraId === camera.id ? (
                <div className="w-full h-full bg-slate-950/80 backdrop-blur-md rounded-2xl border border-cyan-500/30 flex flex-col items-center justify-center p-4 text-center">
                  <Maximize2 className="w-6 h-6 text-cyan-400 animate-pulse mb-2" />
                  <span className="text-xs font-semibold text-white">{camera.name}</span>
                  <span className="text-[10px] text-cyan-400 font-mono mt-0.5">Streaming Fullscreen</span>
                </div>
              ) : (
                <Go2rtcVideo
                  camera={camera}
                  onFullscreen={() => onOpenFullscreen(camera)}
                  className="w-full h-full"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
