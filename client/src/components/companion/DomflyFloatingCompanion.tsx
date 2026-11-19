import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DomflyCharacter, DomflyState } from './DomflyCharacter';

interface DomflyFloatingCompanionProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  characterState?: DomflyState;
  currentTab: string;
}

export const DomflyFloatingCompanion: React.FC<DomflyFloatingCompanionProps> = ({
  isChatOpen,
  onToggleChat,
  characterState = 'idle',
  currentTab,
}) => {
  // If the user is currently on the full Assistant page or the chat drawer is open,
  // do not show the floating character (avoids clipping at the top or duplicate characters).
  const isVisible = currentTab !== 'chat' && !isChatOpen;

  return (
    <div className="fixed z-40 pointer-events-none select-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="domfly-floating-anchor"
            className="fixed pointer-events-auto"
            initial={{ opacity: 0, scale: 0.7, y: 24 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              bottom: typeof window !== 'undefined' && window.innerWidth < 768 ? 84 : 24,
              right: typeof window !== 'undefined' && window.innerWidth < 768 ? 16 : 24,
            }}
            exit={{ opacity: 0, scale: 0.7, y: 24 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 26,
            }}
          >
            <DomflyCharacter
              size="md"
              state={characterState}
              interactive={true}
              onClick={onToggleChat}
              showStatusBadge={true}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
