import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { getCurrentUser } from './authService';
import { isAdmin, ADMIN_CREDITS } from '../config/admin';
import { WELCOME_BONUS_CREDITS } from '../types/credits';

interface UserCredits {
  credits: number;
  welcomeBonusClaimed: boolean;
  createdAt: string;
  updatedAt: string;
}

const getUserCreditsRef = (userId: string) => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }
  return doc(db, 'users', userId);
};

export const getCredits = async (): Promise<number> => {
  if (!isFirebaseConfigured || !db) {
    return 0;
  }
  
  const user = getCurrentUser();
  if (!user) return 0;

  // Admin check - return unlimited credits
  if (isAdmin(user.email)) {
    return ADMIN_CREDITS;
  }

  try {
    const userDoc = await getDoc(getUserCreditsRef(user.uid));
    
    if (!userDoc.exists()) {
      // New user - create document with welcome bonus
      const newUserData: UserCredits = {
        credits: WELCOME_BONUS_CREDITS,
        welcomeBonusClaimed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(getUserCreditsRef(user.uid), newUserData);
      return WELCOME_BONUS_CREDITS;
    }

    const data = userDoc.data() as UserCredits;
    return data.credits || 0;
  } catch (error) {
    console.error('Error getting credits:', error);
    return 0;
  }
};

export const setCredits = async (credits: number): Promise<void> => {
  if (!isFirebaseConfigured || !db) {
    return;
  }
  
  const user = getCurrentUser();
  if (!user) return;

  try {
    await updateDoc(getUserCreditsRef(user.uid), {
      credits,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error setting credits:', error);
  }
};

export const addCredits = async (amount: number): Promise<number> => {
  if (!isFirebaseConfigured || !db) {
    return 0;
  }
  
  const user = getCurrentUser();
  if (!user) return 0;

  try {
    await updateDoc(getUserCreditsRef(user.uid), {
      credits: increment(amount),
      updatedAt: new Date().toISOString(),
    });
    return await getCredits();
  } catch (error) {
    console.error('Error adding credits:', error);
    return 0;
  }
};

export const deductCredits = async (amount: number): Promise<boolean> => {
  if (!isFirebaseConfigured || !db) {
    return false;
  }
  
  const user = getCurrentUser();
  
  // Admin check - never deduct credits for admins
  if (user && isAdmin(user.email)) {
    return true;
  }
  
  const current = await getCredits();
  if (current >= amount) {
    await setCredits(current - amount);
    return true;
  }
  return false;
};

export const hasEnoughCredits = async (required: number): Promise<boolean> => {
  if (!isFirebaseConfigured || !db) {
    return false;
  }
  
  const user = getCurrentUser();
  
  // Admin check - always has enough credits
  if (user && isAdmin(user.email)) {
    return true;
  }
  
  const credits = await getCredits();
  return credits >= required;
};
