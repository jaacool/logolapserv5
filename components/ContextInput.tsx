import React from 'react';

interface ContextInputProps {
    value: string;
    onChange: (value: string) => void;
    isDisabled?: boolean;
}

export const ContextInput: React.FC<ContextInputProps> = ({ value, onChange, isDisabled = false }) => {
    return (
        <div className="w-full p-4 bg-gray-800/50 rounded-lg border border-gray-700 mt-4">
            <div className="flex flex-col gap-2">
                <label htmlFor="context-input" className="text-sm font-medium text-gray-300">
                    Project Context (Optional)
                </label>
                <textarea
                    id="context-input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isDisabled}
                    placeholder="e.g. A high-energy brand launch event for a sports drink, featuring neon lights and dynamic crowds. Or: A minimalist pop-up store in Tokyo."
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent h-20 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">
                    This context will guide the AI to generate backgrounds that fit your specific use case.
                </p>
            </div>
        </div>
    );
};
