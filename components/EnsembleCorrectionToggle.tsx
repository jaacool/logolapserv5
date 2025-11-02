import React from 'react';
import { LayersIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type EnsembleCorrectionToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const EnsembleCorrectionToggle: React.FC<EnsembleCorrectionToggleProps> = (props) => {
  return (
    <Toggle
      id="ensemble-correction-toggle"
      label="Ensemble Correction"
      icon={<LayersIcon className="w-5 h-5" />}
      {...props}
    />
  );
};