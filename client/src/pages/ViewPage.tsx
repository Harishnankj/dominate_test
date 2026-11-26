import React from 'react';
import { Layers, Briefcase, ChevronRight, Users, Sparkles, Video } from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';

interface ViewPageProps {
  selectedFloorId: string;
  setSelectedFloorId: (floorId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: () => void;
}

const ROOM_PHOTOS: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  executive: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
  meeting: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=800&q=80',
  workspace: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
  rd: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
};

export const ViewPage: React.FC<ViewPageProps> = ({
  selectedFloorId,
  setSelectedFloorId,
  onSelectRoom,
  onOpenAdmin,
}) => {
  const { data, getCamerasForRoom } = useBootstrap();
  const { getEntity } = useHA();

  const floors = data?.floors || [];
  const activeFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const rooms = (data?.rooms || []).filter((r) => r.floor_id === (activeFloor?.id || ''));

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Floor Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {floors.map((floor) => {
          const isActive = floor.id === activeFloor?.id;
          return (
            <button
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'bg-[#191A1D] text-[#A6A6A6] hover:text-white border border-[#383A3E]'
              }`}
            >
              <Layers className="w-4 h-4" />
              {floor.name}
            </button>
          );
        })}
      </div>

      {/* Floor Details Header */}
      {activeFloor && (
        <div className="bg-[#191A1D] rounded-2xl p-5 border border-[#383A3E] flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-[#F5F5F5]">{activeFloor.name}</h3>
            <p className="text-xs text-[#A6A6A6] mt-0.5">{rooms.length} Configured Architectural Rooms</p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-[#111214] text-[#F5F5F5] border border-[#383A3E] font-mono text-xs font-semibold">
            Zone: {activeFloor.slug}
          </span>
        </div>
      )}

      {/* Room Cards Grid */}
      {rooms.length === 0 ? (
        <div className="bg-[#191A1D] rounded-2xl p-10 text-center border border-dashed border-[#383A3E] space-y-3">
          <Briefcase className="w-10 h-10 text-[#777777] mx-auto" />
          <h4 className="text-sm font-bold text-[#F5F5F5]">No rooms configured in this floor</h4>
          <p className="text-xs text-[#A6A6A6]">Add rooms or import existing zones via Admin Studio.</p>
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs shadow-sm hover:bg-neutral-200 transition-colors"
          >
            Open Admin Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const roomDevices = (data?.devices || []).filter((d) => d.room_id === room.id);
            const presenceDev = roomDevices.find((d) => d.type === 'presence_sensor');
            const presenceEntity = presenceDev?.entity_id ? getEntity(presenceDev.entity_id) : undefined;
            const isOccupied = presenceEntity?.state === 'on' || presenceEntity?.state === 'detected';
            const roomCameras = getCamerasForRoom ? getCamerasForRoom(room.id) : [];
            const hasCamera = roomCameras.length > 0;

            const photoKey = room.name.toLowerCase().includes('exec')
              ? 'executive'
              : room.name.toLowerCase().includes('meet')
              ? 'meeting'
              : room.name.toLowerCase().includes('r&d') || room.name.toLowerCase().includes('rd')
              ? 'rd'
              : room.name.toLowerCase().includes('work')
              ? 'workspace'
              : 'default';
            const customWallpaper = room.wallpaper_url?.trim();
            const bgImage = customWallpaper || ROOM_PHOTOS[photoKey] || ROOM_PHOTOS.default;

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="group relative rounded-2xl bg-[#191A1D] border border-[#383A3E] hover:border-white/50 transition-all cursor-pointer overflow-hidden shadow-sm flex flex-col"
              >
                {/* Architectural Photo Banner */}
                <div className="relative h-32 w-full overflow-hidden bg-slate-950">
                  <img
                    src={bgImage}
                    alt={room.name}
                    className={`room-card-photo w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      customWallpaper ? 'opacity-80' : 'opacity-60'
                    }`}
                  />
                  <div className="room-card-scrim absolute inset-0 bg-gradient-to-t from-[#191A1D] via-[#191A1D]/40 to-transparent" />
                  
                  {hasCamera && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold backdrop-blur-md bg-black/70 text-cyan-400 border border-cyan-500/30">
                        <Video className="w-3 h-3 text-cyan-400" />
                        <span>CCTV LIVE</span>
                      </span>
                    </div>
                  )}

                  {presenceDev && (
                    <div className="absolute top-3 right-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold backdrop-blur-md border ${
                          isOccupied
                            ? 'bg-[#22D68A]/20 text-[#22D68A] border-[#22D68A]/40'
                            : 'bg-black/60 text-[#A6A6A6] border-white/10'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-[#22D68A] animate-pulse' : 'bg-[#777777]'}`} />
                        {isOccupied ? 'OCCUPIED' : 'CLEAR'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="font-bold text-[#F5F5F5] text-base group-hover:text-white transition-colors">{room.name}</h4>
                    <span className="text-[11px] font-mono text-[#A6A6A6]">
                      {room.is_meeting_room ? 'Executive Meeting Suite' : 'Workspace & Automation Zone'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#A6A6A6] pt-2 border-t border-[#383A3E]/60">
                    <span className="font-mono text-white font-bold">{roomDevices.length} Devices</span>
                    <span className="flex items-center gap-1 text-[#F5F5F5] font-semibold group-hover:translate-x-1 transition-transform">
                      Enter Room <ChevronRight className="w-3.5 h-3.5" />
                    </span>
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
