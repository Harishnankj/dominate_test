import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatPage } from '../../pages/ChatPage';
import type { Camera } from '../../types';
import type { DomflyState } from './DomflyCharacter';

interface FloatingAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenFullscreenCamera?: (camera: Camera) => void;
  onStateChange?: (state: DomflyState) => void;
}

export const FloatingAssistantDrawer: React.FC<FloatingAssistantDrawerProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
  onNavigateToTab,
  onOpenFullscreenCamera,
  onStateChange,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="floating-assistant-panel"
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.94 }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 28,
          }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-32px)] sm:w-[460px] h-[600px] max-h-[82vh] bg-[#191A1D]/98 border border-[#383A3E] rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-2xl"
          style={{
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.15)',
          }}
        >
          <ChatPage
            isFloating={true}
            onClose={onClose}
            onNavigateToTab={(tab) => {
              onClose();
              onNavigateToTab?.(tab);
            }}
            onSelectRoom={onSelectRoom}
            onOpenFullscreenCamera={onOpenFullscreenCamera}
            onStateChange={onStateChange}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
