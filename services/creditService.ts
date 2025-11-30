import { getCurrentUser } from './authService';
import { isAdmin, ADMIN_CREDITS } from '../config/admin';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const WELCOME_BONUS_CREDITS = 20;

/**
 * Get user's total credits from Supabase
 * Includes welcome bonus for new users
 */
export const getCredits = async (): Promise<number> => {
  const user = getCurrentUser();
  if (!user) return 0;

  // Admin check - return unlimited credits
  if (isAdmin(user.email)) {
    return ADMIN_CREDITS;
  }

  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    // Check if user has credits record
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching credits:', error);
      return 0;
    }

    // If no record exists, create one with welcome bonus
    if (!data) {
      const { data: newData, error: insertError } = await supabase.rpc('add_credits', {
        p_user_id: user.uid,
        p_amount: WELCOME_BONUS_CREDITS,
        p_type: 'bonus',
        p_description: 'Welcome bonus',
      });

      if (insertError) {
        console.error('Error adding welcome bonus:', insertError);
        return 0;
      }

      console.log(`Welcome bonus of ${WELCOME_BONUS_CREDITS} credits added for user ${user.uid}`);
      return newData || WELCOME_BONUS_CREDITS;
    }

    return data.credits || 0;
  } catch (err) {
    console.error('Error getting credits:', err);
    return 0;
  }
};

/**
 * Deduct credits for an action (e.g., image processing)
 */
export const deductCredits = async (amount: number): Promise<boolean> => {
  const user = getCurrentUser();
  if (!user) return false;

  // Admin check - never deduct credits for admins
  if (isAdmin(user.email)) {
    return true;
  }

  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase.rpc('deduct_credits', {
      p_user_id: user.uid,
      p_amount: amount,
      p_reason: 'Image processing',
    });

    if (error) {
      console.error('Error deducting credits:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deducting credits:', err);
    return false;
  }
};

/**
 * Check if user has enough credits
 */
export const hasEnoughCredits = async (required: number): Promise<boolean> => {
  const user = getCurrentUser();
  if (!user) return false;

  // Admin check - always has enough credits
  if (isAdmin(user.email)) {
    return true;
  }

  const credits = await getCredits();
  return credits >= required;
};

/**
 * Add credits to user account (for purchases, bonuses, etc.)
 */
export const addCredits = async (amount: number): Promise<number> => {
  const user = getCurrentUser();
  if (!user) return 0;

  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('add_credits', {
      p_user_id: user.uid,
      p_amount: amount,
      p_type: 'bonus',
      p_description: `Added ${amount} credits`,
    });

    if (error) {
      console.error('Error adding credits:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Error adding credits:', err);
    return 0;
  }
};
