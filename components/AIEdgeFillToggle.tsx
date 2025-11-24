import React from 'react';
import { SparklesIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type AIEdgeFillToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const AIEdgeFillToggle: React.FC<AIEdgeFillToggleProps> = (props) => {
  return (
    <Toggle
      id="ai-edge-fill-toggle"
      label="AI Edge Fill (Nanomanana)"
      icon={<SparklesIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
