import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
  UserCredential
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  if (!auth || !googleProvider || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set up Firebase environment variables.');
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Sign in with Email and Password
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set up Firebase environment variables.');
  }
  
  try {
    console.log('🔐 Attempting email sign-in for:', email);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Email sign-in successful');
    return result.user;
  } catch (error: any) {
    console.error('❌ Error signing in with email:', error.code, error.message);
    throw error;
  }
};

// Sign up with Email and Password
export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set up Firebase environment variables.');
  }
  
  try {
    console.log('📝 Attempting email sign-up for:', email);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ Email sign-up successful');
    return result.user;
  } catch (error: any) {
    console.error('❌ Error signing up with email:', error.code, error.message);
    throw error;
  }
};

// Reset Password
export const resetPassword = async (email: string): Promise<void> => {
  if (!auth || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set up Firebase environment variables.');
  }
  
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  if (!auth || !isFirebaseConfigured) {
    return;
  }
  
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth || !isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  if (!auth || !isFirebaseConfigured) {
    return null;
  }
  return auth.currentUser;
};

// Get friendly error message
export const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Please enable it in Firebase Console under Authentication > Sign-in method.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    default:
      return 'An error occurred. Please try again.';
  }
};
