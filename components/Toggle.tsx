import React from 'react';

export interface ToggleProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isChecked: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ id, label, icon, isChecked, onChange }) => {
  return (
    <label htmlFor={id} className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          className="sr-only"
          checked={isChecked}
          onChange={() => onChange(!isChecked)}
        />
        <div className={`block w-14 h-8 rounded-full transition-colors ${isChecked ? 'bg-cyan-500' : 'bg-gray-600'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isChecked ? 'transform translate-x-6' : ''}`}></div>
      </div>
      <div className="ml-3 text-gray-300 font-medium flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
    </label>
  );
};
