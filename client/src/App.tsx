import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useBootstrap } from './context/BootstrapContext';
import { Sidebar } from './components/navigation/Sidebar';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
      <div className="min-h-screen bg-[#090A0C] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-white text-[#090A0C] flex items-center justify-center font-black text-xl animate-pulse shadow-sm">
          D
        </div>
        <p className="text-xs font-mono text-[#A6A6A6] tracking-widest uppercase animate-pulse">
          Initializing DOMINATE Smart Building OS...
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
    <div className="min-h-screen bg-[#090A0C] text-[#F5F5F5] flex">
      {/* HomeKey Gate Check */}
      <HomeKeyModal />

      {/* Desktop Fixed Left Sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-30">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setSelectedRoomId(null);
            setCurrentTab(tab);
          }}
          onOpenAdmin={handleOpenAdmin}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-[260px] h-full shadow-2xl">
            <Sidebar
              currentTab={currentTab}
              setCurrentTab={(tab) => {
                setSelectedRoomId(null);
                setCurrentTab(tab);
                setMobileSidebarOpen(false);
              }}
              onOpenAdmin={(tab) => {
                setMobileSidebarOpen(false);
                handleOpenAdmin(tab);
              }}
            />
          </div>
        </div>
      )}

      {/* Main View Area (Offset by 260px on Desktop) */}
      <div className="flex-1 flex flex-col min-h-screen md:pl-[260px] overflow-x-hidden">
        {/* Top Navbar */}
        <Navbar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setSelectedRoomId(null);
            setCurrentTab(tab);
          }}
          selectedFloorId={selectedFloorId}
          setSelectedFloorId={setSelectedFloorId}
          onOpenAdmin={handleOpenAdmin}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Viewport Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
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
                  onOpenAdmin={handleOpenAdmin}
                  onNavigateToRooms={() => setCurrentTab('view')}
                  onOpenFullscreenCamera={(cam) => setFullscreenCamera(cam)}
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

              {(currentTab === 'scenes' || currentTab === 'automations') && (
                <ScenesPage onOpenAdmin={() => handleOpenAdmin('automations')} />
              )}

              {currentTab === 'chat' && (
                <ChatPage
                  onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
                  onNavigateToTab={(tab) => {
                    setSelectedRoomId(null);
                    setCurrentTab(tab);
                  }}
                  onOpenFullscreenCamera={(cam) => setFullscreenCamera(cam)}
                />
              )}

              {/* Devices inventory view */}
              {currentTab === 'devices' && (
                <ViewPage
                  selectedFloorId={selectedFloorId}
                  setSelectedFloorId={setSelectedFloorId}
                  onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
                  onOpenAdmin={() => handleOpenAdmin('floors')}
                />
              )}

              {/* Energy monitoring tab navigates to Dashboard Energy section */}
              {currentTab === 'energy' && (
                <FavoritePage
                  onSelectRoom={(roomId) => setSelectedRoomId(roomId)}
                  onOpenAdmin={handleOpenAdmin}
                  onNavigateToRooms={() => setCurrentTab('view')}
                  onOpenFullscreenCamera={(cam) => setFullscreenCamera(cam)}
                />
              )}

              {currentTab === 'locks' && <LockTestingPage />}
            </>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          currentTab={selectedRoomId ? 'view' : currentTab}
          setCurrentTab={(tab) => {
            setSelectedRoomId(null);
            setCurrentTab(tab);
          }}
        />
      </div>

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
