import React from 'react';
import { BugIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type DebugToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const DebugToggle: React.FC<DebugToggleProps> = (props) => {
  return (
    <Toggle
      id="debug-toggle"
      label="Debug View"
      icon={<BugIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
