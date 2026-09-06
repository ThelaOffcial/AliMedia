import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser as firebaseDeleteUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { auth } from './config';
import { UserProfile } from '../types/user';
import { syncUserProfile, toggleFollowElephantInDb, updateUserProfile, deleteUserAccount } from './userService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Sign in with email + password */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Create a new account with email + password (optional display name) */
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  /** Send password-reset email */
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently delete the signed-in user's Auth account and all RTDB data. */
  deleteMyAccount: () => Promise<void>;
  toggleFollowElephant: (elephantId: string) => Promise<boolean>;
  isFollowing: (elephantId: string) => boolean;
  followedElephantIds: string[];
  updateBio: (newBio: string, newUsername?: string) => Promise<void>;
  updateProfileFields: (fields: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'bio' | 'username'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('profile');
googleProvider.addScope('email');

function mapGoogleAuthError(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Google Sign-In. In Firebase Console → Authentication → Settings → Authorized domains, add this site’s domain.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in popup. Allow popups for this site, or try again (we will use redirect if needed).';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled. In Firebase Console → Authentication → Sign-in method, enable the Google provider.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  if (code === 'auth/internal-error') {
    return 'Google Sign-In failed (internal error). Confirm Google provider is enabled and OAuth consent screen is published in Google Cloud Console.';
  }
  if (code === 'auth/argument-error') {
    return 'Google Sign-In is misconfigured. Check Firebase Authentication → Google and your OAuth client.';
  }
  return err?.message || 'Google Sign-In failed. Please try again.';
}

function mapEmailAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Sign in instead, or use a different email.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. In Firebase Console → Authentication → Sign-in method, enable Email/Password.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const googleSignInInProgress = useRef(false);
  const [localFollows, setLocalFollows] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_followed_elephants');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const applyUserProfile = async (currentUser: User) => {
    // Ignore pure anonymous sessions for the public profile UI
    if (currentUser.isAnonymous) {
      setProfile(null);
      return;
    }
    try {
      const userProf = await syncUserProfile({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      });
      setProfile(userProf);
      setLocalFollows(userProf.followedElephants || []);
      localStorage.setItem(
        'alimedia_followed_elephants',
        JSON.stringify(userProf.followedElephants || [])
      );
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
  };

  // Complete redirect-based Google sign-in (mobile / popup-blocked browsers)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (cancelled) return;
        if (result?.user && !result.user.isAnonymous) {
          await applyUserProfile(result.user);
        }
      } catch (err: any) {
        console.warn('Google redirect result error:', err);
        const msg = mapGoogleAuthError(err);
        if (msg) alert(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        await applyUserProfile(currentUser);
      } else if (!currentUser || currentUser.isAnonymous) {
        // Anonymous is only for DB writes; do not treat as a logged-in member
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    googleSignInInProgress.current = true;
    try {
      // Prefer popup on desktop; fall back to redirect if popup is blocked or unsupported
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          await applyUserProfile(result.user);
        }
        return;
      } catch (popupErr: any) {
        const code = popupErr?.code || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          return;
        }
        // Popup blocked / COOP / environment issues → redirect flow
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          /cross-origin|COOP|blocked/i.test(popupErr?.message || '')
        ) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        const msg = mapGoogleAuthError(popupErr);
        if (msg) {
          alert(msg);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      const msg = mapGoogleAuthError(err);
      if (msg) {
        alert(msg);
        return;
      }
      throw err;
    } finally {
      googleSignInInProgress.current = false;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const trimmed = (email || '').trim();
    if (!trimmed || !password) {
      throw new Error('Please enter both email and password.');
    }
    try {
      const result = await signInWithEmailAndPassword(auth, trimmed, password);
      if (result.user) {
        await applyUserProfile(result.user);
      }
    } catch (err: any) {
      console.warn('Email sign-in error:', err);
      throw new Error(mapEmailAuthError(err));
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const trimmed = (email || '').trim();
    if (!trimmed || !password) {
      throw new Error('Please enter both email and password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, trimmed, password);
      if (result.user) {
        const name = (displayName || '').trim() || trimmed.split('@')[0] || 'User';
        try {
          await firebaseUpdateProfile(result.user, { displayName: name });
        } catch (e) {
          console.warn('Could not set display name:', e);
        }
        await applyUserProfile({
          ...result.user,
          displayName: name,
        } as User);
      }
    } catch (err: any) {
      console.warn('Email sign-up error:', err);
      throw new Error(mapEmailAuthError(err));
    }
  };

  const resetPassword = async (email: string) => {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      throw new Error('Please enter your email address.');
    }
    try {
      // Routed through our own Vercel serverless function
      // (api/send-password-reset.js) instead of Firebase's built-in
      // sendPasswordResetEmail, so the email uses our custom branded HTML
      // template via Resend rather than Firebase's fixed plain-text template.
      const res = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        throw new Error('Failed to send reset email.');
      }
    } catch (err: any) {
      console.warn('Password reset error:', err);
      throw new Error(mapEmailAuthError(err));
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem('alimedia_user_mock');
    localStorage.removeItem('alimedia_followed_elephants');
    setLocalFollows([]);
  };

  /**
   * Self-serve account deletion: wipe RTDB profile/posts/bookmarks/notifs,
   * then delete the Firebase Auth user. Requires a recent sign-in; if Auth
   * rejects with requires-recent-login, the caller should ask the user to
   * sign in again and retry.
   */
  const deleteMyAccount = async () => {
    const current = auth.currentUser;
    if (!current || current.isAnonymous) {
      throw new Error('Not signed in');
    }
    const uid = current.uid;
    await deleteUserAccount(uid);
    try {
      await firebaseDeleteUser(current);
    } catch (err: any) {
      // Profile data is already gone; still clear local session.
      console.warn('Auth user delete failed (may need recent login):', err);
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ignore */
      }
      if (err?.code === 'auth/requires-recent-login') {
        throw new Error(
          'Please sign out, sign in again, then delete your account to confirm it is you.'
        );
      }
      throw err;
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem('alimedia_user_mock');
    localStorage.removeItem('alimedia_followed_elephants');
    setLocalFollows([]);
  };

  const isFollowing = (elephantId: string): boolean => {
    if (!elephantId) return false;
    const currentList = profile?.followedElephants || localFollows;
    return currentList.includes(elephantId);
  };

  const toggleFollowElephant = async (elephantId: string): Promise<boolean> => {
    if (!elephantId) return false;
    if (!profile || profile.suspended) {
      alert(
        localStorage.getItem('alimedia_lang') === 'si'
          ? profile?.suspended
            ? 'ඔබගේ ගිණුම අත්හිටුවා ඇත. Follow කළ නොහැක.'
            : 'ඇත්තු/අලි Follow කිරීමට කරුණාකර පළමුව පිවිසෙන්න (Email හෝ Google)!'
          : profile?.suspended
            ? 'Your account is suspended. You cannot follow elephants.'
            : 'Please sign in first (email or Google) to follow tuskers and elephants!'
      );
      return false;
    }
    const currently = isFollowing(elephantId);
    const newStatus = !currently;

    let updatedList: string[];
    if (currently) {
      updatedList = profile.followedElephants.filter((id) => id !== elephantId);
    } else {
      updatedList = [...profile.followedElephants, elephantId];
    }

    setLocalFollows(updatedList);
    localStorage.setItem('alimedia_followed_elephants', JSON.stringify(updatedList));

    setProfile({
      ...profile,
      followedElephants: updatedList,
    });

    const activeUid = user?.uid || profile?.uid;
    if (activeUid) {
      await toggleFollowElephantInDb(activeUid, elephantId, currently);
    }

    return newStatus;
  };

  const updateBio = async (newBio: string, newUsername?: string) => {
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      bio: newBio,
      ...(newUsername ? { username: newUsername } : {}),
    };
    setProfile(updated);
    if (user?.uid && !user.isAnonymous) {
      await updateUserProfile(user.uid, {
        bio: newBio,
        ...(newUsername ? { username: newUsername } : {}),
      });
    }
  };

  const updateProfileFields = async (
    fields: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'bio' | 'username'>>
  ) => {
    if (!profile) return;
    const updated: UserProfile = { ...profile, ...fields };
    setProfile(updated);
    if (user?.uid && !user.isAnonymous) {
      await updateUserProfile(user.uid, fields);
    }
  };

  // Treat only non-anonymous users as "signed in" for the UI
  const publicUser = user && !user.isAnonymous ? user : null;

  return (
    <AuthContext.Provider
      value={{
        user: publicUser,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        deleteMyAccount,
        toggleFollowElephant,
        isFollowing,
        followedElephantIds: profile?.followedElephants || localFollows,
        updateBio,
        updateProfileFields,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
