import React, { useEffect, useState } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { LOGO_URL } from './Navbar';

type Status = 'verifying' | 'ready' | 'submitting' | 'success' | 'invalid';

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
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch (err: any) {
      setError('This link has expired or already been used. Please request a new one.');
      setStatus('invalid');
    }
  };

  const goToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center px-4 font-sans antialiased transition-colors">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src={LOGO_URL}
            alt="අලි Media"
            referrerPolicy="no-referrer"
            className="h-16 w-auto object-contain logo-theme-aware mb-2"
          />
        </div>

        <div className="bg-white dark:bg-[#121F1B] border border-zinc-200 dark:border-emerald-900/40 rounded-2xl p-6 shadow-2xs">
          {status === 'verifying' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-6 h-6 text-[#062E22] dark:text-emerald-400 animate-spin" />
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Verifying your link...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-sm font-bold">Link expired or invalid</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {error || 'This password reset link is no longer valid. Please request a new one from the app.'}
              </p>
              <button
                onClick={goToLogin}
                className="mt-2 w-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-sm"
              >
                Back to Ali Media
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
                  <h2 className="text-sm font-bold leading-tight">Reset your password</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{email}</p>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
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
                placeholder="Confirm new password"
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
                {status === 'submitting' ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-sm font-bold">Password updated</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <button
                onClick={goToLogin}
                className="mt-2 w-full bg-[#062E22] dark:bg-emerald-700 text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-sm"
              >
                Go to Ali Media
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 mt-6">
          Ali Media — Sri Lankan Elephant Community
        </p>
      </div>
    </div>
  );
}
