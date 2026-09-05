import React, { useState } from 'react';
import { Elephant } from '../types/elephant';
import { Language, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { Lock, ShieldCheck, MapPin, Building2, Loader2 } from 'lucide-react';

interface Props {
  elephant: Elephant;
  language: Language;
  onBack: () => void;
}

/**
 * Shown when a shared elephant deep-link is opened while the visitor is not signed in.
 * Full profile (photos, bio, posts) is unlocked after email or Google sign-in.
 */
export const SharedProfileGate: React.FC<Props> = ({ elephant, language, onBack }) => {
  const { signInWithGoogle } = useAuth();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = formatBilingualElephantName(elephant, language);
  const cover =
    (elephant.photos || []).find((p) => typeof p === 'string' && p.trim()) ||
    'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';
  const isMemorial = elephant.status === 'memorial';

  const handleSignIn = async () => {
    setError(null);
    setSigning(true);
    try {
      await signInWithGoogle();
      // Auth state change in App will unlock the full profile while hash stays the same
    } catch (err: any) {
      setError(
        language === 'si'
          ? 'පිවිසීම අසාර්ථකයි. නැවත උත්සාහ කරන්න හෝ Profile ටැබ් එකෙන් Email වලින් පිවිසෙන්න.'
          : 'Sign-in failed. Try again, or use Email on the Profile tab.'
      );
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full pb-28 animate-fadeIn">
      <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-emerald-950/70 shadow-lg bg-white dark:bg-[#121F1B]">
        <div className="relative h-56 sm:h-64">
          <img
            src={cover}
            alt={elephant.name}
            className="w-full h-full object-cover scale-105 blur-[2px] brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <p className="text-white font-extrabold text-sm drop-shadow">
              {language === 'si' ? 'සම්පූර්ණ පැතිකඩ අගුලු දමා ඇත' : 'Full profile is locked'}
            </p>
            <p className="text-white/80 text-[11px] max-w-xs">
              {language === 'si'
                ? 'මෙම බෙදාගත් ලේඛන කාඩ්පත බැලීමට Email හෝ Google ගිණුමෙන් පිවිසෙන්න.'
                : 'Sign in with Email or Google to open this shared registry card on AliMedia.'}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-extrabold text-[#062E22] dark:text-emerald-100">{name}</h2>
              {elephant.verified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {language === 'si' ? 'තහවුරු' : 'Verified'}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  isMemorial
                    ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {isMemorial
                  ? language === 'si'
                    ? 'සමරු'
                    : 'Memorial'
                  : language === 'si'
                    ? 'ජීවමාන'
                    : 'Living'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {elephant.organization && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  {elephant.organization}
                </span>
              )}
              {elephant.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  {elephant.location}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/80 dark:border-emerald-950/50 p-3.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {language === 'si'
              ? 'ඡායාරූප ගැලරිය, ජීවිත කතාව, community posts සහ තවත් තොරතුරු ලබා ගැනීමට Email හෝ Google මගින් නොමිලේ පිවිසෙන්න. Email සඳහා Profile ටැබ් එක භාවිතා කරන්න.'
              : 'Sign in free with Email or Google to unlock the photo gallery, biography, community posts, and full registry details. Use the Profile tab for email sign-up.'}
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signing}
            className="w-full py-3 rounded-2xl bg-[#062E22] hover:bg-emerald-900 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {signing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'si' ? 'පිවිසෙමින්…' : 'Signing in…'}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {language === 'si' ? 'Google සමඟ පිවිසෙන්න' : 'Continue with Google'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            {language === 'si' ? 'ආපසු' : 'Back'}
          </button>
        </div>
      </div>
    </div>
  );
};
