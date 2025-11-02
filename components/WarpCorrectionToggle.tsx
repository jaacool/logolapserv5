import React from 'react';
import { ViewfinderCircleIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type WarpCorrectionToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const WarpCorrectionToggle: React.FC<WarpCorrectionToggleProps> = (props) => {
  return (
    <Toggle
      id="warp-correction-toggle"
      label="Pixel-perfektes Warping"
      icon={<ViewfinderCircleIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
