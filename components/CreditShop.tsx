import React, { useState } from 'react';
import { XIcon } from './Icons';
import { CREDIT_PACKAGES, CreditPackage } from '../types/credits';
import { createStripeCheckout, createPayPalOrder, capturePayPalOrder } from '../services/paymentService';

type PaymentMethod = 'stripe' | 'paypal';

interface CreditShopProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (packageId: string) => void;
  userId?: string;
}

export const CreditShop: React.FC<CreditShopProps> = ({ isOpen, onClose, onPurchase, userId }) => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [processingMethod, setProcessingMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async (method: PaymentMethod) => {
    if (!selectedPackage || !userId) {
      setError('Please select a package first');
      return;
    }

    setProcessingMethod(method);
    setError(null);

    try {
      if (method === 'stripe') {
        const result = await createStripeCheckout(selectedPackage, userId);
        if ('error' in result) {
          setError(result.error);
        } else {
          // Redirect to Stripe Checkout
          window.location.href = result.sessionUrl;
        }
      } else if (method === 'paypal') {
        const result = await createPayPalOrder(selectedPackage, userId);
        if ('error' in result) {
          setError(result.error);
        } else if (result.approvalUrl) {
          // Redirect to PayPal for approval
          window.location.href = result.approvalUrl;
        } else {
          setError('Failed to get PayPal approval URL');
        }
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setProcessingMethod(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl relative overflow-hidden">
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch">
            {/* Tester Package */}
            <PackageCard 
              package={CREDIT_PACKAGES[0]} 
              isSelected={selectedPackage === CREDIT_PACKAGES[0].id}
              onSelect={() => setSelectedPackage(CREDIT_PACKAGES[0].id)} 
            />
            
            {/* Divider */}
            <div className="hidden sm:flex items-center justify-center px-2">
              <div className="h-full w-px bg-gradient-to-b from-transparent via-gray-500 to-transparent"></div>
            </div>
            
            {/* Other Packages */}
            {CREDIT_PACKAGES.slice(1).map((pkg) => (
              <PackageCard 
                key={pkg.id}
                package={pkg} 
                isSelected={selectedPackage === pkg.id}
                onSelect={() => setSelectedPackage(pkg.id)} 
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Payment Methods */}
          {selectedPackage && (
            <div className="mt-6 space-y-3">
              <p className="text-gray-400 text-sm text-center mb-4">Choose payment method:</p>
              <div className="flex gap-3 justify-center">
                {/* Stripe (Card) Button */}
                <button
                  onClick={() => handlePayment('stripe')}
                  disabled={processingMethod !== null}
                  className="flex items-center gap-2 px-6 py-3 bg-[#635BFF] hover:bg-[#5851ea] text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 10h18v7a3 3 0 01-3 3H6a3 3 0 01-3-3v-7zm0-3a3 3 0 013-3h12a3 3 0 013 3v1H3V7z"/>
                  </svg>
                  {processingMethod === 'stripe' ? 'Processing...' : 'Pay with Card'}
                </button>

                {/* PayPal Button */}
                <button
                  onClick={() => handlePayment('paypal')}
                  disabled={processingMethod !== null}
                  className="flex items-center gap-2 px-6 py-3 bg-[#0070BA] hover:bg-[#005ea6] text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.72a.77.77 0 01.76-.654h6.39c2.117 0 3.832.476 5.1 1.415 1.267.94 1.9 2.28 1.9 4.02 0 .94-.158 1.79-.474 2.55-.316.76-.77 1.42-1.362 1.98-.592.56-1.3.99-2.124 1.29-.824.3-1.743.45-2.757.45H9.72l-.95 6.567a.77.77 0 01-.76.654H7.076z"/>
                  </svg>
                  {processingMethod === 'paypal' ? 'Processing...' : 'PayPal'}
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>Credits never expire • Shared across all JaaCool apps</p>
            <p className="mt-1 text-xs">🔒 Secure payment via Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PackageCardProps {
  package: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
}

const PackageCard: React.FC<PackageCardProps> = ({ package: pkg, isSelected, onSelect }) => {
  const getBadgeColor = (badge?: string) => {
    if (badge === 'popular') return 'bg-blue-500';
    if (badge === 'best-value') return 'bg-green-500';
    return '';
  };

  return (
    <div 
      className={`relative bg-gray-700/50 border-2 rounded-xl p-4 hover:border-yellow-500 transition-all cursor-pointer w-full sm:w-44 flex-shrink-0
        ${isSelected ? 'border-yellow-500 ring-2 ring-yellow-500/30' : pkg.badge ? 'border-yellow-500/50' : 'border-gray-600'}`}
      onClick={onSelect}
    >
      {/* Selected Checkmark */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Badge */}
      {pkg.badge && !isSelected && (
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
          €{pkg.priceNet.toFixed(2)} <span className="text-sm font-normal text-gray-400">netto</span>
        </div>

        <div className="text-sm text-gray-400 mb-1">
          €{pkg.priceGross.toFixed(2)} <span className="text-xs">inkl. 19% MwSt.</span>
        </div>

        <div className="text-xs text-gray-500">
          €{pkg.pricePerCredit.toFixed(3)} pro Credit
        </div>

        {pkg.savings && (
          <div className="mt-2 text-green-400 text-sm font-medium">
            Save {pkg.savings}%
          </div>
        )}

        <div
          className={`mt-4 w-full py-2 font-medium rounded-lg transition-all text-center
            ${isSelected 
              ? 'bg-yellow-500 text-white' 
              : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400'}`}
        >
          {isSelected ? '✓ Selected' : 'Select'}
        </div>
      </div>
    </div>
  );
};
