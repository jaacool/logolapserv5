import React from 'react';

interface VariationSelectorProps {
  selectedValue: number;
  onSelectValue: (value: number) => void;
  max: number;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({ selectedValue, onSelectValue, max }) => {
  const values = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center w-full">
        <p className="text-gray-300 font-medium mb-2">Number of Variations</p>
        <div className="flex justify-center bg-gray-700/50 rounded-lg p-1 space-x-1">
            {values.map(value => (
            <button
                key={value}
                onClick={() => onSelectValue(value)}
                className={`w-10 h-10 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500
                ${selectedValue === value ? 'bg-cyan-500 text-white shadow' : 'bg-gray-600 text-gray-300 hover:bg-cyan-400/50'}`}
            >
                {value}
            </button>
            ))}
        </div>
    </div>
  );
};
