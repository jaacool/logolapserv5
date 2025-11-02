import React from 'react';
import { PerspectiveIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type PerspectiveCorrectionToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const PerspectiveCorrectionToggle: React.FC<PerspectiveCorrectionToggleProps> = (props) => {
  return (
    <Toggle
      id="perspective-correction-toggle"
      label="Perspective Correction"
      icon={<PerspectiveIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
