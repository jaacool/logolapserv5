// Credit costs per action
export const CREDITS_PER_IMAGE = 2;              // Fast mode (local only, no AI)
export const CREDITS_PER_STANDARD_EDGE_FILL = 6; // Standard Edge Fill (1K) via Gemini
export const CREDITS_PER_PREMIUM_EDGE_FILL = 9;  // Premium Edge Fill (2K) via Gemini
export const CREDITS_PER_ULTRA_EDGE_FILL = 12;   // Ultra Edge Fill (4K) via Gemini - $0.24/image
export const CREDITS_PER_AI_VARIATION = 10;      // AI-generated variations

// Welcome bonus for new users
export const WELCOME_BONUS_CREDITS = 15;

// Credit packages for purchase
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;           // in EUR
  pricePerCredit: number;  // calculated
  savings?: number;        // percentage saved vs starter
  badge?: 'popular' | 'best-value';
  logosIncluded: number;   // based on Fast Mode (2 credits per logo)
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'test',
    name: '🧪 Test',
    credits: 1,
    price: 0.50,
    pricePerCredit: 0.50,
    logosIncluded: 0,
  },
  {
    id: 'starter',
    name: 'Starter',
    credits: 30,
    price: 2.99,
    pricePerCredit: 0.10,
    logosIncluded: 15, // 30 / 2 credits per logo (Fast Mode)
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 100,
    price: 7.99,
    pricePerCredit: 0.08,
    savings: 20,
    badge: 'popular',
    logosIncluded: 50, // 100 / 2
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 300,
    price: 19.99,
    pricePerCredit: 0.067,
    savings: 33,
    logosIncluded: 150, // 300 / 2
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 1000,
    price: 49.99,
    pricePerCredit: 0.05,
    savings: 50,
    badge: 'best-value',
    logosIncluded: 500, // 1000 / 2
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
