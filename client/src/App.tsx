import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useBootstrap } from './context/BootstrapContext';
import { Navbar } from './components/navigation/Navbar';
import { BottomNav } from './components/navigation/BottomNav';
import { HomeKeyModal } from './components/navigation/HomeKeyModal';
import { FirstRunWizard } from './components/wizard/FirstRunWizard';
import { AdminStudioPage } from './components/admin/AdminStudioPage';

import { FavoritePage } from './pages/FavoritePage';
import { ViewPage } from './pages/ViewPage';
import { DynamicRoomPage } from './pages/DynamicRoomPage';
import { CCTVPage } from './pages/CCTVPage';
import { CameraFullscreenPage } from './pages/CameraFullscreenPage';
import { ScenesPage } from './pages/ScenesPage';
import { ChatPage } from './pages/ChatPage';
import { AttendancePanel } from './pages/AttendancePanel';
import { LockTestingPage } from './pages/LockTestingPage';

import type { Camera, Room } from './types';

export const App: React.FC = () => {
  const { isSetupCompleted, loading: authLoading } = useAuth();
  const { data, loading: bootstrapLoading, getRoom } = useBootstrap();

  const [currentTab, setCurrentTab] = useState<string>('favorites');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<Camera | null>(null);
  const [adminStudioOpen, setAdminStudioOpen] = useState(false);
  const [adminStudioInitialTab, setAdminStudioInitialTab] = useState<
    'hubs' | 'floors' | 'cameras' | 'ttlock' | 'ir' | 'automations' | 'backup' | 'settings'
  >('hubs');

  const handleOpenAdmin = (
    tab: 'hubs' | 'floors' | 'cameras' | 'ttlock' | 'ir' | 'automations' | 'backup' | 'settings' = 'hubs'
  ) => {
    setAdminStudioInitialTab(tab);
    setAdminStudioOpen(true);
  };

  // Sync initial floor
  React.useEffect(() => {
    if (data?.floors && data.floors.length > 0 && !selectedFloorId) {
      setSelectedFloorId(data.floors[0].id);
    }
  }, [data, selectedFloorId]);

  if (authLoading || bootstrapLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-brand-600 flex items-center justify-center animate-spin shadow-glow">
          <div className="w-6 h-6 rounded-lg bg-[#090d16]" />
        </div>
        <p className="text-xs font-mono text-cyan-400 tracking-widest uppercase animate-pulse">
          Initializing DOMINATEE OS...
        </p>
      </div>
    );
  }

  // If initial setup has not been completed, launch First-Run Wizard
  if (!isSetupCompleted || data?.config.setup_completed === 0 || data?.user_count === 0) {
    return <FirstRunWizard onComplete={() => setCurrentTab('favorites')} />;
  }

  const selectedRoom: Room | undefined = selectedRoomId ? getRoom(selectedRoomId) : undefined;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* HomeKey Gate Check */}
      <HomeKeyModal />

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setSelectedRoomId(null);
          setCurrentTab(tab);
        }}
        selectedFloorId={selectedFloorId}
        setSelectedFloorId={setSelectedFloorId}
        onOpenAdmin={() => handleOpenAdmin('hubs')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 overflow-x-hidden">
        {selectedRoom ? (
          <DynamicRoomPage
            room={selectedRoom}
            onBack={() => setSelectedRoomId(null)}
            onOpenAdmin={() => handleOpenAdmin('floors')}
          />
        ) : (
          <>
            {currentTab === 'favorites' && (
              <FavoritePage
                onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
                onOpenAdmin={() => handleOpenAdmin('hubs')}
              />
            )}

            {currentTab === 'view' && (
              <ViewPage
                selectedFloorId={selectedFloorId}
                setSelectedFloorId={setSelectedFloorId}
                onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
                onOpenAdmin={() => handleOpenAdmin('floors')}
              />
            )}

            {currentTab === 'cctv' && (
              <CCTVPage
                onOpenFullscreen={(cam) => setFullscreenCamera(cam)}
                onOpenAdmin={() => handleOpenAdmin('cameras')}
                activeFullscreenCameraId={fullscreenCamera ? fullscreenCamera.id : null}
              />
            )}

            {currentTab === 'scenes' && (
              <ScenesPage onOpenAdmin={() => handleOpenAdmin('automations')} />
            )}

            {currentTab === 'attendance' && <AttendancePanel />}

            {currentTab === 'chat' && (
              <ChatPage onSelectRoom={(roomId) => setSelectedRoomId(roomId)} />
            )}

            {currentTab === 'locks' && <LockTestingPage />}
          </>
        )}
      </main>

      {/* Mobile/Tablet Bottom Navigation */}
      <BottomNav
        currentTab={selectedRoomId ? 'view' : currentTab}
        setCurrentTab={(tab) => {
          setSelectedRoomId(null);
          setCurrentTab(tab);
        }}
      />

      {/* Live Admin Studio Modal */}
      {adminStudioOpen && (
        <AdminStudioPage
          onClose={() => setAdminStudioOpen(false)}
          initialTab={adminStudioInitialTab}
        />
      )}

      {/* Fullscreen Camera Player Modal */}
      {fullscreenCamera && (
        <CameraFullscreenPage
          camera={fullscreenCamera}
          onClose={() => setFullscreenCamera(null)}
        />
      )}
    </div>
  );
};

export default App;
