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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden my-auto max-h-[90vh] overflow-y-auto">
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
        <div className="p-4">
          <ReferralSection userId={userId} />
          
          {/* How it works - compact */}
          <div className="mt-4 bg-gray-700/30 rounded-xl p-3">
            <h3 className="text-white font-medium text-sm mb-2">How it works</h3>
            <ol className="space-y-1 text-xs text-gray-300">
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">1.</span>
                <span>Generate & share your code</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">2.</span>
                <span>Friend uses code on first purchase</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">3.</span>
                <span>You get <span className="text-yellow-400 font-bold">+50 credits</span>, they get <span className="text-pink-400 font-bold">+20% bonus</span></span>
              </li>
            </ol>
          </div>

          {/* Tips - compact */}
          <div className="mt-3 text-xs text-gray-500">
            <p>💡 No limit on referrals • Codes work on first purchase only</p>
          </div>
        </div>
      </div>
    </div>
  );
};
