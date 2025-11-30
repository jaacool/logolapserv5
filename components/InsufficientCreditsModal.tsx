import React from 'react';
import { XIcon } from './Icons';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyCredits: () => void;
  creditsNeeded: number;
  creditsAvailable: number;
}

export const InsufficientCreditsModal: React.FC<InsufficientCreditsModalProps> = ({
  isOpen,
  onClose,
  onBuyCredits,
  creditsNeeded,
  creditsAvailable,
}) => {
  if (!isOpen) return null;

  const creditShortfall = creditsNeeded - creditsAvailable;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white">
            ⚠️ Not Enough Credits
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Credits needed:</span>
              <span className="font-bold text-white">{creditsNeeded}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Your credits:</span>
              <span className="font-bold text-yellow-400">{creditsAvailable}</span>
            </div>
            <div className="border-t border-gray-600 pt-2 flex justify-between text-gray-300">
              <span>Shortfall:</span>
              <span className="font-bold text-red-400">-{creditShortfall}</span>
            </div>
          </div>

          <p className="text-gray-400 text-sm text-center">
            You need {creditShortfall} more credits to process these images.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onBuyCredits}
              className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all"
            >
              ⚡ Buy Credits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
