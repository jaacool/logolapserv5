// Credit costs per action
export const CREDITS_PER_IMAGE = 2;              // Fast mode (local only, no AI)
export const CREDITS_PER_STANDARD_EDGE_FILL = 6; // Standard Edge Fill (1K) via Gemini
export const CREDITS_PER_PREMIUM_EDGE_FILL = 9;  // Premium Edge Fill (2K) via Gemini
export const CREDITS_PER_ULTRA_EDGE_FILL = 12;   // Ultra Edge Fill (4K) via Gemini - $0.24/image
export const CREDITS_PER_AI_VARIATION = 10;      // AI-generated variations

// Welcome bonus for new users
export const WELCOME_BONUS_CREDITS = 15;

// VAT rate for Germany
export const VAT_RATE = 0.19;

// Credit packages for purchase
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceNet: number;        // Netto price in EUR (without VAT)
  priceGross: number;      // Brutto price in EUR (with 19% VAT)
  pricePerCredit: number;  // calculated from net price
  savings?: number;        // percentage saved vs starter
  badge?: 'popular' | 'best-value';
  logosIncluded: number;   // based on Fast Mode (2 credits per logo)
}

// Helper to calculate gross price from net
const withVAT = (netPrice: number): number => Math.round(netPrice * (1 + VAT_RATE) * 100) / 100;

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Tester',
    credits: 30,
    priceNet: 2.99,
    priceGross: withVAT(2.99),
    pricePerCredit: 0.10,
    logosIncluded: 15,
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 100,
    priceNet: 7.99,
    priceGross: withVAT(7.99),
    pricePerCredit: 0.08,
    savings: 20,
    logosIncluded: 50,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 300,
    priceNet: 19.99,
    priceGross: withVAT(19.99),
    pricePerCredit: 0.067,
    savings: 33,
    badge: 'popular',
    logosIncluded: 150,
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 1000,
    priceNet: 49.99,
    priceGross: withVAT(49.99),
    pricePerCredit: 0.05,
    savings: 50,
    badge: 'best-value',
    logosIncluded: 500,
  },
];

// Helper to calculate total credits needed for a batch
export const calculateCreditsNeeded = (
  imageCount: number,
  edgeFillMode: 'none' | 'standard' | 'premium' | 'ultra',
  aiVariationCount: number
): number => {
  let total = 0;
  
  // Cost per image based on edge fill mode
  if (edgeFillMode === 'none') {
    // Fast mode - local only
    total += imageCount * CREDITS_PER_IMAGE;
  } else if (edgeFillMode === 'standard') {
    // Standard Edge Fill (1K)
    total += imageCount * CREDITS_PER_STANDARD_EDGE_FILL;
  } else if (edgeFillMode === 'premium') {
    // Premium Edge Fill (2K)
    total += imageCount * CREDITS_PER_PREMIUM_EDGE_FILL;
  } else if (edgeFillMode === 'ultra') {
    // Ultra Edge Fill (4K)
    total += imageCount * CREDITS_PER_ULTRA_EDGE_FILL;
  }
  
  // AI variations
  total += aiVariationCount * CREDITS_PER_AI_VARIATION;
  
  return total;
};
