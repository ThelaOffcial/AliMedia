import React, { useState, useEffect } from 'react';
import { useAuth } from '../firebase/authContext';
import { Elephant, ElephantPost } from '../types/elephant';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import {
  LogOut,
  ShieldCheck,
  Mail,
  Crown,
  Edit3,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Settings,
  Camera,
  Loader2,
  Ban,
  Bookmark,
  Share2,
  Trash2,
  Image as ImageIcon,
  BellOff,
  BellRing,
  MessageCircle,
  X,
  ChevronRight,
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { isAliMediaTeamEmail, ALI_MEDIA_LOGO_URL, ALI_MEDIA_DISPLAY_NAME } from '../utils/aliMediaTeam';
import { ElephantIcon } from './ElephantIcon';
import { LOGO_URL } from './Navbar';
import { compressImageFile } from '../utils/imageCompressor';
import { uploadPhotoToCloudinary } from '../firebase/cloudinaryService';
import {
  subscribeToUserBookmarks,
  toggleBookmarkPost,
  resharePostToAccount,
  type BookmarkEntry,
} from '../firebase/bookmarkService';
import {
  enablePushNotifications,
  disablePushNotifications,
  hasPushTokenSaved,
  getPushPermissionState,
  type PushPermissionState,
} from '../firebase/messaging';

interface UserProfileScreenProps {
  elephants: Elephant[];
  posts?: ElephantPost[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenDirectory: () => void;
  onShowNotification?: (msg: string) => void;
  /** Open the Messages / activity notifications page (replies & mentions). */
  onOpenMessages?: () => void;
  hasUnreadMessages?: boolean;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  elephants,
  posts = [],
  language,
  onSelectElephant,
  onOpenDirectory,
  onShowNotification,
  onOpenMessages,
  hasUnreadMessages = false,
}) => {
  const {
    user,
    profile,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    deleteMyAccount,
    toggleFollowElephant,
    isFollowing,
    followedElephantIds,
    updateBio,
    updateProfileFields,
  } = useAuth();
  const t = translations[language];

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(profile?.bio || (language === 'si' ? 'ශ්‍රී ලාංකීය හීලෑ අලි ඇතුන්ට ආදරය කරන කෙනෙක් 🐘✨' : 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨'));
  const [activeTab, setActiveTab] = useState<'posts' | 'following' | 'saved' | 'bookmarks'>('posts');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.displayName || user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [bookmarks, setBookmarks] = useState<Record<string, BookmarkEntry>>({});
  const [resharingId, setResharingId] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>('unsupported');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setPushPermission(getPushPermissionState());
    const uid = profile?.uid || user?.uid;
    if (!uid || user?.isAnonymous) {
      setPushEnabled(false);
      return;
    }
    let cancelled = false;
    hasPushTokenSaved(uid).then((saved) => {
      if (!cancelled) setPushEnabled(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, user?.uid, user?.isAnonymous]);

  const handleTogglePush = async () => {
    const uid = profile?.uid || user?.uid;
    if (!uid || user?.isAnonymous) {
      notify(language === 'si' ? 'දැනුම්දීම් සක්‍රීය කිරීමට පිවිසෙන්න' : 'Sign in to enable notifications');
      return;
    }
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications(uid);
        setPushEnabled(false);
        notify(language === 'si' ? 'තල්ලු දැනුම්දීම් අක්‍රීය කරන ලදී' : 'Push notifications turned off');
      } else {
        const result = await enablePushNotifications(uid);
        setPushPermission(getPushPermissionState());
        if (result.ok) {
          setPushEnabled(true);
          notify(language === 'si' ? 'තල්ලු දැනුම්දීම් සක්‍රීයයි' : 'Push notifications enabled');
        } else if (result.error === 'denied') {
          notify(
            language === 'si'
              ? 'දැනුම්දීම් අවසර ප්‍රතික්ෂේප විය. Browser සැකසුම් වලින් සක්‍රීය කරන්න.'
              : 'Notification permission was blocked. Enable it in your browser settings.'
          );
        } else if (result.error === 'no-vapid-key') {
          notify(language === 'si' ? 'තල්ලු දැනුම්දීම් තවම සකසා නැත' : 'Push notifications aren\u2019t configured yet');
        } else {
          notify(language === 'si' ? 'තල්ලු දැනුම්දීම් සක්‍රීය කිරීමට නොහැකි විය' : 'Couldn\u2019t enable push notifications');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    const uid = profile?.uid || user?.uid;
    if (!uid || user?.isAnonymous) {
      setBookmarks({});
      return;
    }
    return subscribeToUserBookmarks(uid, setBookmarks);
  }, [profile?.uid, user?.uid, user?.isAnonymous]);

  const notify = (msg: string) => onShowNotification?.(msg);

  const handleReshare = async (entry: BookmarkEntry, postId: string) => {
    if (!user || !profile || user.isAnonymous) {
      notify(language === 'si' ? 'Reshare සඳහා පිවිසෙන්න' : 'Sign in to reshare');
      return;
    }
    setResharingId(postId);
    try {
      const live = posts.find((p) => p.id === postId);
      await resharePostToAccount(live || { ...entry, id: postId }, {
        uid: user.uid,
        displayName: profile.displayName || user.displayName || 'User',
        username: profile.username,
        photoURL: profile.photoURL || user.photoURL || undefined,
      });
      notify(
        language === 'si'
          ? 'ඔබේ account එකට reshare විය! Feed එකේ පෙනෙනු ඇත.'
          : 'Reshared to your account — it will appear in the feed.'
      );
    } catch (err: any) {
      notify(err?.message || (language === 'si' ? 'Reshare අසාර්ථකයි' : 'Reshare failed'));
    } finally {
      setResharingId(null);
    }
  };

  const handleRemoveBookmark = async (postId: string) => {
    const uid = profile?.uid || user?.uid;
    if (!uid) return;
    const live = posts.find((p) => p.id === postId);
    const entry = bookmarks[postId];
    try {
      await toggleBookmarkPost(
        uid,
        live || {
          id: postId,
          elephantId: entry?.elephantId || '',
          elephantName: entry?.elephantName || '',
          photoUrl: entry?.photoUrl || 'https://placeholder.local',
          caption: entry?.caption || '',
          authorName: entry?.originalAuthorName || '',
          authorUsername: entry?.originalAuthorUsername || '',
        },
        true
      );
      notify(language === 'si' ? 'Bookmark ඉවත් කළා' : 'Bookmark removed');
    } catch {
      notify(language === 'si' ? 'ඉවත් කිරීම අසාර්ථකයි' : 'Could not remove');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          language === 'si'
            ? 'Google Sign-In සක්‍රිය කර නැත. Firebase Console → Authentication → Google සක්‍රිය කරන්න.'
            : 'Google Sign-In is not enabled in Firebase. Enable Google under Authentication → Sign-in method.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          language === 'si'
            ? 'මෙම domain එක authorize කර නැත. Firebase → Authentication → Authorized domains වෙත එකතු කරන්න.'
            : 'This domain is not authorized. Add it under Firebase → Authentication → Authorized domains.'
        );
      } else {
        setAuthError(err?.message || (language === 'si' ? 'පිවිසීම අසාර්ථක විය. නැවත උත්සාහ කරන්න.' : 'Sign in failed. Please try again.'));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAuthError(null);
    setResetSent(false);
    const email = emailInput.trim();
    const password = passwordInput;
    if (!email || !password) {
      setAuthError(language === 'si' ? 'Email සහ password ඇතුළත් කරන්න.' : 'Please enter email and password.');
      return;
    }
    if (authMode === 'signup') {
      if (password.length < 6) {
        setAuthError(language === 'si' ? 'Password අවම වශයෙන් අක්ෂර 6ක් විය යුතුය.' : 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPasswordInput) {
        setAuthError(language === 'si' ? 'Passwords ගැලපෙන්නේ නැත.' : 'Passwords do not match.');
        return;
      }
    }
    try {
      setIsSigningIn(true);
      if (authMode === 'signup') {
        await signUpWithEmail(email, password, displayNameInput.trim() || undefined);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setAuthError(err?.message || (language === 'si' ? 'පිවිසීම අසාර්ථක විය.' : 'Authentication failed.'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError(null);
    setResetSent(false);
    const email = emailInput.trim();
    if (!email) {
      setAuthError(language === 'si' ? 'Password reset සඳහා email ඇතුළත් කරන්න.' : 'Enter your email to reset password.');
      return;
    }
    try {
      setIsSigningIn(true);
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setAuthError(err?.message || (language === 'si' ? 'Reset email යැවීම අසාර්ථකයි.' : 'Could not send reset email.'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveBio = async () => {
    await updateBio(bioInput);
    setIsEditingBio(false);
  };

  const handleSaveName = async () => {
    const next = nameInput.trim();
    if (!next) return;
    setSavingName(true);
    try {
      await updateProfileFields({ displayName: next });
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      alert(language === 'si' ? 'නම සුරැකීම අසාර්ථක විය' : 'Failed to save name');
    } finally {
      setSavingName(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      const result = await uploadPhotoToCloudinary(compressed);
      await updateProfileFields({ photoURL: result.url });
    } catch (err) {
      console.error(err);
      alert(language === 'si' ? 'ඡායාරූපය උඩුගත කිරීම අසාර්ථක විය' : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || user.isAnonymous) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      setShowDeleteConfirm(false);
      setShowSettings(false);
      notify(
        language === 'si'
          ? 'ඔබගේ ගිණුම සහ දත්ත මකා දමන ලදී.'
          : 'Your account and data have been permanently deleted.'
      );
    } catch (err: any) {
      console.error(err);
      setDeleteError(
        err?.message ||
          (language === 'si'
            ? 'ගිණුම මකා දැමීම අසාර්ථක විය. නැවත පිවිස උත්සාහ කරන්න.'
            : 'Could not delete account. Sign in again and retry.')
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  // Elephants the user is currently following
  const followedElephantsList = elephants.filter((e) => e.id && followedElephantIds.includes(e.id));
  const followedTuskersCount = followedElephantsList.filter((e) => e.type === 'tusker').length;

  // Elephants suggested to follow if following is low
  const suggestedElephants = elephants.filter((e) => e.id && !followedElephantIds.includes(e.id)).slice(0, 6);

  // -------------------------------------------------------------
  // NOT SIGNED IN VIEW
  // -------------------------------------------------------------
  if (!user && !profile) {
    return (
      <div className="max-w-lg mx-auto w-full pb-24 animate-fadeIn space-y-5 pt-2">
        {/* Welcome + Auth Card */}
        <div className="bg-[#062E22] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden text-center space-y-4">
          <div className="relative mx-auto w-20 h-20 rounded-full p-1 bg-white/20 shadow-2xl flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center p-2">
              <img src={LOGO_URL} alt="Aliya Media" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="space-y-1.5 relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {language === 'si' ? 'අලිMedia වෙත සාදරයෙන් පිළිගනිමු' : 'Welcome to Aliya Media'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed">
              {language === 'si'
                ? 'Email හෝ Google ගිණුමෙන් පිවිස / ලියාපදිංචි වී ඔබ ප්‍රියකරන අලි සහ ඇතුන් Follow කර Profile එකක් සාදාගන්න.'
                : 'Sign in or create an account with email or Google to follow elephants and build your profile.'}
            </p>
          </div>

          {/* Sign in / Sign up tabs */}
          <div className="relative z-10 flex max-w-xs mx-auto rounded-full bg-black/30 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(null); setResetSent(false); }}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                authMode === 'signin' ? 'bg-white text-[#062E22]' : 'text-white/80 hover:text-white'
              }`}
            >
              {language === 'si' ? 'පිවිසෙන්න' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(null); setResetSent(false); }}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                authMode === 'signup' ? 'bg-white text-[#062E22]' : 'text-white/80 hover:text-white'
              }`}
            >
              {language === 'si' ? 'ලියාපදිංචි වන්න' : 'Sign up'}
            </button>
          </div>

          {/* Email / password form */}
          <form onSubmit={handleEmailAuth} className="relative z-10 max-w-xs mx-auto w-full space-y-2.5 text-left">
            {authMode === 'signup' && (
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder={language === 'si' ? 'නම (Display name)' : 'Display name'}
                autoComplete="name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            )}
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white/70 hover:text-white px-2 py-1 cursor-pointer"
              >
                {showPassword ? (language === 'si' ? 'සඟවන්න' : 'Hide') : (language === 'si' ? 'පෙන්වන්න' : 'Show')}
              </button>
            </div>
            {authMode === 'signup' && (
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                placeholder={language === 'si' ? 'Password නැවත ඇතුළත් කරන්න' : 'Confirm password'}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            )}

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#062E22] font-bold text-sm shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-[#062E22] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>
                  {authMode === 'signup'
                    ? (language === 'si' ? 'ගිණුම සාදන්න' : 'Create account')
                    : (language === 'si' ? 'Email වලින් පිවිසෙන්න' : 'Sign in with email')}
                </span>
              )}
            </button>

            {authMode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSigningIn}
                className="w-full text-center text-[11px] text-white/70 hover:text-white underline cursor-pointer"
              >
                {language === 'si' ? 'Password අමතකද?' : 'Forgot password?'}
              </button>
            )}
          </form>

          {resetSent && (
            <p className="relative z-10 text-[11px] text-emerald-200 max-w-xs mx-auto">
              {language === 'si'
                ? 'Password reset link එක ඔබේ email වෙත යවා ඇත.'
                : 'Password reset link sent to your email.'}
            </p>
          )}

          {/* Divider */}
          <div className="relative z-10 flex items-center gap-3 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
              {language === 'si' ? 'හෝ' : 'or'}
            </span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Google Sign-in Button */}
          <div className="relative z-10">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-white text-black font-bold text-sm shadow-xl hover:bg-zinc-100 active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer border border-zinc-200 disabled:opacity-60"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                  <span>{language === 'si' ? 'Google (Gmail) හරහා' : 'Continue with Google'}</span>
                </>
              )}
            </button>
          </div>

          {authError && (
            <div className="relative z-10 bg-red-500/20 text-red-200 text-xs p-2.5 rounded-xl flex items-center justify-center gap-1.5 border border-red-500/30 max-w-xs mx-auto">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center">
              <ElephantIcon className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22] dark:text-white">
              {language === 'si' ? 'ඇතුන් Follow කරන්න' : 'Follow Elephants'}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              {language === 'si' ? 'කැමති හීලෑ අලි සහ ඇතුන්ගේ නවතම තොරතුරු ඔබේ Profile එකෙන් බලන්න.' : 'Keep track of your favorite ceremonial tuskers.'}
            </p>
          </div>

          <div className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22] dark:text-white">
              {language === 'si' ? 'Email හෝ Google' : 'Email or Google'}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              {language === 'si' ? 'Email/password හෝ Google ගිණුමෙන් ලියාපදිංචි වන්න.' : 'Sign up with email/password or your Google account.'}
            </p>
          </div>

          <div className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22] dark:text-white">
              {language === 'si' ? 'සත්‍යාපිත වාර්තා' : 'Verified Community'}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              {language === 'si' ? 'ලංකාවේ අලි ඇතුන්ගේ නිල තොරතුරු ලබාගන්න.' : 'Access verified Sri Lankan cultural registries.'}
            </p>
          </div>
        </div>

        {/* Popular Elephants to Explore */}
        <div className="bg-white dark:bg-black rounded-3xl p-5 border border-zinc-200 dark:border-white/10 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#062E22] dark:text-white">
              {language === 'si' ? 'ප්‍රකට හීලෑ ඇත්තු' : 'Famous Tuskers'}
            </h3>
            <button
              onClick={onOpenDirectory}
              className="text-xs font-bold text-[#062E22] dark:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'si' ? 'සියල්ල' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {elephants.slice(0, 3).map((el) => {
              const photo = (el.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';
              const bilingualName = formatBilingualElephantName(el, language);
              return (
                <div
                  key={el.id || el.name}
                  onClick={() => onSelectElephant(el)}
                  className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 hover:border-[#062E22] dark:hover:border-white transition-all cursor-pointer space-y-2 group"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                    <img src={photo} alt={el.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#062E22] dark:text-white truncate" title={bilingualName}>{bilingualName}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{el.organization || el.location}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SIGNED IN USER PROFILE VIEW
  // -------------------------------------------------------------
  const email = profile?.email || user?.email || '';
  const isTeam = isAliMediaTeamEmail(email);
  const userPhoto = isTeam
    ? ALI_MEDIA_LOGO_URL
    : (profile?.photoURL || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80');
  const displayName = isTeam
    ? ALI_MEDIA_DISPLAY_NAME
    : (profile?.displayName || user?.displayName || 'User');
  const username = isTeam
    ? '@alimedia'
    : (profile?.username || `@${email.split('@')[0] || 'user'}`);
  const myPosts = (posts || []).filter(
    (p) => p.authorUid && (p.authorUid === profile?.uid || p.authorUid === user?.uid) && !p.isStoryOnly
  ).sort((a, b) => {
    const ta = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const tb = typeof b.createdAt === 'number' ? b.createdAt : 0;
    return tb - ta;
  });

  return (
    <div className="max-w-lg mx-auto w-full pb-24 animate-fadeIn space-y-4 pt-1">
      {/* Profile Card */}
      <div className="bg-white dark:bg-black rounded-3xl p-5 sm:p-6 border border-zinc-200 dark:border-white/10 shadow-xs space-y-4 relative overflow-hidden">
        {/* Decorative Top subtle background */}
        <div className="h-20 -mx-6 -mt-6 bg-[#062E22] relative">
          <div className="absolute top-2 right-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="relative p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all cursor-pointer border border-white/20"
              title={language === 'si' ? 'සැකසුම්' : 'Settings'}
              aria-label={language === 'si' ? 'සැකසුම්' : 'Settings'}
            >
              <Settings className="w-4 h-4" />
              {hasUnreadMessages && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white" />
                </span>
              )}
            </button>
            <button
              onClick={signOut}
              className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-white/20"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'si' ? 'ඉවත් වන්න' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* User Avatar + Identity */}
        <div className="relative -mt-12 flex flex-col items-center text-center space-y-2">
          {/* Avatar with edit camera */}
          <div className="relative">
            <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full p-1 bg-white dark:bg-black shadow-xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-black border-2 border-[#062E22] relative">
                <img
                  src={userPhoto}
                  alt={displayName}
                  className={`w-full h-full object-cover ${isTeam ? 'team-logo-theme-aware' : ''}`}
                />
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { if (!isTeam) photoInputRef.current?.click(); }}
              disabled={isTeam || uploadingPhoto || !!profile?.suspended}
              className="absolute bottom-1 right-1 bg-[#062E22] text-white p-1.5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 hover:bg-emerald-900 transition-colors disabled:opacity-50 cursor-pointer"
              title={isTeam ? 'Official Ali Media logo' : (language === 'si' ? 'ඡායාරූපය වෙනස් කරන්න' : 'Change photo')}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {profile?.suspended && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-bold">
              <Ban className="w-3.5 h-3.5" />
              {language === 'si' ? 'ඔබගේ ගිණුම අත්හිටුවා ඇත' : 'Your account is suspended'}
            </div>
          )}

          {/* Name & email — editable name */}
          <div className="space-y-0.5 w-full">
            {isEditingName ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={60}
                  className="w-full max-w-xs px-3 py-2 text-sm text-center rounded-xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#062E22] bg-zinc-50 dark:bg-black text-zinc-800 dark:text-zinc-200 font-bold"
                  placeholder={language === 'si' ? 'ඔබේ නම' : 'Your name'}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(displayName);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {language === 'si' ? 'අවලංගු' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={savingName || !nameInput.trim()}
                    className="px-4 py-1 rounded-lg text-xs font-bold bg-[#062E22] text-white hover:bg-[#062E22]/90 cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    {savingName && <Loader2 className="w-3 h-3 animate-spin" />}
                    {language === 'si' ? 'සුරකින්න' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <h2 className="text-lg sm:text-xl font-bold text-[#062E22] dark:text-white">
                  {displayName}
                </h2>
                {isTeam && <VerifiedBadge size={18} title="Official Ali Media · Verified" />}
                {!isTeam && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(displayName);
                      setIsEditingName(true);
                    }}
                    disabled={!!profile?.suspended}
                    className="p-1 text-zinc-400 hover:text-emerald-800 dark:hover:text-emerald-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
                    title={language === 'si' ? 'නම වෙනස් කරන්න' : 'Edit name'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs font-bold text-[#062E22] dark:text-zinc-400 font-mono">
              {username}
            </p>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
              <Mail className="w-3 h-3 text-zinc-400" />
              <span>{email}</span>
            </p>
          </div>

          {/* Bio text */}
          {isEditingBio ? (
            <div className="w-full space-y-2 pt-1">
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                maxLength={160}
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#062E22] bg-zinc-50 dark:bg-black text-zinc-800 dark:text-zinc-200"
                placeholder="Write something about your love for Sri Lankan elephants..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingBio(false)}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {language === 'si' ? 'අවලංගු කරන්න' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveBio}
                  className="px-4 py-1 rounded-lg text-xs font-bold bg-[#062E22] text-white hover:bg-[#062E22]/90 cursor-pointer shadow-xs"
                >
                  {language === 'si' ? 'සුරකින්න' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-300 max-w-xs leading-relaxed">
                {profile?.bio || bioInput}
              </p>
              <button
                onClick={() => setIsEditingBio(true)}
                className="p-1 text-zinc-400 hover:text-emerald-800 dark:hover:text-emerald-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Edit Bio"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100 dark:border-white/10">
          <div className="text-center">
            <div className="font-bold text-base sm:text-lg text-[#062E22] dark:text-white">
              {followedElephantsList.length}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'Follow කරන ඇත්තු' : 'Following'}
            </div>
          </div>

          <div className="text-center border-x border-zinc-100 dark:border-white/10">
            <div className="font-bold text-base sm:text-lg text-[#062E22] dark:text-white">
              {followedTuskersCount}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'ඇත්තු' : 'Tuskers'}
            </div>
          </div>

          <div className="text-center">
            <div className="font-bold text-base sm:text-lg text-[#062E22] dark:text-white">
              Active
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'තත්ත්වය' : 'Status'}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs: Posts / Following / Bookmarks / Discover */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-black rounded-2xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 min-w-[22%] py-2.5 text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{language === 'si' ? `Posts (${myPosts.length})` : `Posts (${myPosts.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('following')}
          className={`flex-1 min-w-[22%] py-2.5 text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'following'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <ElephantIcon className="w-3.5 h-3.5" />
          <span>{language === 'si' ? `Following (${followedElephantsList.length})` : `Following (${followedElephantsList.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 min-w-[22%] py-2.5 text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'bookmarks'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>{language === 'si' ? `Saved (${Object.keys(bookmarks).length})` : `Saved (${Object.keys(bookmarks).length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 min-w-[22%] py-2.5 text-[11px] font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'saved'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>{language === 'si' ? 'Discover' : 'Discover'}</span>
        </button>
      </div>

      {/* My shared posts */}
      {activeTab === 'posts' && (
        <div className="space-y-3">
          {myPosts.length === 0 ? (
            <div className="bg-white dark:bg-black rounded-3xl p-8 text-center space-y-2 border border-zinc-200 dark:border-white/10">
              <ImageIcon className="w-8 h-8 mx-auto text-zinc-400" />
              <h4 className="text-sm font-bold text-[#062E22] dark:text-white">
                {language === 'si' ? 'ඔබේ posts නැත' : 'No posts yet'}
              </h4>
              <p className="text-xs text-zinc-500">
                {language === 'si'
                  ? 'Feed එකට ඡායාරූපයක් හෝ story එකක් පළ කරන්න — මෙහි පෙනෙනු ඇත.'
                  : 'Share a photo or story from the feed — your posts will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {myPosts.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 group"
                >
                  <img
                    src={p.photoUrl}
                    alt={p.caption || 'Post'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white line-clamp-2 leading-snug">
                      {p.caption ||
                      (p.elephantName && !/^unknown\s+elephant$/i.test(String(p.elephantName).trim())
                        ? p.elephantName
                        : 'Post')}
                    </p>
                    {p.elephantName && !/^unknown\s+elephant$/i.test(String(p.elephantName).trim()) ? (
                      <p className="text-[9px] text-emerald-200 mt-0.5 truncate">🐘 {p.elephantName}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bookmarked posts — saved to this user's profile */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-3">
          {Object.keys(bookmarks).length === 0 ? (
            <div className="bg-white dark:bg-black rounded-3xl p-8 text-center space-y-2 border border-zinc-200 dark:border-white/10">
              <Bookmark className="w-8 h-8 mx-auto text-zinc-400" />
              <h4 className="text-sm font-bold text-[#062E22] dark:text-white">
                {language === 'si' ? 'සුරැකි posts නැත' : 'No saved posts yet'}
              </h4>
              <p className="text-xs text-zinc-500">
                {language === 'si'
                  ? 'Feed එකේ bookmark ඔබන්න — මෙහි පෙනෙනු ඇත. Reshare කර ඔබේ account එකට යවන්න.'
                  : 'Tap bookmark on the feed. Reshare any saved post to your account.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(Object.entries(bookmarks) as [string, BookmarkEntry][])
                .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
                .map(([postId, entry]) => {
                  const live = posts.find((p) => p.id === postId);
                  const photo = live?.photoUrl || entry.photoUrl || '';
                  const caption = live?.caption || entry.caption || '';
                  const rawName = live?.elephantName || entry.elephantName || '';
                  const name =
                    rawName && !/^unknown\s+elephant$/i.test(String(rawName).trim())
                      ? rawName
                      : live?.authorName || entry.originalAuthorName || 'Post';
                  return (
                    <div
                      key={postId}
                      className="bg-white dark:bg-black rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-2xs"
                    >
                      <div className="flex gap-3 p-3">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                          {photo ? (
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-[#062E22] dark:text-white truncate">{name}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">{caption}</p>
                          <p className="text-[10px] text-zinc-400">
                            {entry.originalAuthorUsername || entry.originalAuthorName || ''}
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={resharingId === postId}
                              onClick={() => handleReshare(entry, postId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#062E22] text-white text-[10px] font-bold disabled:opacity-50"
                            >
                              {resharingId === postId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Share2 className="w-3 h-3" />
                              )}
                              {language === 'si' ? 'Reshare' : 'Reshare to my account'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBookmark(postId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              {language === 'si' ? 'Remove' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Followed Elephants Grid */}
      {activeTab === 'following' && (
        <div className="space-y-3">
          {followedElephantsList.length === 0 ? (
            <div className="bg-white dark:bg-black rounded-3xl p-8 text-center space-y-3 border border-zinc-200 dark:border-white/10 shadow-2xs">
              <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center">
                <ElephantIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#062E22] dark:text-white">
                  {language === 'si' ? 'ඔබ තවම කිසිදු ඇතෙකු Follow කර නැත' : 'No elephants followed yet'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  {language === 'si'
                    ? 'කැමති හීලෑ අලි සහ ඇතුන් පහත ලැයිස්තුවෙන් හෝ Directory එකෙන් Follow කරන්න.'
                    : 'Explore the registry and click "Follow" on your favorite Sri Lankan elephants.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('saved')}
                className="px-5 py-2 rounded-full bg-[#062E22] text-white text-xs font-bold hover:bg-emerald-900 transition-all cursor-pointer shadow-xs"
              >
                {language === 'si' ? 'ඇතුන් සොයා බලන්න' : 'Explore Elephants'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {followedElephantsList.map((el) => {
                const photo = (el.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';
                const isTusker = el.type === 'tusker';
                const bilingualName = formatBilingualElephantName(el, language);

                return (
                  <div
                    key={el.id || el.name}
                    className="bg-white dark:bg-black rounded-2xl p-3 border border-zinc-200 dark:border-white/10 shadow-2xs flex items-center justify-between gap-3 hover:shadow-sm transition-all"
                  >
                    <div
                      onClick={() => onSelectElephant(el)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                        <img src={photo} alt={el.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-xs text-[#062E22] dark:text-white truncate" title={bilingualName}>{bilingualName}</h4>
                          {isTusker && <Crown className="w-3 h-3 text-[#062E22] dark:text-white shrink-0" />}
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{el.organization || el.location}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => el.id && toggleFollowElephant(el.id)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer shrink-0"
                    >
                      {language === 'si' ? 'Following' : 'Following'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Discover & Suggested Elephants */}
      {activeTab === 'saved' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'යෝජිත හීලෑ ඇත්තු' : 'Suggested to Follow'}
            </h3>
            <button
              onClick={onOpenDirectory}
              className="text-xs font-bold text-[#062E22] dark:text-white hover:underline cursor-pointer"
            >
              {language === 'si' ? 'සියල්ල බලන්න' : 'All Elephants'} →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedElephants.map((el) => {
              const photo = (el.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';
              const isTusker = el.type === 'tusker';
              const followingThis = el.id ? isFollowing(el.id) : false;
              const bilingualName = formatBilingualElephantName(el, language);

              return (
                <div
                  key={el.id || el.name}
                  className="bg-white dark:bg-black rounded-2xl p-3.5 border border-zinc-200 dark:border-white/10 shadow-2xs flex items-center justify-between gap-3 hover:shadow-sm transition-all"
                >
                  <div
                    onClick={() => onSelectElephant(el)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                      <img src={photo} alt={el.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="font-bold text-xs text-[#062E22] dark:text-white truncate" title={bilingualName}>{bilingualName}</h4>
                        {isTusker && <Crown className="w-3 h-3 text-[#062E22] dark:text-white shrink-0" />}
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{el.organization || el.location}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => el.id && toggleFollowElephant(el.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                      followingThis
                        ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10'
                        : 'bg-[#062E22] text-white hover:bg-emerald-900 shadow-2xs'
                    }`}
                  >
                    {followingThis ? 'Following' : (language === 'si' ? '+ Follow' : '+ Follow')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-600 pt-4 pb-2">
        AliMedia · MS 10.0.0
      </p>

      {/* Settings sheet */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => {
            if (!deleteBusy) {
              setShowSettings(false);
              setShowDeleteConfirm(false);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-[#062E22] dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {language === 'si' ? 'සැකසුම්' : 'Settings'}
              </h3>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setShowSettings(false);
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Profile edits */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                  {language === 'si' ? 'පැතිකඩ' : 'Profile'}
                </p>
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden divide-y divide-zinc-100 dark:divide-white/10">
                  <button
                    type="button"
                    disabled={!!isTeam || !!profile?.suspended}
                    onClick={() => {
                      setShowSettings(false);
                      setNameInput(displayName);
                      setIsEditingName(true);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#062E22] dark:text-white">
                        {language === 'si' ? 'නම වෙනස් කරන්න' : 'Edit display name'}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{displayName}</p>
                    </div>
                    <Edit3 className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                  <button
                    type="button"
                    disabled={!!profile?.suspended}
                    onClick={() => {
                      setShowSettings(false);
                      setIsEditingBio(true);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#062E22] dark:text-white">
                        {language === 'si' ? 'Bio වෙනස් කරන්න' : 'Edit bio'}
                      </p>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        {profile?.bio || bioInput}
                      </p>
                    </div>
                    <Edit3 className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                  <button
                    type="button"
                    disabled={!!isTeam || !!profile?.suspended || uploadingPhoto}
                    onClick={() => {
                      if (!isTeam) photoInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#062E22] dark:text-white">
                        {language === 'si' ? 'ඡායාරූපය වෙනස් කරන්න' : 'Change profile photo'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {language === 'si' ? 'ගැලරියෙන් තෝරන්න' : 'Pick from gallery'}
                      </p>
                    </div>
                    {uploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    ) : (
                      <Camera className="w-4 h-4 text-zinc-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Messages / activity — separate from Notices */}
              {onOpenMessages && user && !user.isAnonymous && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                    {language === 'si' ? 'පණිවිඩ' : 'Messages'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      onOpenMessages();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4" />
                        {hasUnreadMessages && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#062E22] dark:text-white">
                          {language === 'si' ? 'පිළිතුරු හා mentions' : 'Replies & mentions'}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {language === 'si'
                            ? 'පණිවිඩ දැනුම්දීම් — Notices පිටුවෙන් වෙන්ව'
                            : 'Message notifications — separate from Notices'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                </div>
              )}

              {/* Push notifications only — theme & language live in the top navbar */}
              {user && !user.isAnonymous && pushPermission !== 'unsupported' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                    {language === 'si' ? 'යෙදුම' : 'App'}
                  </p>
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleTogglePush}
                      disabled={pushBusy || pushPermission === 'denied'}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        {pushBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        ) : pushEnabled ? (
                          <BellRing className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <BellOff className="w-4 h-4 text-zinc-500" />
                        )}
                        <span className="text-sm font-bold text-[#062E22] dark:text-white">
                          {pushPermission === 'denied'
                            ? language === 'si'
                              ? 'දැනුම්දීම් අවහිරයි'
                              : 'Notifications blocked'
                            : pushEnabled
                              ? language === 'si'
                                ? 'Browser දැනුම්දීම් සක්‍රීයයි'
                                : 'Browser notifications on'
                              : language === 'si'
                                ? 'Browser දැනුම්දීම් සක්‍රීය කරන්න'
                                : 'Enable browser notifications'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Danger zone — self-serve delete */}
              {user && !user.isAnonymous && !isTeam && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 px-1">
                    {language === 'si' ? 'අවදානම් කලාපය' : 'Danger zone'}
                  </p>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setDeleteError(null);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <div>
                          <p className="text-sm font-bold text-red-700 dark:text-red-300">
                            {language === 'si' ? 'ගිණුම මකන්න' : 'Delete account'}
                          </p>
                          <p className="text-[11px] text-red-500/80">
                            {language === 'si'
                              ? 'ඔබේ සියලු දත්ත ස්ථිරව මකා දමයි'
                              : 'Permanently removes your data from the database'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                      <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
                        {language === 'si'
                          ? 'මෙය ආපසු හැරවිය නොහැක. ඔබේ profile, posts, bookmarks සහ දැනුම්දීම් සියල්ල මකා දැමේ.'
                          : 'This cannot be undone. Your profile, posts, bookmarks, and notifications will all be deleted.'}
                      </p>
                      {deleteError && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{deleteError}</span>
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={deleteBusy}
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteError(null);
                          }}
                          className="flex-1 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 cursor-pointer disabled:opacity-50"
                        >
                          {language === 'si' ? 'අවලංගු' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          disabled={deleteBusy}
                          onClick={handleDeleteAccount}
                          className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {deleteBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {language === 'si' ? 'ස්ථිරව මකන්න' : 'Delete forever'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={signOut}
                className="w-full py-3 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 cursor-pointer border border-zinc-200 dark:border-white/10"
              >
                <LogOut className="w-4 h-4" />
                {language === 'si' ? 'ඉවත් වන්න' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
