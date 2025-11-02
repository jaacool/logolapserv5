import React from 'react';
import { Toggle, ToggleProps } from './Toggle';
import { SimpleMatchIcon } from './Icons';

type SimpleMatchToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const SimpleMatchToggle: React.FC<SimpleMatchToggleProps> = ({ isChecked, onChange }) => {
  return (
    <Toggle
      id="simple-match-toggle"
      label="Simple Match"
      icon={<SimpleMatchIcon className="w-5 h-5" />}
      isChecked={isChecked}
      onChange={onChange}
    />
  );
};
