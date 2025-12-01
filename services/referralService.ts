import { getCurrentUser } from './authService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Referral constants
export const REFERRER_BONUS_CREDITS = 50;  // Credits given to referrer
export const REFERRAL_BONUS_PERCENT = 20;  // 20% bonus for new user

export interface ReferralCode {
  code: string;
  totalUses: number;
  totalCreditsEarned: number;
}

export interface ReferralStats {
  hasCode: boolean;
  code: string | null;
  totalReferrals: number;
  totalCreditsEarned: number;
  canUseReferral: boolean;  // false if user already used a referral code
}

export interface ReferralValidation {
  isValid: boolean;
  referralCodeId: string | null;
  referrerUserId: string | null;
  errorMessage: string | null;
}

/**
 * Generate a personal referral code for the current user
 * Each user can only have ONE code
 */
export const generateReferralCode = async (): Promise<string | null> => {
  const user = getCurrentUser();
  if (!user || !user.email) return null;

  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('generate_referral_code', {
      p_user_id: user.uid,
      p_user_email: user.email,
    });

    if (error) {
      console.error('Error generating referral code:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error generating referral code:', err);
    return null;
  }
};

/**
 * Get referral stats for the current user
 */
export const getReferralStats = async (): Promise<ReferralStats | null> => {
  const user = getCurrentUser();
  if (!user) return null;

  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('get_referral_stats', {
      p_user_id: user.uid,
    });

    if (error) {
      console.error('Error getting referral stats:', error);
      return null;
    }

    if (data && data.length > 0) {
      const row = data[0];
      return {
        hasCode: row.has_code,
        code: row.code,
        totalReferrals: row.total_referrals,
        totalCreditsEarned: row.total_credits_earned,
        canUseReferral: row.can_use_referral,
      };
    }

    return {
      hasCode: false,
      code: null,
      totalReferrals: 0,
      totalCreditsEarned: 0,
      canUseReferral: true,
    };
  } catch (err) {
    console.error('Error getting referral stats:', err);
    return null;
  }
};

/**
 * Validate a referral code before checkout
 * Returns validation result with code ID if valid
 */
export const validateReferralCode = async (code: string): Promise<ReferralValidation> => {
  const user = getCurrentUser();
  if (!user) {
    return {
      isValid: false,
      referralCodeId: null,
      referrerUserId: null,
      errorMessage: 'User not logged in',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      isValid: false,
      referralCodeId: null,
      referrerUserId: null,
      errorMessage: 'Service not available',
    };
  }

  try {
    const { data, error } = await supabase.rpc('validate_referral_code', {
      p_code: code.toUpperCase().trim(),
      p_user_id: user.uid,
    });

    if (error) {
      console.error('Error validating referral code:', error);
      return {
        isValid: false,
        referralCodeId: null,
        referrerUserId: null,
        errorMessage: 'Failed to validate code',
      };
    }

    if (data && data.length > 0) {
      const row = data[0];
      return {
        isValid: row.is_valid,
        referralCodeId: row.referral_code_id,
        referrerUserId: row.referrer_user_id,
        errorMessage: row.error_message,
      };
    }

    return {
      isValid: false,
      referralCodeId: null,
      referrerUserId: null,
      errorMessage: 'Invalid code',
    };
  } catch (err) {
    console.error('Error validating referral code:', err);
    return {
      isValid: false,
      referralCodeId: null,
      referrerUserId: null,
      errorMessage: 'Validation failed',
    };
  }
};

/**
 * Check if current user can use a referral code
 * (hasn't used one before)
 */
export const canUseReferralCode = async (): Promise<boolean> => {
  const stats = await getReferralStats();
  return stats?.canUseReferral ?? true;
};

/**
 * Calculate bonus credits for a package
 */
export const calculateReferralBonus = (baseCredits: number): number => {
  return Math.floor(baseCredits * (REFERRAL_BONUS_PERCENT / 100));
};

/**
 * Get referral redemption history for current user's code
 */
export const getReferralHistory = async (): Promise<Array<{
  date: string;
  packageId: string;
  creditsEarned: number;
}>> => {
  const user = getCurrentUser();
  if (!user) return [];

  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // First get user's referral code
    const { data: codeData } = await supabase
      .from('referral_codes')
      .select('id')
      .eq('user_id', user.uid)
      .maybeSingle();

    if (!codeData) return [];

    // Then get redemptions for that code
    const { data, error } = await supabase
      .from('referral_redemptions')
      .select('created_at, package_id, referrer_credits')
      .eq('referral_code_id', codeData.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting referral history:', error);
      return [];
    }

    return (data || []).map(row => ({
      date: row.created_at,
      packageId: row.package_id,
      creditsEarned: row.referrer_credits,
    }));
  } catch (err) {
    console.error('Error getting referral history:', err);
    return [];
  }
};
