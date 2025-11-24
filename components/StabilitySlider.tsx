import React from 'react';

interface StabilitySliderProps {
  value: number; // 1, 2, or 3
  onChange: (value: number) => void;
}

const STABILITY_LEVELS = [
  { value: 1, label: 'Rough', description: 'Iterative Refinement (I)' },
  { value: 2, label: 'Medium', description: 'Perspective Correction (P) + I' },
  { value: 3, label: 'Smooth AF!', description: 'P + I + Ensemble Correction (E)' }
];

export const StabilitySlider: React.FC<StabilitySliderProps> = ({ value, onChange }) => {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value));
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="text-gray-300 font-medium text-lg">
          Stability / Smoothness
        </label>
        <span className="text-cyan-400 font-semibold">
          {STABILITY_LEVELS.find(l => l.value === value)?.label}
        </span>
      </div>
      
      {/* Native Range Slider */}
      <div className="relative w-full">
        <input
          type="range"
          min="1"
          max="3"
          step="1"
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #0891b2 0%, #06b6d4 ${((value - 1) / 2) * 100}%, #374151 ${((value - 1) / 2) * 100}%, #374151 100%)`
          }}
        />
        
        {/* Tick marks and labels */}
        <div className="flex justify-between mt-2 px-1">
          {STABILITY_LEVELS.map((level) => (
            <div key={level.value} className="relative group flex flex-col items-center">
              <span className={`text-xs font-medium transition-colors ${
                value === level.value ? 'text-cyan-400' : 'text-gray-500'
              }`}>
                {level.label}
              </span>
              
              {/* Tooltip on Hover */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                <div className="bg-gray-900 text-gray-200 text-xs px-3 py-2 rounded-lg shadow-xl border border-gray-700">
                  <div className="font-semibold text-cyan-400">{level.label}</div>
                  <div className="text-gray-400 mt-1">{level.description}</div>
                </div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
          transition: all 0.2s;
        }
        
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.8);
        }
        
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
          transition: all 0.2s;
        }
        
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.8);
        }
      `}</style>
    </div>
  );
};
