import React from 'react';
import { XIcon } from './Icons';
import { InvoiceList } from './InvoiceList';
import { isAdmin } from '../config/admin';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ 
  isOpen, 
  onClose, 
  userId,
  userEmail 
}) => {
  if (!isOpen) return null;

  const userIsAdmin = isAdmin(userEmail);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Meine Rechnungen
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Alle deine Rechnungen zum Herunterladen
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <InvoiceList userId={userId} isAdmin={userIsAdmin} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Rechnungen werden automatisch bei jedem Kauf erstellt und hier gespeichert.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
