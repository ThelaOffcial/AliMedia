import React, { useEffect, useState } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

type Status = 'verifying' | 'ready' | 'submitting' | 'success' | 'invalid';

/**
 * Rendered instead of the normal app when the URL carries
 * ?mode=resetPassword&oobCode=... — i.e. the user arrived here from the
 * branded reset email (see api/send-password-reset.js), whose action link
 * points straight at this domain instead of Firebase's default hosted page.
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
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center px-4 font-sans antialiased">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#062E22] flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-lg font-bold">AliMedia</h1>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          {status === 'verifying' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <p className="text-xs font-bold text-neutral-500">Verifying your link...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <h2 className="text-sm font-bold">Link expired or invalid</h2>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {error || 'This password reset link is no longer valid. Please request a new one from the app.'}
              </p>
              <button
                onClick={goToLogin}
                className="mt-2 w-full bg-[#062E22] text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition"
              >
                Back to AliMedia
              </button>
            </div>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold mb-1">Reset your password</h2>
                <p className="text-xs text-neutral-500">for {email}</p>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  disabled={status === 'submitting'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                className="w-full bg-[#062E22] text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {status === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'submitting' ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <h2 className="text-sm font-bold">Password updated</h2>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <button
                onClick={goToLogin}
                className="mt-2 w-full bg-[#062E22] text-white text-xs font-bold py-3 rounded-full hover:opacity-90 transition"
              >
                Go to AliMedia
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
