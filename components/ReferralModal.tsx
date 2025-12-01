import React from 'react';
import { XIcon } from './Icons';
import { ReferralSection } from './ReferralSection';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, userId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🎁</span> Referral Program
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Earn credits by inviting friends
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <ReferralSection userId={userId} />
          
          {/* How it works */}
          <div className="mt-6 bg-gray-700/30 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">How it works</h3>
            <ol className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">1.</span>
                <span>Generate your personal referral code above</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">2.</span>
                <span>Share the code or link with friends</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">3.</span>
                <span>When they make their first purchase, you get <span className="text-yellow-400 font-bold">+50 credits</span></span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">4.</span>
                <span>They get <span className="text-pink-400 font-bold">+20% bonus</span> on their purchase</span>
              </li>
            </ol>
          </div>

          {/* Tips */}
          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p>💡 Bigger packages = more bonus credits for your friend</p>
            <p>💡 No limit on how many friends you can refer</p>
            <p>💡 Referral codes can only be used on first purchase</p>
          </div>
        </div>
      </div>
    </div>
  );
};
