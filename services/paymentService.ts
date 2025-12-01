import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { CREDIT_PACKAGES, CreditPackage } from '../types/credits';

let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('Stripe publishable key not found');
      return null;
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

export interface PaymentResult {
  success: boolean;
  error?: string;
  credits?: number;
}

/**
 * Create a Stripe Checkout session for credit purchase
 */
export const createStripeCheckout = async (
  packageId: string,
  userId: string
): Promise<{ sessionUrl: string } | { error: string }> => {
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    return { error: 'Invalid package selected' };
  }

  if (!isSupabaseConfigured()) {
    return { error: 'Payment system not configured' };
  }

  try {
    // Call Supabase Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        packageId,
        userId,
        priceInCents: Math.round(pkg.priceGross * 100),
        credits: pkg.credits,
        packageName: pkg.name,
      },
    });

    if (error) {
      console.error('Checkout error:', error);
      return { error: error.message || 'Failed to create checkout session' };
    }

    return { sessionUrl: data.url };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return { error: 'Failed to initialize payment' };
  }
};

/**
 * Create a PayPal order for credit purchase
 */
export const createPayPalOrder = async (
  packageId: string,
  userId: string
): Promise<{ orderId: string; approvalUrl: string } | { error: string }> => {
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    return { error: 'Invalid package selected' };
  }

  if (!isSupabaseConfigured()) {
    return { error: 'Payment system not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-paypal-order', {
      body: {
        packageId,
        userId,
        amount: pkg.priceGross.toFixed(2),
        credits: pkg.credits,
        packageName: pkg.name,
      },
    });

    if (error) {
      console.error('PayPal order error:', error);
      return { error: error.message || 'Failed to create PayPal order' };
    }

    return { orderId: data.orderId, approvalUrl: data.approvalUrl };
  } catch (err) {
    console.error('PayPal order error:', err);
    return { error: 'Failed to initialize PayPal payment' };
  }
};

/**
 * Capture a PayPal order after approval
 */
export const capturePayPalOrder = async (
  orderId: string
): Promise<PaymentResult> => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('capture-paypal-order', {
      body: { orderId },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, credits: data.credits };
  } catch (err) {
    console.error('PayPal capture error:', err);
    return { success: false, error: 'Failed to complete PayPal payment' };
  }
};

/**
 * Get user's current credit balance from Supabase
 */
export const getUserCredits = async (userId: string): Promise<number> => {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid 406 when no row exists

    if (error) {
      console.error('Error fetching credits:', error);
      return 0;
    }

    return data?.credits || 0;
  } catch (err) {
    console.error('Error fetching credits:', err);
    return 0;
  }
};

/**
 * Deduct credits for an action
 */
export const deductCredits = async (
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Payment system not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, newBalance: data };
  } catch (err) {
    console.error('Error deducting credits:', err);
    return { success: false, error: 'Failed to deduct credits' };
  }
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (
  userId: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  type: 'purchase' | 'usage';
  amount: number;
  description: string;
  created_at: string;
}>> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching transactions:', err);
    return [];
  }
};
