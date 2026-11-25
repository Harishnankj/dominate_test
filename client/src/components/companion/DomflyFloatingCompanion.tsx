import React from 'react';
import { createPortal } from 'react-dom';
import { DomflyCharacter, DomflyState } from './DomflyCharacter';

interface DomflyFloatingCompanionProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  characterState?: DomflyState;
  currentTab: string;
  adminStudioOpen?: boolean;
}

export const DomflyFloatingCompanion: React.FC<DomflyFloatingCompanionProps> = ({
  isChatOpen,
  onToggleChat,
  characterState = 'idle',
  currentTab,
  adminStudioOpen = false,
}) => {
  // If the chat drawer is open or user is viewing the full Chat page (without Admin Studio modal open),
  // hide floating companion to prevent duplicates.
  // In ALL themes (Obsidian Dark, Silver Crystal Glass) and in Admin Studio, ALWAYS render!
  const isVisible = !isChatOpen && (adminStudioOpen || currentTab !== 'chat');

  if (!isVisible || typeof document === 'undefined') {
    return null;
  }

  const content = (
    <div
      id="domfly-floating-companion-portal"
      aria-label="DOMFLY AI Companion"
      className="domfly-companion-anchor fixed pointer-events-auto select-none"
      style={{
        position: 'fixed',
        bottom: typeof window !== 'undefined' && window.innerWidth < 768 ? '84px' : '24px',
        right: typeof window !== 'undefined' && window.innerWidth < 768 ? '16px' : '24px',
        zIndex: 2147483647,
        width: 120,
        height: 135,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto',
      }}
    >
      <DomflyCharacter
        size="md"
        state={characterState}
        interactive={true}
        onClick={onToggleChat}
        showStatusBadge={true}
      />
    </div>
  );

  return createPortal(content, document.body);
};
