import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

export const HeroAnimation = () => {
  const [frameIndex, setFrameIndex] = useState(0);

  // Generate 60 random frames for 10 seconds at 6fps
  const frames = useMemo(() => {
    return Array.from({length: 60}).map(() => ({
      logo: {
        x: Math.random() * 200 - 100,
        y: Math.random() * 400 - 200,
        scaleX: 0.6 + Math.random() * 0.8,
        scaleY: 0.6 + Math.random() * 0.8,
        skewX: Math.random() * 60 - 30,
        skewY: Math.random() * 60 - 30,
        rotate: Math.random() * 80 - 40,
      },
      frame: {
        x: Math.random() * 150 - 75,
        y: Math.random() * 150 - 75,
        scaleX: 0.7 + Math.random() * 0.5,
        scaleY: 0.7 + Math.random() * 0.5,
        skewX: Math.random() * 30 - 15,
        skewY: Math.random() * 30 - 15,
        rotate: Math.random() * 40 - 20,
      }
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex(i => (i + 1) % 60);
    }, 1000 / 6); // 6 fps
    return () => clearInterval(interval);
  }, []);

  const currentFrame = frames[frameIndex];

  // Helper to convert transform object to SVG transform string
  const getTransform = (t: any) => {
    return `translate(${t.x}, ${t.y}) rotate(${t.rotate}) scale(${t.scaleX}, ${t.scaleY}) skewX(${t.skewX}) skewY(${t.skewY})`;
  };

  const transition = { duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } as const;

  return (
    <div className="relative w-full max-w-[320px] mx-auto aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 bg-gray-950">
      <svg viewBox="0 0 540 960" className="w-full h-full">
        <defs>
          {/* Background Grid Pattern */}
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#374151" strokeWidth="2" opacity="0.5"/>
            <circle cx="0" cy="0" r="3" fill="#4B5563" />
          </pattern>

          {/* Mask for the wipe effect */}
          <mask id="wipe-mask">
            {/* Black hides the masked content by default */}
            <rect x="-1000" y="-1000" width="3000" height="3000" fill="black" />
            <motion.g
              initial={{ x: -200, y: 1200 }}
              animate={{ x: 700, y: -200 }}
              transition={transition}
            >
              {/* White reveals the masked content. Since line is rotated 30deg, top-right is negative Y */}
              <rect x="-2000" y="-3000" width="4000" height="3000" fill="white" transform="rotate(30)" />
            </motion.g>
          </mask>
        </defs>

        {/* --- ANIMATION 2: AFTER (Background layer) --- */}
        <g id="after-layer">
          {/* Distorted Frame (representing the un-aligned target image borders) */}
          <g transform={`translate(270, 480) ${getTransform(currentFrame.frame)}`}>
            <rect x="-270" y="-480" width="540" height="960" fill="url(#grid)" />
            <rect x="-270" y="-480" width="540" height="960" fill="none" stroke="#6366f1" strokeWidth="12" strokeDasharray="30 20" />
            
            {/* Faux image elements jumping around to show distortion */}
            <circle cx="-100" cy="-200" r="80" fill="#4B5563" opacity="0.3" />
            <rect x="50" y="100" width="150" height="200" fill="#4B5563" opacity="0.3" rx="20" />
            <path d="M -200 300 Q -100 200 0 300 T 200 300" fill="none" stroke="#4B5563" strokeWidth="10" opacity="0.3" />
          </g>

          {/* Perfect Logo (Aligned, stationary) */}
          <g transform="translate(270, 480)">
            <g transform="scale(4)" fill="#6366f1">
               {/* Hexagon Logo shape */}
               <polygon points="0,-25 22,-12 22,12 0,25 -22,12 -22,-12" />
               <text x="0" y="45" fill="white" fontSize="16" fontWeight="900" textAnchor="middle" letterSpacing="2" style={{ textShadow: "0px 2px 4px rgba(0,0,0,0.5)" }}>LOGO</text>
            </g>
          </g>
          
          <text x="40" y="900" fill="#a5b4fc" fontSize="48" fontWeight="bold" letterSpacing="4" style={{ textShadow: "0px 4px 10px rgba(0,0,0,0.8)" }}>AFTER</text>
        </g>

        {/* --- ANIMATION 1: BEFORE (Foreground layer, masked) --- */}
        <g id="before-layer" mask="url(#wipe-mask)">
          {/* Static Frame */}
          <rect x="0" y="0" width="540" height="960" fill="#111827" />
          <rect x="0" y="0" width="540" height="960" fill="url(#grid)" />
          <rect x="0" y="0" width="540" height="960" fill="none" stroke="#ef4444" strokeWidth="12" />
          
          {/* Faux image elements (static) */}
          <circle cx="170" cy="280" r="80" fill="#4B5563" opacity="0.3" />
          <rect x="320" y="580" width="150" height="200" fill="#4B5563" opacity="0.3" rx="20" />
          <path d="M 50 700 Q 150 600 250 700 T 450 700" fill="none" stroke="#4B5563" strokeWidth="10" opacity="0.3" />

          {/* Distorted Logo jumping around at 6fps */}
          <g transform={`translate(270, 480) ${getTransform(currentFrame.logo)}`}>
            <g transform="scale(4)" fill="#ef4444">
               <polygon points="0,-25 22,-12 22,12 0,25 -22,12 -22,-12" />
               <text x="0" y="45" fill="white" fontSize="16" fontWeight="900" textAnchor="middle" letterSpacing="2" style={{ textShadow: "0px 2px 4px rgba(0,0,0,0.5)" }}>LOGO</text>
            </g>
          </g>

          <text x="40" y="80" fill="#fca5a5" fontSize="48" fontWeight="bold" letterSpacing="4" style={{ textShadow: "0px 4px 10px rgba(0,0,0,0.8)" }}>BEFORE</text>
        </g>

        {/* --- WIPE LINE --- */}
        <motion.g
          initial={{ x: -200, y: 1200 }}
          animate={{ x: 700, y: -200 }}
          transition={transition}
        >
          {/* Main glowing separator line */}
          <line x1="-1500" y1="0" x2="1500" y2="0" stroke="#10b981" strokeWidth="12" transform="rotate(30)" />
          <line x1="-1500" y1="0" x2="1500" y2="0" stroke="#10b981" strokeWidth="30" opacity="0.3" transform="rotate(30)" />
          
          {/* Scanning arrows on the line */}
          <g transform="rotate(30)">
            <polygon points="-50,-20 0,0 -50,20 -40,0" fill="#10b981" />
            <polygon points="50,-20 0,0 50,20 40,0" fill="#10b981" />
          </g>
        </motion.g>
      </svg>
    </div>
  );
};
