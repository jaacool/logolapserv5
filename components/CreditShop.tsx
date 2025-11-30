import React from 'react';
import { XIcon } from './Icons';
import { CREDIT_PACKAGES, CreditPackage } from '../types/credits';

interface CreditShopProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (packageId: string) => void;
}

export const CreditShop: React.FC<CreditShopProps> = ({ isOpen, onClose, onPurchase }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl relative overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>⚡</span> Get More Credits
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Choose a package that fits your needs
          </p>
        </div>

        {/* Packages Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <PackageCard 
                key={pkg.id} 
                package={pkg} 
                onSelect={() => onPurchase(pkg.id)} 
              />
            ))}
          </div>

          {/* Info */}
          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>Credits never expire • Shared across all JaaCool apps</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PackageCardProps {
  package: CreditPackage;
  onSelect: () => void;
}

const PackageCard: React.FC<PackageCardProps> = ({ package: pkg, onSelect }) => {
  const getBadgeColor = (badge?: string) => {
    if (badge === 'popular') return 'bg-blue-500';
    if (badge === 'best-value') return 'bg-green-500';
    return '';
  };

  return (
    <div 
      className={`relative bg-gray-700/50 border rounded-xl p-4 hover:border-yellow-500 transition-all cursor-pointer
        ${pkg.badge ? 'border-yellow-500/50' : 'border-gray-600'}`}
      onClick={onSelect}
    >
      {/* Badge */}
      {pkg.badge && (
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white ${getBadgeColor(pkg.badge)}`}>
          {pkg.badge === 'popular' ? '⭐ Popular' : '🏆 Best Value'}
        </div>
      )}

      {/* Content */}
      <div className="text-center pt-2">
        <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
        
        <div className="my-4">
          <span className="text-3xl font-bold text-yellow-400">{pkg.credits}</span>
          <span className="text-gray-400 ml-1">credits</span>
        </div>
        
        <div className="text-sm text-cyan-400 mb-2">
          Up to {pkg.logosIncluded} logos
        </div>

        <div className="text-2xl font-bold text-white mb-1">
          €{pkg.price.toFixed(2)}
        </div>

        <div className="text-xs text-gray-400">
          €{pkg.pricePerCredit.toFixed(3)} per credit
        </div>

        {pkg.savings && (
          <div className="mt-2 text-green-400 text-sm font-medium">
            Save {pkg.savings}%
          </div>
        )}

        <button
          className="mt-4 w-full py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
};
