import React from 'react';
import type { AspectRatio } from '../types';

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onSelectRatio: (ratio: AspectRatio) => void;
}

const ratios: { value: AspectRatio; label: string }[] = [
  { value: '9:16', label: 'Portrait' },
  { value: '1:1', label: 'Square' },
  { value: '16:9', label: 'Landscape' },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ selectedRatio, onSelectRatio }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-lg text-gray-300 mb-2">3. Choose the output aspect ratio.</p>
      <div className="flex justify-center bg-gray-700/50 rounded-lg p-1 space-x-1">
        {ratios.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onSelectRatio(value)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500
              ${selectedRatio === value ? 'bg-cyan-500 text-white shadow' : 'bg-gray-600 text-gray-300 hover:bg-cyan-400/50'}`}
          >
            {value} <span className="hidden sm:inline">({label})</span>
          </button>
        ))}
      </div>
    </div>
  );
};