import React from 'react';
import { SparklesIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type AIVariationsToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const AIVariationsToggle: React.FC<AIVariationsToggleProps> = (props) => {
  return (
    <Toggle
      id="ai-variations-toggle"
      label="AI Variations"
      icon={<SparklesIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
