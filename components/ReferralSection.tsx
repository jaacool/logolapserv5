import React, { useState, useEffect } from 'react';
import { 
  generateReferralCode, 
  getReferralStats, 
  getReferralHistory,
  ReferralStats,
  REFERRER_BONUS_CREDITS,
  REFERRAL_BONUS_PERCENT
} from '../services/referralService';

interface ReferralSectionProps {
  userId: string | undefined;
}

export const ReferralSection: React.FC<ReferralSectionProps> = ({ userId }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ date: string; packageId: string; creditsEarned: number }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId]);

  const loadStats = async () => {
    const data = await getReferralStats();
    setStats(data);
    if (data?.hasCode) {
      const historyData = await getReferralHistory();
      setHistory(historyData);
    }
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    const code = await generateReferralCode();
    if (code) {
      await loadStats();
    }
    setIsGenerating(false);
  };

  const handleCopyCode = () => {
    if (stats?.code) {
      navigator.clipboard.writeText(stats.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (stats?.code) {
      const link = `${window.location.origin}?ref=${stats.code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!userId) return null;

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎁</span>
        <h3 className="text-lg font-bold text-white">Referral Program</h3>
      </div>

      {/* Benefits explanation */}
      <div className="bg-black/20 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-300 mb-3">
          Share your code and earn credits when friends make their first purchase!
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">+{REFERRER_BONUS_CREDITS}</div>
            <div className="text-xs text-gray-400">Credits for you</div>
            <div className="text-xs text-purple-300 mt-1">per referral</div>
          </div>
          <div className="bg-pink-500/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-pink-400">+{REFERRAL_BONUS_PERCENT}%</div>
            <div className="text-xs text-gray-400">Bonus for friend</div>
            <div className="text-xs text-pink-300 mt-1">on first purchase</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 Bigger packages = more bonus credits for your friend!
        </p>
      </div>

      {stats?.hasCode ? (
        <>
          {/* Show existing code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-800 rounded-lg px-4 py-3 font-mono text-lg text-center text-yellow-400 tracking-wider">
                {stats.code}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all text-sm font-medium"
            >
              📤 Copy Referral Link
            </button>

            {/* Stats */}
            <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
              <div className="text-gray-400">
                <span className="text-white font-bold">{stats.totalReferrals}</span> referrals
              </div>
              <div className="text-gray-400">
                <span className="text-yellow-400 font-bold">+{stats.totalCreditsEarned}</span> credits earned
              </div>
            </div>

            {/* History toggle */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showHistory ? '▲ Hide history' : '▼ Show history'}
              </button>
            )}

            {/* History list */}
            {showHistory && history.length > 0 && (
              <div className="bg-black/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                {history.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 border-b border-gray-700 last:border-0">
                    <span className="text-gray-400">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <span className="text-green-400">+{item.creditsEarned} credits</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Generate code button */
        <button
          onClick={handleGenerateCode}
          disabled={isGenerating}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all font-medium disabled:opacity-50"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </span>
          ) : (
            '🎫 Generate My Referral Code'
          )}
        </button>
      )}
    </div>
  );
};
