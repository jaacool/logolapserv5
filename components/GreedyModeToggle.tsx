import React from 'react';
import { LightningBoltIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type GreedyModeToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const GreedyModeToggle: React.FC<GreedyModeToggleProps> = (props) => {
  return (
    <Toggle
      id="greedy-mode-toggle"
      label="Greedy Mode"
      icon={<LightningBoltIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
