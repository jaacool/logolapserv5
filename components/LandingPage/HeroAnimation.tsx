import React from 'react';
import { motion } from 'framer-motion';

export const HeroAnimation = () => {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center">
      {/* Background Target Image representation */}
      <motion.div
        className="absolute w-64 h-64 border-2 border-gray-700 bg-gray-800 rounded-xl overflow-hidden shadow-2xl"
        initial={{ rotateX: 0, rotateY: 0, scale: 0.8 }}
        animate={{ 
          rotateX: 45, 
          rotateY: 15, 
          scale: 1,
          z: -50
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          repeatType: "reverse", 
          ease: "easeInOut" 
        }}
        style={{ perspective: 1000, transformStyle: "preserve-3d" }}
      >
        {/* Grid pattern to simulate a surface */}
        <div className="w-full h-full opacity-20" style={{
          backgroundImage: 'linear-gradient(45deg, #4B5563 25%, transparent 25%, transparent 75%, #4B5563 75%, #4B5563), linear-gradient(45deg, #4B5563 25%, transparent 25%, transparent 75%, #4B5563 75%, #4B5563)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px'
        }}></div>
      </motion.div>

      {/* Floating Logo representation */}
      <motion.div
        className="absolute w-32 h-32 bg-indigo-500 rounded-lg flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)] border border-indigo-300"
        initial={{ y: -100, opacity: 0, rotateZ: -10 }}
        animate={{ 
          y: [null, 0, 0], 
          opacity: [null, 1, 1],
          rotateZ: [null, 0, 0],
          rotateX: [null, 45, 45],
          rotateY: [null, 15, 15]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          repeatType: "reverse", 
          ease: "easeInOut",
          times: [0, 0.5, 1]
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-white">
          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
        </svg>
      </motion.div>

      {/* Scanning effect line */}
      <motion.div
        className="absolute w-72 h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)]"
        initial={{ y: -150, opacity: 0 }}
        animate={{ 
          y: [-150, 150], 
          opacity: [0, 1, 1, 0] 
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity, 
          ease: "linear",
          delay: 1.5
        }}
      />
    </div>
  );
};
