import React from 'react';
import { Layers, Briefcase, ChevronRight, Radio, Lightbulb, Users } from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';

interface ViewPageProps {
  selectedFloorId: string;
  setSelectedFloorId: (floorId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: () => void;
}

export const ViewPage: React.FC<ViewPageProps> = ({
  selectedFloorId,
  setSelectedFloorId,
  onSelectRoom,
  onOpenAdmin,
}) => {
  const { data } = useBootstrap();
  const { getEntity } = useHA();

  const floors = data?.floors || [];
  const activeFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const rooms = (data?.rooms || []).filter((r) => r.floor_id === (activeFloor?.id || ''));

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Floor Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {floors.map((floor) => {
          const isActive = floor.id === activeFloor?.id;
          return (
            <button
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-brand-600 text-white shadow-glow'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/10'
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
        <div className="glass-panel rounded-2xl p-4 border border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">{activeFloor.name}</h3>
            <p className="text-xs text-slate-400">{rooms.length} Rooms Configured</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 font-mono text-xs">
            Zone: {activeFloor.slug}
          </span>
        </div>
      )}

      {/* Room Cards Grid */}
      {rooms.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center border border-dashed border-white/10 space-y-3">
          <Briefcase className="w-10 h-10 text-cyan-400 mx-auto opacity-50" />
          <h4 className="text-sm font-bold text-white">No rooms in this floor</h4>
          <p className="text-xs text-slate-400">Add rooms or run 1-Click Import in Admin Studio.</p>
          <button
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow"
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

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-cyan-500/40 tile-hover cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{room.name}</h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {room.is_meeting_room ? 'Meeting Suite' : 'Workspace'}
                      </span>
                    </div>
                  </div>

                  {presenceDev && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isOccupied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {isOccupied ? 'OCCUPIED' : 'CLEAR'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                  <span className="font-mono text-cyan-400">{roomDevices.length} Devices</span>
                  <span className="flex items-center gap-1 text-slate-300 font-semibold group-hover:text-cyan-400">
                    Control Room <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
