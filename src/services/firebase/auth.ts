import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { FirebaseErrorCodes } from './config';

export interface AuthResult {
  success: boolean;
  user?: FirebaseAuthTypes.User;
  error?: string;
}

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const result = await auth().signInWithEmailAndPassword(email, password);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
};

// Create account with email and password
export const createAccount = async (
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> => {
  try {
    const result = await auth().createUserWithEmailAndPassword(email, password);

    // Update display name
    await result.user.updateProfile({ displayName });

    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
};

// Sign out
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await auth().signOut();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await auth().sendPasswordResetEmail(email);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
};

// Send email verification
export const sendEmailVerification = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const user = auth().currentUser;
    if (user) {
      await user.sendEmailVerification();
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (updates: {
  displayName?: string;
  photoURL?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth().currentUser;
    if (user) {
      await user.updateProfile(updates);
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = (): FirebaseAuthTypes.User | null => {
  return auth().currentUser;
};

// Subscribe to auth state changes
export const onAuthStateChanged = (
  callback: (user: FirebaseAuthTypes.User | null) => void
): (() => void) => {
  return auth().onAuthStateChanged(callback);
};

// Delete account
export const deleteAccount = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const user = auth().currentUser;
    if (user) {
      await user.delete();
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Re-authenticate user (needed for sensitive operations)
export const reauthenticate = async (
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth().currentUser;
    if (user && user.email) {
      const credential = auth.EmailAuthProvider.credential(user.email, password);
      await user.reauthenticateWithCredential(credential);
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  } catch (error: any) {
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
};

// Helper function to get human-readable error messages
const getAuthErrorMessage = (errorCode: string): string => {
  console.log('Firebase Auth Error Code:', errorCode);
  switch (errorCode) {
    case FirebaseErrorCodes.AUTH.USER_NOT_FOUND:
      return 'No account found with this email address.';
    case FirebaseErrorCodes.AUTH.WRONG_PASSWORD:
      return 'Incorrect password. Please try again.';
    case FirebaseErrorCodes.AUTH.EMAIL_ALREADY_IN_USE:
      return 'An account with this email already exists.';
    case FirebaseErrorCodes.AUTH.WEAK_PASSWORD:
      return 'Password must be at least 6 characters.';
    case FirebaseErrorCodes.AUTH.INVALID_EMAIL:
      return 'Please enter a valid email address.';
    case FirebaseErrorCodes.AUTH.USER_DISABLED:
      return 'This account has been disabled.';
    case FirebaseErrorCodes.AUTH.TOO_MANY_REQUESTS:
      return 'Too many attempts. Please try again later.';
    case FirebaseErrorCodes.AUTH.NETWORK_REQUEST_FAILED:
      return 'Network error. Please check your connection.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please check your email and password.';
    default:
      console.warn('Unknown auth error code:', errorCode);
      return `An error occurred (${errorCode}). Please try again.`;
  }
};
