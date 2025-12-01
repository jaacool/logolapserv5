import React from 'react';
import type { AspectRatio } from '../types';

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onSelectRatio: (ratio: AspectRatio) => void;
}

// Icons for aspect ratios
const PortraitIcon = () => (
  <svg className="w-4 h-6" viewBox="0 0 9 16" fill="currentColor">
    <rect x="0.5" y="0.5" width="8" height="15" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const SquareIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
    <rect x="0.5" y="0.5" width="15" height="15" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const LandscapeIcon = () => (
  <svg className="w-6 h-4" viewBox="0 0 16 9" fill="currentColor">
    <rect x="0.5" y="0.5" width="15" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const ratios: { value: AspectRatio; icon: React.ReactNode }[] = [
  { value: '9:16', icon: <PortraitIcon /> },
  { value: '1:1', icon: <SquareIcon /> },
  { value: '16:9', icon: <LandscapeIcon /> },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ selectedRatio, onSelectRatio }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-lg text-gray-300 mb-2">3. Choose the output aspect ratio.</p>
      <div className="flex justify-center bg-gray-700/50 rounded-lg p-1 space-x-1">
        {ratios.map(({ value, icon }) => (
          <button
            key={value}
            onClick={() => onSelectRatio(value)}
            className={`px-4 py-2 flex items-center gap-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500
              ${selectedRatio === value ? 'bg-cyan-500 text-white shadow' : 'bg-gray-600 text-gray-300 hover:bg-cyan-400/50'}`}
            title={value}
          >
            {icon}
            <span>{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
};