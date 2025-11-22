import React from 'react';

interface VariationSelectorProps {
  selectedValue: number;
  onSelectValue: (value: number) => void;
  max: number;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({ selectedValue, onSelectValue, max }) => {
  return (
    <div className="flex flex-col items-center w-full max-w-xs">
        <div className="flex justify-between w-full mb-2">
            <span className="text-gray-300 font-medium">Number of Variations</span>
            <span className="text-cyan-400 font-bold">{selectedValue}</span>
        </div>
        <input 
            type="range" 
            min="1" 
            max={max} 
            value={selectedValue} 
            onChange={(e) => onSelectValue(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between w-full text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>{max}</span>
        </div>
    </div>
  );
};
