import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, Volume2, CheckCircle2 } from 'lucide-react';

export type DomflyState =
  | 'idle'
  | 'greeting'
  | 'hover'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'success';

interface DomflyCharacterProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  state?: DomflyState;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  showStatusBadge?: boolean;
  statusText?: string;
}

const SIZE_MAP = {
  sm: { w: 85, h: 90, scale: 0.8 },
  md: { w: 120, h: 125, scale: 1.0 },
  lg: { w: 170, h: 175, scale: 1.4 },
  xl: { w: 220, h: 225, scale: 1.8 },
};

export const DomflyCharacter: React.FC<DomflyCharacterProps> = ({
  size = 'md',
  state = 'idle',
  interactive = true,
  className = '',
  onClick,
  showStatusBadge = false,
  statusText,
}) => {
  const [internalState, setInternalState] = useState<DomflyState>(state);
  const [mouseGaze, setMouseGaze] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state with prop state
  useEffect(() => {
    setInternalState(state);
  }, [state]);

  // Occasional periodic greeting / wave when idle
  useEffect(() => {
    if (state !== 'idle') return;
    const interval = setInterval(() => {
      // Trigger a brief greeting wave for 3.5 seconds
      setInternalState('greeting');
      setTimeout(() => {
        setInternalState((curr) => (curr === 'greeting' ? 'idle' : curr));
      }, 3500);
    }, 24000);

    return () => clearInterval(interval);
  }, [state]);

  // Burst sparkles on success
  useEffect(() => {
    if (state === 'success') {
      const newSparkles = Array.from({ length: 6 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 80,
        y: -20 - Math.random() * 60,
      }));
      setSparkles(newSparkles);
      const timer = setTimeout(() => setSparkles([]), 1800);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Interactive 3D Cursor Gaze Tracking
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 3; // Focus on eye level

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Limit rotation angles to subtle natural range
      const rotY = Math.max(-14, Math.min(14, (deltaX / window.innerWidth) * 28));
      const rotX = Math.max(-10, Math.min(10, -(deltaY / window.innerHeight) * 20));

      setMouseGaze({ rotateX: rotX, rotateY: rotY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive]);

  const activeState = isHovered && internalState === 'idle' ? 'hover' : internalState;
  const dim = SIZE_MAP[size];

  // Headphone glow opacity & scale based on listening
  const isListening = activeState === 'listening';
  const isProcessing = activeState === 'processing';
  const isSpeaking = activeState === 'speaking';
  const isSuccess = activeState === 'success';
  const isGreeting = activeState === 'greeting';

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: dim.w,
        height: dim.h,
        perspective: 800,
      }}
      className={`relative select-none flex flex-col items-center justify-center cursor-pointer group ${className}`}
      role="button"
      aria-label="DOMFLY AI Companion"
    >
      {/* 1. SOFT PURPLE AMBIENT FLOOR SHADOW */}
      <motion.div
        className="absolute bottom-2 w-3/4 h-4 rounded-full bg-purple-600/25 blur-md pointer-events-none"
        animate={{
          scale: [1, 0.8, 1],
          opacity: [0.35, 0.2, 0.35],
        }}
        transition={{
          duration: 3.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* 2. FLOATING & ROTATING CHARACTER BODY WRAPPER */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center pointer-events-auto"
        animate={{
          y: isGreeting
            ? [0, -12, -4, -10, 0]
            : isSuccess
            ? [0, -18, -2, -10, 0]
            : [0, -8, 0],
          rotateZ: isGreeting
            ? [-1, 3.5, -2, 2, -1]
            : [-0.8, 0.8, -0.8],
        }}
        transition={{
          duration: isSuccess ? 1.2 : isGreeting ? 3.0 : 3.6,
          repeat: isSuccess || isGreeting ? 0 : Infinity,
          ease: 'easeInOut',
        }}
        style={{
          transformStyle: 'preserve-3d',
          transform: `perspective(800px) rotateX(${mouseGaze.rotateX}deg) rotateY(${mouseGaze.rotateY}deg)`,
          transition: 'transform 0.15s ease-out',
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
      >
        {/* A. PROCESSING ORBITAL RINGS */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <motion.div
              className="w-32 h-32 rounded-full border-2 border-purple-500/60 border-t-transparent border-b-purple-300"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              style={{
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
              }}
            />
            <motion.div
              className="absolute w-24 h-24 rounded-full border border-purple-400/40 border-l-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {/* B. LISTENING HEADPHONE AUDIO WAVE PULSES */}
        {isListening && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Glowing Earcup Wave (positioned on headphone) */}
            <motion.div
              className="absolute left-[12%] top-[48%] w-12 h-12 rounded-full border border-purple-400/90 bg-purple-500/25 -translate-x-1/2 -translate-y-1/2"
              animate={{ scale: [0.7, 1.9], opacity: [0.95, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute left-[12%] top-[48%] w-8 h-8 rounded-full border border-purple-300/80 bg-purple-400/30 -translate-x-1/2 -translate-y-1/2"
              animate={{ scale: [0.6, 1.5], opacity: [0.85, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        )}

        {/* C. SPEAKING CADENCE (Subtle vertical jaw nod) */}
        <motion.div
          className="relative w-full h-full flex items-center justify-center"
          animate={
            isSpeaking
              ? {
                  scaleY: [1, 1.025, 0.985, 1.02, 1],
                  y: [0, -2, 1, -1.5, 0],
                }
              : {}
          }
          transition={{
            duration: 0.5,
            repeat: isSpeaking ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          {/* THE 3D DOLPHIN SPRITE */}
          <img
            src="/domfly_companion.png"
            alt="DOMFLY AI Dolphin Companion"
            className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_12px_24px_rgba(168,85,247,0.35)] filter transition-all duration-300"
            draggable={false}
          />
        </motion.div>

        {/* D. SUCCESS SPARKLES BURST */}
        <AnimatePresence>
          {sparkles.map((sp) => (
            <motion.div
              key={sp.id}
              initial={{ opacity: 1, scale: 0.2, x: 0, y: -20 }}
              animate={{ opacity: 0, scale: 1.2, x: sp.x, y: sp.y }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute pointer-events-none text-purple-300 z-20"
            >
              <Sparkles className="w-4 h-4 fill-purple-300 drop-shadow-[0_0_8px_#A855F7]" />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* 3. SLEEK STATUS BADGE / GREETING PILL */}
      <AnimatePresence>
        {(showStatusBadge || isHovered || isListening || isProcessing || isSpeaking) && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-7 whitespace-nowrap px-3 py-1 rounded-full bg-[#191A1D]/95 border border-purple-500/40 text-[11px] font-mono font-bold text-white shadow-xl shadow-purple-950/40 backdrop-blur-md flex items-center gap-1.5 pointer-events-none z-30"
          >
            {isListening ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span className="text-purple-300">Listening...</span>
              </>
            ) : isProcessing ? (
              <>
                <motion.span
                  className="w-2 h-2 rounded-full bg-purple-400"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className="text-purple-300">Processing...</span>
              </>
            ) : isSpeaking ? (
              <>
                <Volume2 className="w-3 h-3 text-purple-300 animate-pulse" />
                <span className="text-purple-200">DOMFLY speaking</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-[#22D68A]" />
                <span className="text-[#22D68A]">Done!</span>
              </>
            ) : statusText ? (
              <span>{statusText}</span>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Chat with DOMFLY</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
