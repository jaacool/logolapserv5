import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, ChevronDownIcon } from './Icons';

interface PromptCustomizerProps {
  snippets: string[];
  selectedSnippets: string[];
  onSelectionChange: (selected: string[]) => void;
  onAddSnippet: (newSnippet: string) => void;
}

export const PromptCustomizer: React.FC<PromptCustomizerProps> = ({ snippets, selectedSnippets, onSelectionChange, onAddSnippet }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newSnippet, setNewSnippet] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleToggleSnippet = (snippet: string) => {
    const newSelection = selectedSnippets.includes(snippet)
      ? selectedSnippets.filter(s => s !== snippet)
      : [...selectedSnippets, snippet];
    onSelectionChange(newSelection);
  };

  const handleAddClick = () => {
    if (newSnippet.trim()) {
      onAddSnippet(newSnippet.trim());
      setNewSnippet('');
    }
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddClick();
    }
  };

  return (
    <div className="relative w-full max-w-xs" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
      >
        <span>Custom Content ({selectedSnippets.length} selected)</span>
        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 flex flex-col">
          <div className="p-2 space-y-1 overflow-y-auto">
            {snippets.map(snippet => (
              <label key={snippet} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSnippets.includes(snippet)}
                  onChange={() => handleToggleSnippet(snippet)}
                  className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
                />
                <span className="text-gray-300 text-sm">{snippet}</span>
              </label>
            ))}
          </div>
          <div className="p-2 border-t border-gray-700 mt-auto flex items-center gap-2">
            <input
              type="text"
              value={newSnippet}
              onChange={(e) => setNewSnippet(e.target.value)}
              onKeyPress={handleInputKeyPress}
              placeholder="Add your own..."
              className="flex-grow bg-gray-900 text-gray-300 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
            />
            <button
              onClick={handleAddClick}
              className="p-2 bg-cyan-500 text-white rounded-md hover:bg-cyan-600"
              title="Add Snippet"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};