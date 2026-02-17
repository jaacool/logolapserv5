import React from 'react';
import { SparklesIcon, LightningBoltIcon } from './Icons';

interface EdgeFillSelectorProps {
  value: 'draft' | 'fast' | 'pro';
  onChange: (value: 'draft' | 'fast' | 'pro') => void;
  resolution: number;
  onResolutionChange: (res: number) => void;
  imageCount: number;
}

export const EdgeFillSelector: React.FC<EdgeFillSelectorProps> = ({ value, onChange, resolution, onResolutionChange, imageCount }) => {
  const estimatedTimeSec = imageCount * 17;
  
  // Format time as "Xm Ys" or just "Xs" if under 60s
  const formatTime = (totalSeconds: number) => {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };
  
  const estimatedTimeFormatted = formatTime(estimatedTimeSec);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-gray-300 font-medium text-lg">
        Processing Mode
      </label>
      
      <div className="grid grid-cols-3 gap-3">
        {/* Draft Option */}
        <button
          onClick={() => onChange('draft')}
          className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
            value === 'draft'
              ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
          }`}
        >
          <svg className="w-6 h-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="font-bold">Draft</span>
          <span className="text-xs opacity-70 mt-1">Test Settings</span>
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
            FREE
          </div>
        </button>

        {/* Fast Option */}
        <button
          onClick={() => onChange('fast')}
          className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
            value === 'fast'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
          }`}
        >
          <LightningBoltIcon className="w-6 h-6 mb-2" />
          <span className="font-bold">Fast</span>
          <span className="text-xs opacity-70 mt-1">Crop & Pad</span>
        </button>

        {/* Pro Option */}
        <button
          onClick={() => onChange('pro')}
          title="May output unexpected results"
          className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${
            value === 'pro'
              ? 'border-purple-500 bg-purple-500/10 text-purple-400'
              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
          }`}
        >
          <SparklesIcon className="w-6 h-6 mb-2" />
          <span className="font-bold">Pro</span>
          <span className="text-xs opacity-70 mt-1">AI Edge Fill</span>
          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            EXPERIMENTAL
          </div>
          {value === 'pro' && (
            <div className="absolute -top-2 -left-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              +{estimatedTimeFormatted}
            </div>
          )}
        </button>
      </div>

      {value === 'pro' && (
        <div className="space-y-3 p-3 rounded-lg border border-purple-500/20 bg-purple-900/10 animate-fade-in">
          {/* Resolution Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-purple-300">Resolution:</span>
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              {[1024, 2048, 4096].map((res) => (
                <button
                  key={res}
                  onClick={() => onResolutionChange(res)}
                  className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                    resolution === res
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {res === 1024 ? '1K' : res === 2048 ? '2K' : '4K'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-purple-300/70 border-t border-purple-500/10 pt-2">
            <p><strong>Pro Mode:</strong> Uses Nanobanana AI to realistically fill edges. Adds ~{estimatedTimeFormatted} processing time.</p>
          </div>
        </div>
      )}
    </div>
  );
};
