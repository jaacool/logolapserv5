import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// 12 hand-crafted transforms for the 6fps animation loop (2 seconds)
const slideTransforms = [
  { x: -60, y: -150, r: -15, s: 0.8, kx: 10, ky: -5, c: '#ef4444' }, // Red
  { x: 80, y: 180, r: 25, s: 1.2, kx: -15, ky: 10, c: '#3b82f6' },  // Blue
  { x: -100, y: 80, r: -35, s: 0.6, kx: 20, ky: 20, c: '#10b981' }, // Green
  { x: 70, y: -200, r: 10, s: 1.5, kx: -5, ky: -15, c: '#f59e0b' }, // Amber
  { x: 20, y: 120, r: 45, s: 0.9, kx: -25, ky: 5, c: '#8b5cf6' },   // Indigo
  { x: -120, y: -80, r: -5, s: 1.1, kx: 15, ky: -20, c: '#ec4899' },// Pink
  { x: 110, y: -20, r: -40, s: 0.7, kx: -10, ky: -10, c: '#06b6d4' },// Cyan
  { x: -60, y: 220, r: 20, s: 1.3, kx: 5, ky: 15, c: '#eab308' },   // Yellow
  { x: 100, y: -160, r: -20, s: 0.85, kx: -20, ky: 5, c: '#14b8a6' },// Teal
  { x: -90, y: -30, r: 30, s: 1.4, kx: 10, ky: 25, c: '#f43f5e' },  // Rose
  { x: 40, y: 100, r: -50, s: 0.65, kx: -5, ky: -5, c: '#6366f1' }, // Indigo
  { x: -10, y: -180, r: 15, s: 1.1, kx: 25, ky: -15, c: '#84cc16' },// Lime
];

export const HeroAnimation = () => {
  const [frameIndex, setFrameIndex] = useState(0);

  // 6fps interval
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex(i => (i + 1) % slideTransforms.length);
    }, 1000 / 6); 
    return () => clearInterval(interval);
  }, []);

  const currentTransform = slideTransforms[frameIndex];

  // Helper to convert transform object to SVG transform string
  const getTransform = (t: any) => {
    return `translate(${t.x}, ${t.y}) rotate(${t.r}) scale(${t.s}) skewX(${t.kx}) skewY(${t.ky})`;
  };

  // The mathematical inverse of the transform to simulate alignment
  const getInverseTransform = (t: any) => {
    return `skewY(${-t.ky}) skewX(${-t.kx}) scale(${1 / t.s}) rotate(${-t.r}) translate(${-t.x}, ${-t.y})`;
  };

  const LogoGraphic = ({ fill = "#ffffff" }: { fill?: string }) => (
    <g>
      <rect x="-80" y="-35" width="160" height="70" rx="12" fill={fill} opacity="0.15" />
      <rect x="-80" y="-35" width="160" height="70" rx="12" fill="none" stroke={fill} strokeWidth="4" />
      <text x="0" y="12" fill={fill} fontSize="32" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="4">LOGO</text>
    </g>
  );

  const PhotoFrame = ({ stroke = "#4B5563" }: { stroke?: string }) => (
    <g>
      <rect x="-200" y="-300" width="400" height="600" fill="none" stroke={stroke} strokeWidth="6" rx="8" />
      {/* Corner markers */}
      <path d="M -160 -300 L -200 -300 L -200 -260" fill="none" stroke={stroke} strokeWidth="10" />
      <path d="M 160 -300 L 200 -300 L 200 -260" fill="none" stroke={stroke} strokeWidth="10" />
      <path d="M -160 300 L -200 300 L -200 260" fill="none" stroke={stroke} strokeWidth="10" />
      <path d="M 160 300 L 200 300 L 200 260" fill="none" stroke={stroke} strokeWidth="10" />
      {/* Placeholder mountain/sun icon for context */}
      <circle cx="0" cy="-50" r="50" fill={stroke} opacity="0.15" />
      <polygon points="-150,250 -50,50 50,180 100,120 180,250" fill={stroke} opacity="0.15" />
    </g>
  );

  const transitionDuration = 4;

  return (
    <div className="relative w-full max-w-[320px] mx-auto aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 bg-gray-950">
      <svg viewBox="0 0 540 960" className="w-full h-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#374151" strokeWidth="1" opacity="0.3"/>
            <circle cx="0" cy="0" r="2" fill="#4B5563" opacity="0.5" />
          </pattern>

          {/* Mask for the wipe effect */}
          <mask id="wipe-mask">
            {/* Default white: everything visible */}
            <rect x="-1000" y="-1000" width="3000" height="3000" fill="white" />
            <motion.g
              initial={{ x: -1200 }}
              animate={{ x: 1200 }}
              transition={{ duration: transitionDuration, repeat: Infinity, ease: "linear" }}
              transform="rotate(-45 270 480)"
            >
              {/* Black rectangle slides right, hiding the BEFORE layer behind the line */}
              <rect x="-2000" y="-3000" width="2000" height="6000" fill="black" />
            </motion.g>
          </mask>
        </defs>

        {/* --- ANIMATION 2: AFTER (Background layer) --- */}
        {/* Revealed as the mask wipes over the foreground */}
        <g id="after-layer">
          <rect x="0" y="0" width="540" height="960" fill="#111827" />
          <rect x="0" y="0" width="540" height="960" fill="url(#grid)" />
          
          <g transform="translate(270, 480) scale(0.85)">
            {/* Inverse Transformed Frame (jumps around) */}
            <g transform={getInverseTransform(currentTransform)}>
              <PhotoFrame stroke="#6366f1" />
            </g>

            {/* Perfect Center Logo (static) */}
            <LogoGraphic fill="#ffffff" />
          </g>

          {/* AFTER Text */}
          <text x="360" y="900" fill="#818cf8" fontSize="36" fontWeight="bold" letterSpacing="4" opacity="0.8">AFTER</text>
        </g>

        {/* --- ANIMATION 1: BEFORE (Foreground layer, masked) --- */}
        {/* Wiped OUT from bottom-left to top-right */}
        <g id="before-layer" mask="url(#wipe-mask)">
          {/* Need opaque background to hide AFTER layer */}
          <rect x="0" y="0" width="540" height="960" fill="#111827" />
          <rect x="0" y="0" width="540" height="960" fill="url(#grid)" />

          <g transform="translate(270, 480) scale(0.85)">
            {/* Static Frame */}
            <PhotoFrame stroke="#4B5563" />

            {/* Transformed Logo (jumps around) */}
            <g transform={getTransform(currentTransform)}>
              <LogoGraphic fill={currentTransform.c} />
            </g>
          </g>

          {/* BEFORE Text */}
          <text x="40" y="80" fill="#9ca3af" fontSize="36" fontWeight="bold" letterSpacing="4" opacity="0.8">BEFORE</text>
        </g>

        {/* --- WIPE LINE --- */}
        <motion.g
          initial={{ x: -1200 }}
          animate={{ x: 1200 }}
          transition={{ duration: transitionDuration, repeat: Infinity, ease: "linear" }}
          transform="rotate(-45 270 480)"
        >
          {/* Glowing separator line */}
          <line x1="0" y1="-2000" x2="0" y2="2000" stroke="#10b981" strokeWidth="6" />
          <line x1="0" y1="-2000" x2="0" y2="2000" stroke="#10b981" strokeWidth="20" opacity="0.3" />
          <line x1="0" y1="-2000" x2="0" y2="2000" stroke="#34d399" strokeWidth="50" opacity="0.1" />
          
          {/* Scanner effect indicators pointing in direction of sweep */}
          <g transform="translate(0, 0)">
            <polygon points="-20,-20 10,0 -20,20 -10,0" fill="#10b981" />
            <polygon points="-20,-120 10,-100 -20,-80 -10,-100" fill="#10b981" />
            <polygon points="-20,120 10,100 -20,80 -10,100" fill="#10b981" />
          </g>
        </motion.g>
      </svg>
    </div>
  );
};
