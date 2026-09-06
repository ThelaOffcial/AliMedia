import React, { useEffect, useState } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, KeyRound, Globe, Moon, Sun } from 'lucide-react';
import { LOGO_URL } from './Navbar';

type Status = 'verifying' | 'ready' | 'submitting' | 'success' | 'invalid';
type Lang = 'en' | 'si';

const STR = {
  verifying: { en: 'Verifying your link...', si: 'ඔබගේ link එක verify කරමින්...' },
  invalidTitle: { en: 'Link expired or invalid', si: 'Link එක expire වී ඇත හෝ වලංගු නොවේ' },
  invalidBody: {
    en: 'This password reset link is no longer valid. Please request a new one from the app.',
    si: 'මෙම password reset link එක තවදුරටත් වලංගු නොවේ. කරුණාකර app එකෙන් අලුත් එකක් ඉල්ලන්න.',
  },
  back: { en: 'Back to Ali Media', si: 'Ali Media වෙත' },
  resetTitle: { en: 'Reset your password', si: 'ඔබගේ password reset කරන්න' },
  newPassword: { en: 'New password', si: 'නව password එක' },
  confirmPassword: { en: 'Confirm new password', si: 'නව password එක තහවුරු කරන්න' },
  update: { en: 'Update password', si: 'Password එක update කරන්න' },
  updating: { en: 'Updating...', si: 'Update කරමින්...' },
  tooShort: { en: 'Password must be at least 6 characters.', si: 'Password එක අවම වශයෙන් අකුරු 6ක් තිබිය යුතුය.' },
  mismatch: { en: 'Passwords do not match.', si: 'Password දෙක සමාන නොවේ.' },
  expiredOnSubmit: {
    en: 'This link has expired or already been used. Please request a new one.',
    si: 'මෙම link එක expire වී ඇත හෝ දැනටමත් භාවිතා කර ඇත. කරුණාකර අලුත් එකක් ඉල්ලන්න.',
  },
  successTitle: { en: 'Password updated', si: 'Password එක update කරන ලදී' },
  successBody: {
    en: 'Your password has been changed. You can now sign in with your new password.',
    si: 'ඔබගේ password එක වෙනස් කර ඇත. දැන් ඔබට නව password එකෙන් sign in විය හැක.',
  },
  goTo: { en: 'Go to Ali Media', si: 'Ali Media වෙත යන්න' },
  footer: { en: 'Ali Media — Sri Lankan Elephant Community', si: 'Ali Media — ශ්‍රී ලාංකික අලි ප්‍රජාව' },
} as const;

/**
 * Rendered instead of the normal app when the URL carries
 * ?mode=resetPassword&oobCode=... — i.e. the user arrived here from the
 * branded reset email (see api/send-password-reset.js), whose link points
 * straight at this domain instead of Firebase's default hosted page.
 */
export function ResetPasswordScreen({ oobCode }: { oobCode: string }) {
  const [status, setStatus] = useState<Status>('verifying');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Same persisted keys as App.tsx, so this page stays visually consistent
  // with whatever the user last chose in the main app.
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('alimedia_lang');
      return saved === 'si' ? 'si' : 'en';
    } catch {
      return 'en';
    }
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('alimedia_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('alimedia_theme', 'dark'); } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('alimedia_theme', 'light'); } catch {}
    }
  }, [darkMode]);

  const t = (key: keyof typeof STR) => STR[key][lang];

  const toggleLang = () => {
    const next = lang === 'en' ? 'si' : 'en';
    setLang(next);
    try { localStorage.setItem('alimedia_lang', next); } catch {}
  };

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('invalid');
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('tooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch (err: any) {
      setError(t('expiredOnSubmit'));
      setStatus('invalid');
    }
  };

  const goToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col font-sans antialiased transition-colors">
      {/* Header — mirrors Navbar.tsx exactly: logo left, dark/language toggles right */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-colors">
        <div className="max-w-4xl mx-auto px-4 h-24 sm:h-28 flex items-center justify-between">
          <div
            onClick={goToLogin}
            className="flex items-center cursor-pointer group active:scale-95 transition-transform"
          >
            <img
              src={LOGO_URL}
              alt="අලි Media"
              referrerPolicy="no-referrer"
              className="h-18 sm:h-22 w-auto object-contain logo-theme-aware"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-[#062E22] dark:text-amber-400 transition-all duration-300 cursor-pointer shadow-2xs active:scale-90"
              title={darkMode ? (lang === 'si' ? 'Light Mode වෙත මාරුවන්න' : 'Switch to Light Mode') : (lang === 'si' ? 'Dark Mode වෙත මාරුවන්න' : 'Switch to Dark Mode')}
              aria-label="Toggle Dark / Light Theme"
            >
              <div className={`transition-transform duration-500 ease-out ${darkMode ? 'rotate-180 scale-110' : 'rotate-0 scale-100'}`}>
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-emerald-800" />
                )}
              </div>
            </button>

            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-xs font-bold text-[#062E22] dark:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
              title="Toggle Sinhala / English"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{lang === 'si' ? 'සිංහල' : 'English'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 rounded-2xl p-6 shadow-2xs">
            {status === 'verifying' && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-6 h-6 text-[#062E22] dark:text-emerald-400 animate-spin" />
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{t('verifying')}</p>
              </div>
            )}

            {status === 'invalid' && (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-sm font-bold">{t('invalidTitle')}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {error || t('invalidBody')}
                </p>
                <button
                  onClick={goToLogin}
                  className="mt-2 w-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-sm"
                >
                  {t('back')}
                </button>
              </div>
            )}

            {(status === 'ready' || status === 'submitting') && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4.5 h-4.5 text-[#062E22] dark:text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold leading-tight">{t('resetTitle')}</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{email}</p>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('newPassword')}
                    autoFocus
                    className="w-full bg-white dark:bg-[#0B1512] border border-zinc-200 dark:border-emerald-900/40 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 placeholder:text-zinc-400"
                    disabled={status === 'submitting'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#062E22] dark:hover:text-amber-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPassword')}
                  className="w-full bg-white dark:bg-[#0B1512] border border-zinc-200 dark:border-emerald-900/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#062E22] dark:focus:ring-emerald-600 placeholder:text-zinc-400"
                  disabled={status === 'submitting'}
                />

                {error && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                >
                  {status === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {status === 'submitting' ? t('updating') : t('update')}
                </button>
              </form>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-bold">{t('successTitle')}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {t('successBody')}
                </p>
                <button
                  onClick={goToLogin}
                  className="mt-2 w-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-sm"
                >
                  {t('goTo')}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 mt-6">
            {t('footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
