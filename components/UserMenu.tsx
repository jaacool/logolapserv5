import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { signOut } from '../services/authService';
import { isAdmin } from '../config/admin';

interface UserMenuProps {
  user: User;
  credits: number;
  onBuyCredits?: () => void;
  onShowInvoices?: () => void;
  onShowReferrals?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, credits, onBuyCredits, onShowInvoices, onShowReferrals }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const photoURL = user.photoURL;
  const userIsAdmin = isAdmin(user.email);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600 rounded-full pl-3 pr-1 py-1 transition-colors"
      >
        {/* Credits Badge */}
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-sm">⚡</span>
          <span className="text-white font-medium text-sm">
            {userIsAdmin ? '∞' : credits}
          </span>
        </div>
        
        {/* Avatar */}
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName}
            className="w-8 h-8 rounded-full border-2 border-cyan-400"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm border-2 border-cyan-400">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          {/* User Info */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{displayName}</p>
                <p className="text-gray-400 text-sm truncate">{user.email}</p>
              </div>
            </div>
            
            {/* Credits Display */}
            <div className="mt-3 bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Credits</span>
                <span className="text-yellow-400 font-bold">
                  {userIsAdmin ? '∞ (Admin)' : credits}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2 space-y-1">
            {onBuyCredits && !userIsAdmin && (
              <button
                onClick={() => { setIsOpen(false); onBuyCredits(); }}
                className="w-full text-left px-4 py-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>⚡</span> Buy Credits
              </button>
            )}
            {onShowReferrals && (
              <button
                onClick={() => { setIsOpen(false); onShowReferrals(); }}
                className="w-full text-left px-4 py-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🎁</span> Referral Program
              </button>
            )}
            {onShowInvoices && (
              <button
                onClick={() => { setIsOpen(false); onShowInvoices(); }}
                className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Meine Rechnungen
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
