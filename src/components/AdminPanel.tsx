import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  Elephant,
  CulturalEvent,
  ElephantPost,
  ElephantType,
  Gender,
  ElephantSource,
} from '../types/elephant';
import { UserProfile } from '../types/user';
import {
  LayoutDashboard,
  PawPrint,
  CalendarDays,
  Images,
  Users as UsersIcon,
  LogOut,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Star,
  ShieldCheck,
  Radio,
  Loader2,
  ImagePlus,
  ArrowLeft,
  Heart,
  AlertTriangle,
  Check,
  Menu,
  UserPlus,
  Copy,
  PartyPopper,
  Upload,
  Download,
  FileSpreadsheet,
  Ban,
  UserRound,
  Camera,
  Activity,
  Globe2,
  ShieldAlert,
  CheckCircle2,
  MessageSquareWarning,
} from 'lucide-react';
import { Language } from '../utils/translations';
import { LOGO_URL } from './Navbar';
import { compressImageFile } from '../utils/imageCompressor';
import { uploadPhotoToCloudinary } from '../firebase/cloudinaryService';
import { getAllElephantPosts, deleteElephantPost, updateElephantPost, subscribeToPostLikes } from '../firebase/postService';
import { getAllUsers, deleteUserAccount, setUserSuspended } from '../firebase/userService';
import { subscribeToVisitors, type VisitorInfo } from '../firebase/presenceService';
import {
  subscribeToModerationQueue,
  approveModerationItem,
  removeModerationItem,
  type ModerationItem,
} from '../firebase/commentService';
import {
  signInAdmin,
  signUpAdmin,
  signOutAdmin,
  subscribeAdminAuthState,
  getAdminAuthErrorMessage,
} from '../firebase/adminAuthService';
import { calcAgeFromBirth, calcAgeBetween } from '../utils/ageCalculator';

// -------------------------------------------------------------
// Props
// -------------------------------------------------------------

interface AdminPanelProps {
  elephants: Elephant[];
  events: CulturalEvent[];
  posts: ElephantPost[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteElephant: (id: string, name?: string, sinhalaName?: string) => Promise<{
    deletedElephantName: string;
    postsDeleted: number;
    usersUpdated: number;
    eventsUpdated: number;
  } | void>;
  onToggleVerification: (id: string, verified: boolean) => Promise<void>;
  onToggleFeatured: (id: string, isFeatured: boolean) => Promise<void>;
  onToggleLive: (id: string, isLive: boolean) => Promise<void>;
  onSaveEvent: (event: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onViewElephant: (elephant: Elephant) => void;
  onClose: () => void;
  language: Language;
}

type AdminTab = 'dashboard' | 'elephants' | 'events' | 'posts' | 'moderation' | 'users';

const EMPTY_ELEPHANT_FORM = {
  name: '',
  sinhalaName: '',
  otherNames: '',
  gender: 'male' as Gender,
  type: 'elephant' as ElephantType,
  dateOfBirth: '',
  age: '',
  dateOfDeath: '',
  location: '',
  organization: '',
  mahout: '',
  tusks: '',
  physicalCharacteristics: '',
  description: '',
  peraheraParticipation: '',
  sourcesText: '',
  verified: true,
  status: 'living' as 'living' | 'memorial',
  isFeatured: false,
  isLive: false,
  liveStreamUrl: '',
  customBadge: '',
};

const EMPTY_EVENT_FORM = {
  title: '',
  sinhalaTitle: '',
  description: '',
  location: '',
  date: '',
  type: 'perahera' as CulturalEvent['type'],
  participatingElephants: '',
  isActive: true,
  coverImage: '',
  isLive: false,
  liveStreamUrl: '',
};

// -------------------------------------------------------------
// Small shared UI bits
// -------------------------------------------------------------

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'elephants', label: 'Elephants', icon: PawPrint },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'posts', label: 'Posts', icon: Images },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'users', label: 'Users', icon: UsersIcon },
];

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-2xl max-w-sm w-full p-5 border border-parchment-300 shadow-2xl animate-fadeIn">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${destructive ? 'bg-red-100 text-red-600' : 'bg-pine-100 text-pine-700'}`}>
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-950 text-sm">{title}</h3>
            <p className="text-xs text-ink-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-parchment-200 text-ink-800 hover:bg-parchment-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-pine-700 hover:bg-pine-800'
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-parchment-300 bg-white text-sm text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-pine-500/40 focus:border-pine-500 transition-all';

// -------------------------------------------------------------
// Login screen
// -------------------------------------------------------------

function AdminLogin({
  onClose,
  onSwitchToSignup,
}: {
  onClose: () => void;
  onSwitchToSignup: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signInAdmin(email, password);
      // onAuthStateChanged listener in the parent will pick this up automatically.
    } catch (err: any) {
      setError(getAdminAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-3xl max-w-sm w-full border border-parchment-300 shadow-2xl overflow-hidden animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pt-8 pb-5 flex flex-col items-center border-b border-parchment-200 px-6">
          <div className="registry-seal w-14 h-14 rounded-full flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-ink-950/80" />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-950">Admin Console</h2>
          <p className="text-[11px] text-ink-500 mt-1">Sign in with your registered admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field label="Email">
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className={`${inputCls} pl-9`}
                disabled={submitting}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-9 pr-9`}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-[10.5px] text-ink-500 text-center leading-relaxed pt-1">
            Admin access is limited to accounts added by the platform owner.
          </p>

          <button
            type="button"
            onClick={onSwitchToSignup}
            className="w-full text-center text-[11.5px] font-bold text-pine-700 hover:text-pine-900 transition-colors pt-1"
          >
            Need an account? Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Signup screen
// -------------------------------------------------------------

function AdminSignup({
  onClose,
  onSwitchToLogin,
}: {
  onClose: () => void;
  onSwitchToLogin: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ uid: string; isAdmin: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { uid, isAdmin } = await signUpAdmin(email, password);
      setResult({ uid, isAdmin });
    } catch (err: any) {
      setError(getAdminAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUid = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable - the UID is still shown on screen to copy by hand.
    }
  };

  // ---- Success state: account created, tell them what to do next ----
  if (result) {
    return (
      <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-parchment-50 rounded-3xl max-w-sm w-full border border-parchment-300 shadow-2xl overflow-hidden animate-fadeIn">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pt-8 pb-5 flex flex-col items-center border-b border-parchment-200 px-6">
            <div className="registry-seal w-14 h-14 rounded-full flex items-center justify-center mb-3">
              <PartyPopper className="w-6 h-6 text-ink-950/80" />
            </div>
            <h2 className="font-display text-lg font-bold text-ink-950">Account Created</h2>
            <p className="text-[11px] text-ink-500 mt-1 text-center leading-relaxed">
              Your login now exists in Firebase Authentication.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {result.isAdmin ? (
              <div className="bg-pine-50 border border-pine-200 text-pine-800 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>You're already on the admin allowlist - you can sign in now.</span>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    One more step: ask the platform owner to add your User ID below to the{' '}
                    <code className="font-mono">admins</code> path in Realtime Database before you can sign in.
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Your User ID</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-xl border border-parchment-300 bg-white text-xs text-ink-800 truncate">
                      {result.uid}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      className="shrink-0 w-9 h-9 rounded-xl bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-700 transition-colors"
                      aria-label="Copy User ID"
                      title="Copy User ID"
                    >
                      {copied ? <Check className="w-4 h-4 text-pine-700" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onSwitchToLogin}
              className="w-full py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-3xl max-w-sm w-full border border-parchment-300 shadow-2xl overflow-hidden animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pt-8 pb-5 flex flex-col items-center border-b border-parchment-200 px-6">
          <div className="registry-seal w-14 h-14 rounded-full flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-ink-950/80" />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-950">Create Admin Account</h2>
          <p className="text-[11px] text-ink-500 mt-1 text-center leading-relaxed">
            Sign up, then ask the platform owner to approve your access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field label="Email">
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className={`${inputCls} pl-9`}
                disabled={submitting}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={`${inputCls} pl-9 pr-9`}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm Password">
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-9`}
                disabled={submitting}
              />
            </div>
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>

          <p className="text-[10.5px] text-ink-500 text-center leading-relaxed pt-1">
            Signing up creates your login only. An existing admin still has to approve your access.
          </p>

          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full text-center text-[11.5px] font-bold text-pine-700 hover:text-pine-900 transition-colors pt-1"
          >
            Already have an account? Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Main Admin Panel
// -------------------------------------------------------------

export const AdminPanel: React.FC<AdminPanelProps> = ({
  elephants,
  events,
  posts,
  onSaveElephant,
  onDeleteElephant,
  onToggleVerification,
  onToggleFeatured,
  onToggleLive,
  onSaveEvent,
  onDeleteEvent,
  onViewElephant,
  onClose,
}) => {
  // ---- Auth ----
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const unsub = subscribeAdminAuthState((user) => {
      setAdminUser(user);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Lock page scroll while the console is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-parchment-50 animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return authScreen === 'signup' ? (
      <AdminSignup onClose={onClose} onSwitchToLogin={() => setAuthScreen('login')} />
    ) : (
      <AdminLogin onClose={onClose} onSwitchToSignup={() => setAuthScreen('signup')} />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950 flex text-ink-950 font-sans">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col bg-ink-950 text-parchment-100 border-r border-white/10 shrink-0">
        <div className="p-5 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-parchment-50 flex items-center justify-center overflow-hidden shrink-0 border border-white/20">
            <img src={LOGO_URL} alt="Alimedia" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <p className="font-display font-bold text-sm leading-tight">Alimedia</p>
            <p className="text-[10px] text-parchment-400 uppercase tracking-wider">Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-gold-500/15 text-gold-300' : 'text-parchment-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="px-3 py-2 text-[11px] text-parchment-400 truncate">{adminUser.email}</div>
          <button
            onClick={() => signOutAdmin()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-parchment-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-parchment-300 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Site
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 bg-parchment-50">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-ink-950 text-parchment-100 shrink-0">
          <button onClick={() => setMobileNavOpen((s) => !s)} className="p-1.5 -ml-1.5">
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-display font-bold text-sm">{NAV_ITEMS.find((n) => n.id === activeTab)?.label}</p>
          <button onClick={onClose} className="p-1.5 -mr-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden bg-ink-950 text-parchment-100 px-3 pb-3 shrink-0 grid grid-cols-3 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold ${
                    active ? 'bg-gold-500/15 text-gold-300' : 'text-parchment-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => signOutAdmin()}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold text-parchment-300"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto admin-scroll">
          <div className="max-w-5xl mx-auto p-4 sm:p-6">
            {activeTab === 'dashboard' && (
              <DashboardTab elephants={elephants} events={events} posts={posts} />
            )}
            {activeTab === 'elephants' && (
              <ElephantsTab
                elephants={elephants}
                onSaveElephant={onSaveElephant}
                onDeleteElephant={onDeleteElephant}
                onToggleVerification={onToggleVerification}
                onToggleFeatured={onToggleFeatured}
                onToggleLive={onToggleLive}
                onViewElephant={onViewElephant}
              />
            )}
            {activeTab === 'events' && (
              <EventsTab elephants={elephants} events={events} onSaveEvent={onSaveEvent} onDeleteEvent={onDeleteEvent} />
            )}
            {activeTab === 'posts' && <PostsTab posts={posts} />}
            {activeTab === 'moderation' && <ModerationTab adminUid={adminUser?.uid || ''} />}
            {activeTab === 'users' && <UsersTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

function ModerationTab({ adminUid }: { adminUid: string }) {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToModerationQueue(setItems);
  }, []);

  const openItems = items.filter((i) => i.status === 'open');
  const closedItems = items.filter((i) => i.status !== 'open').slice(0, 20);

  const act = async (item: ModerationItem, action: 'approve' | 'remove') => {
    if (!adminUid) return;
    setBusyId(item.id);
    try {
      if (action === 'approve') await approveModerationItem(item, adminUid);
      else await removeModerationItem(item, adminUid);
    } catch (err) {
      console.warn(err);
      alert('Action failed. Check database rules for moderation_queue / post_comments.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-950 flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-amber-600" />
          Comment moderation
        </h1>
        <p className="text-xs text-ink-500 mt-0.5">
          Auto-flagged comments and user-submitted reports. Dismiss to keep content, or remove permanently.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
        <strong>{openItems.length}</strong> waiting for your decision
      </div>

      <div className="space-y-3">
        {openItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-parchment-200 p-6 text-center text-sm text-ink-500">
            No open reports. Queue is clear.
          </div>
        ) : (
          openItems.map((item) => {
            const isUserReport = item.type === 'user_report' || item.type === 'post_report';
            const isPostReport = item.type === 'post_report';
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 space-y-3 border ${
                  isUserReport ? 'border-violet-200' : 'border-parchment-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-ink-950">{item.authorName}</p>
                    <p className="text-[10px] text-ink-400 font-mono truncate max-w-[220px]">
                      {item.authorUid} · {isPostReport ? 'post report' : `post ${item.postId.slice(0, 8)}…`}
                    </p>
                    {isUserReport && item.reportedBy && (
                      <p className="text-[10px] text-violet-600 mt-0.5">
                        Reported by user · {item.reportedBy.slice(0, 12)}…
                      </p>
                    )}
                    {isPostReport && (
                      <p className="text-[10px] text-violet-700 mt-0.5 font-bold">
                        POST REPORT · {item.postId.slice(0, 12)}…
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                      isUserReport
                        ? 'bg-violet-100 text-violet-700 border-violet-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}
                  >
                    {isUserReport
                      ? `${isPostReport ? 'post · ' : ''}${(item.reportReason || 'user report').replace('_', ' ')}`
                      : (item.flagReason || 'auto-flagged')}
                  </span>
                </div>
                {isPostReport && item.photoUrl ? (
                  <div className="rounded-xl overflow-hidden border border-parchment-200 max-h-40 bg-parchment-50">
                    <img src={item.photoUrl} alt="" className="w-full h-40 object-cover" />
                  </div>
                ) : null}
                <p className="text-sm text-ink-800 bg-parchment-50 rounded-xl p-3 border border-parchment-200 whitespace-pre-wrap break-words">
                  {item.text}
                </p>
                {!isUserReport && item.matchedTerms && item.matchedTerms.length > 0 && (
                  <p className="text-[10px] text-ink-500">
                    Matched: {item.matchedTerms.join(', ')}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => act(item, 'approve')}
                    className="flex-1 py-2 rounded-xl bg-pine-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-pine-900 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isUserReport ? 'Dismiss report' : 'Approve & publish'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => act(item, 'remove')}
                    className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isPostReport ? 'Remove post' : 'Remove comment'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {closedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-parchment-200 p-4">
          <h3 className="text-sm font-bold text-ink-950 mb-2">Recent decisions</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto admin-scroll">
            {closedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-parchment-100 last:border-0">
                <span className="truncate text-ink-600 flex-1">{item.text.slice(0, 60)}</span>
                <span
                  className={`shrink-0 font-bold ${
                    item.status === 'approved' ? 'text-pine-700' : 'text-red-600'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Dashboard
// -------------------------------------------------------------

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl border border-parchment-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-pine-50 text-pine-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-extrabold text-ink-950 leading-tight">{value}</p>
        <p className="text-[11px] text-ink-500 font-semibold uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function DashboardTab({ elephants, events, posts }: { elephants: Elephant[]; events: CulturalEvent[]; posts: ElephantPost[] }) {
  const verified = elephants.filter((e) => e.verified).length;
  const featured = elephants.filter((e) => e.isFeatured).length;
  const live = elephants.filter((e) => e.isLive).length;
  const totalPostLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);

  const [visitors, setVisitors] = useState<VisitorInfo[]>([]);

  useEffect(() => {
    const unsub = subscribeToVisitors(setVisitors);
    return unsub;
  }, []);

  const ACTIVE_MS = 5 * 60 * 1000; // active within last 5 minutes
  const now = Date.now();
  const activeNow = visitors.filter((v) => {
    const t = typeof v.lastActive === 'number' ? v.lastActive : Number(v.lastActive) || 0;
    return t > 0 && now - t < ACTIVE_MS;
  }).length;
  const totalVisitors = visitors.length;

  const recentVisitors = [...visitors]
    .sort((a, b) => {
      const ta = typeof a.lastActive === 'number' ? a.lastActive : 0;
      const tb = typeof b.lastActive === 'number' ? b.lastActive : 0;
      return tb - ta;
    })
    .slice(0, 8);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-950">Overview</h1>
        <p className="text-xs text-ink-500 mt-0.5">A quick snapshot of the registry's live data.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total visitors" value={totalVisitors} icon={Globe2} />
        <StatCard label="Active now" value={activeNow} icon={Activity} />
        <StatCard label="Post likes" value={totalPostLikes} icon={Heart} />
        <StatCard label="Elephants" value={elephants.length} icon={PawPrint} />
        <StatCard label="Verified" value={verified} icon={ShieldCheck} />
        <StatCard label="Featured" value={featured} icon={Star} />
        <StatCard label="Live now" value={live} icon={Radio} />
        <StatCard label="Events" value={events.length} icon={CalendarDays} />
        <StatCard label="Community posts" value={posts.length} icon={Images} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-parchment-200 p-4">
          <h3 className="text-sm font-bold text-ink-950 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-pine-700" />
            Recent visitors
          </h3>
          {recentVisitors.length === 0 ? (
            <p className="text-xs text-ink-500">No visitor activity recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto admin-scroll">
              {recentVisitors.map((v) => {
                const last =
                  typeof v.lastActive === 'number'
                    ? new Date(v.lastActive).toLocaleString()
                    : '—';
                const isActive =
                  typeof v.lastActive === 'number' && now - v.lastActive < ACTIVE_MS;
                return (
                  <div key={v.id} className="flex items-center gap-2 py-1">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-parchment-300'}`}
                      title={isActive ? 'Active' : 'Away'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-950 truncate">{v.displayName || 'Guest'}</p>
                      <p className="text-[10px] text-ink-500 truncate">{v.email || 'Guest'} · {last}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-parchment-200 p-4">
          <h3 className="text-sm font-bold text-ink-950 mb-3">Recently added elephants</h3>
          {elephants.length === 0 ? (
            <p className="text-xs text-ink-500">No elephants in the registry yet.</p>
          ) : (
            <div className="space-y-2">
              {elephants.slice(0, 5).map((el) => (
                <div key={el.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-9 h-9 rounded-lg bg-parchment-200 overflow-hidden shrink-0">
                    {(el.profilePhoto || el.photos?.[0]) && (
                      <img src={el.profilePhoto || el.photos[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink-950 truncate">{el.name}</p>
                    <p className="text-[10.5px] text-ink-500 truncate">{el.location || 'No location set'}</p>
                  </div>
                  {el.verified && <ShieldCheck className="w-3.5 h-3.5 text-pine-600 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Elephants Tab — full CRUD
// -------------------------------------------------------------

interface PhotoSlot {
  url: string;
  publicId: string;
  status: 'ready' | 'uploading' | 'error';
}

function ElephantsTab({
  elephants,
  onSaveElephant,
  onDeleteElephant,
  onToggleVerification,
  onToggleFeatured,
  onToggleLive,
  onViewElephant,
}: {
  elephants: Elephant[];
  onSaveElephant: AdminPanelProps['onSaveElephant'];
  onDeleteElephant: AdminPanelProps['onDeleteElephant'];
  onToggleVerification: AdminPanelProps['onToggleVerification'];
  onToggleFeatured: AdminPanelProps['onToggleFeatured'];
  onToggleLive: AdminPanelProps['onToggleLive'];
  onViewElephant: AdminPanelProps['onViewElephant'];
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Elephant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return elephants;
    return elephants.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.sinhalaName || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.organization || '').toLowerCase().includes(q)
    );
  }, [elephants, search]);

  const editingElephant = editingId && editingId !== 'new' ? elephants.find((e) => e.id === editingId) || null : null;

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await onDeleteElephant(deleteTarget.id, deleteTarget.name, deleteTarget.sinhalaName);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  if (editingId) {
    return (
      <ElephantForm
        elephant={editingElephant}
        onCancel={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
        onSaveElephant={onSaveElephant}
      />
    );
  }

  if (showBulkUpload) {
    return (
      <BulkElephantUpload
        onCancel={() => setShowBulkUpload(false)}
        onSaveElephant={onSaveElephant}
        onDone={() => setShowBulkUpload(false)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Elephants</h1>
          <p className="text-xs text-ink-500 mt-0.5">{elephants.length} record(s) in the registry.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-parchment-300 bg-white hover:bg-parchment-50 text-ink-800 text-sm font-bold transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => setEditingId('new')}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Elephant
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, location or organization…"
          className={`${inputCls} pl-9`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No elephants found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((el) => (
            <div key={el.id} className="bg-white rounded-2xl border border-parchment-200 p-3.5 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-parchment-200 overflow-hidden shrink-0">
                {(el.profilePhoto || el.photos?.[0]) ? (
                  <img src={el.profilePhoto || el.photos![0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-300">
                    <PawPrint className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold text-ink-950 truncate">{el.name}</p>
                  {el.verified && <ShieldCheck className="w-3.5 h-3.5 text-pine-600 shrink-0" />}
                  {el.isFeatured && <Star className="w-3.5 h-3.5 text-gold-500 shrink-0" />}
                  {el.isLive && <Radio className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                </div>
                <p className="text-[11px] text-ink-500 truncate">
                  {el.location || 'No location'} · {el.organization || 'No organization'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <ToggleChip
                    label="Verified"
                    active={!!el.verified}
                    busy={toggleBusyId === el.id + 'v'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'v');
                      try {
                        await onToggleVerification(el.id!, !el.verified);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                  <ToggleChip
                    label="Featured"
                    active={!!el.isFeatured}
                    busy={toggleBusyId === el.id + 'f'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'f');
                      try {
                        await onToggleFeatured(el.id!, !el.isFeatured);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                  <ToggleChip
                    label="Live"
                    active={!!el.isLive}
                    busy={toggleBusyId === el.id + 'l'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'l');
                      try {
                        await onToggleLive(el.id!, !el.isLive);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onViewElephant(el)}
                  title="View profile"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-parchment-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(el.id!)}
                  title="Edit"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-pine-700 hover:bg-pine-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(el)}
                  title="Delete"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message="This permanently removes the elephant record along with all of its community posts, and updates any events or followers referencing it. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ToggleChip({ label, active, busy, onClick }: { label: string; active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 disabled:opacity-50 ${
        active ? 'bg-pine-700 text-white border-pine-700' : 'bg-transparent text-ink-500 border-parchment-300'
      }`}
    >
      {busy && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {label}
    </button>
  );
}

// -------------------------------------------------------------
// Bulk Elephant Upload (CSV)
// -------------------------------------------------------------

const BULK_CSV_HEADERS = [
  'name',
  'sinhalaName',
  'otherNames',
  'gender',
  'type',
  'dateOfBirth',
  'age',
  'dateOfDeath',
  'location',
  'organization',
  'mahout',
  'tusks',
  'physicalCharacteristics',
  'description',
  'peraheraParticipation',
  'photos',
  'verified',
  'status',
  'isFeatured',
  'isLive',
  'customBadge',
] as const;

const BULK_CSV_SAMPLE = [
  BULK_CSV_HEADERS.join(','),
  'Indiraja,ඉන්දිරාජා,"Indi, Raja",male,tusker,1998-01-15,28,,Kandy,Sri Dalada Maligawa,Sample Mahout,Twin symmetrical tusks,Tall with sloping back,Sacred tusker of the Temple of the Tooth,"Kandy Esala Perahera; Kelaniya Duruthu Perahera",https://example.com/photo1.jpg,true,living,true,false,National Treasure',
  'Nadungamuwa Raja,නදුන්ගමුව රාජා,,male,tusker,1950,55,2022-03-07,Gampaha,Nadungamuwa Temple,,,Legendary tusker,One of the most famous tuskers in Sri Lanka,Kandy Esala Perahera,,true,memorial,true,false,',
].join('\n');

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function parseBool(v: string | undefined, defaultVal = false): boolean {
  if (v === undefined || v === '') return defaultVal;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function splitList(v: string | undefined): string[] {
  if (!v || !v.trim()) return [];
  return v
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type BulkRowStatus = 'pending' | 'uploading' | 'success' | 'error' | 'skipped';

interface BulkRow {
  index: number;
  raw: Record<string, string>;
  payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> | null;
  error?: string;
  status: BulkRowStatus;
}

function mapCsvRowToElephant(
  headers: string[],
  cells: string[]
): { payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> | null; error?: string; raw: Record<string, string> } {
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    raw[h] = (cells[i] ?? '').trim();
  });

  const name = raw['name'] || '';
  if (!name) {
    return { payload: null, error: 'Missing required field: name', raw };
  }

  const genderRaw = (raw['gender'] || 'male').toLowerCase();
  const gender: Gender = genderRaw === 'female' || genderRaw === 'f' ? 'female' : 'male';

  const typeRaw = (raw['type'] || 'elephant').toLowerCase();
  const type: ElephantType =
    typeRaw === 'tusker' || typeRaw === 'ඇතා' || typeRaw === 'etha' ? 'tusker' : 'elephant';

  const statusRaw = (raw['status'] || 'living').toLowerCase();
  const status: 'living' | 'memorial' = statusRaw === 'memorial' || statusRaw === 'deceased' ? 'memorial' : 'living';

  const photos = splitList(raw['photos']);
  const otherNames = splitList(raw['othernames'] || raw['other_names']);
  // also support comma-separated otherNames if user used commas inside quotes already parsed
  const otherNamesAlt =
    otherNames.length > 0
      ? otherNames
      : (raw['othernames'] || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  const perahera = splitList(raw['peraheraparticipation'] || raw['perahera_participation']);

  const dateOfBirth = raw['dateofbirth'] || raw['date_of_birth'] || '';
  const dateOfDeath = raw['dateofdeath'] || raw['date_of_death'] || '';
  const ageStr = raw['age'] || '';
  let age: number | string = ageStr;
  if (ageStr && !isNaN(Number(ageStr))) age = Number(ageStr);
  else {
    const end = status === 'memorial' && dateOfDeath ? dateOfDeath : null;
    const calculated = calcAgeBetween(dateOfBirth, end);
    if (calculated !== null) age = calculated;
  }

  const payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> = {
    name,
    sinhalaName: raw['sinhalaname'] || raw['sinhala_name'] || '',
    otherNames: otherNamesAlt,
    gender,
    type,
    dateOfBirth,
    age,
    dateOfDeath,
    location: raw['location'] || '',
    organization: raw['organization'] || '',
    mahout: raw['mahout'] || '',
    tusks: raw['tusks'] || '',
    physicalCharacteristics: raw['physicalcharacteristics'] || raw['physical_characteristics'] || '',
    description: raw['description'] || '',
    peraheraParticipation: perahera,
    photos,
    cloudinaryPhotos: photos.map((url) => ({ url, publicId: '' })),
    sources: [],
    verified: parseBool(raw['verified'], true),
    status,
    isFeatured: parseBool(raw['isfeatured'] || raw['is_featured'], false),
    isLive: parseBool(raw['islive'] || raw['is_live'], false),
    customBadge: raw['custombadge'] || raw['custom_badge'] || '',
    followerCount: 0,
  };

  return { payload, raw };
}

function BulkElephantUpload({
  onCancel,
  onSaveElephant,
  onDone,
}: {
  onCancel: () => void;
  onSaveElephant: AdminPanelProps['onSaveElephant'];
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState({ success: 0, error: 0, skipped: 0 });

  const downloadTemplate = () => {
    const blob = new Blob([BULK_CSV_SAMPLE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elephants-bulk-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setRows([]);
    setFileName(file.name);
    setDoneCount({ success: 0, error: 0, skipped: 0 });

    try {
      const text = await file.text();
      const { headers, rows: rawRows } = parseCsvText(text);
      if (headers.length === 0) {
        setParseError('CSV is empty.');
        return;
      }
      if (!headers.includes('name')) {
        setParseError('CSV must include a "name" column header.');
        return;
      }

      const mapped: BulkRow[] = rawRows.map((cells, index) => {
        const { payload, error, raw } = mapCsvRowToElephant(headers, cells);
        return {
          index: index + 1,
          raw,
          payload,
          error,
          status: error ? 'skipped' : 'pending',
        };
      });

      if (mapped.length === 0) {
        setParseError('No data rows found under the header.');
        return;
      }
      setRows(mapped);
    } catch (err: any) {
      setParseError(err?.message || 'Failed to read CSV file.');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const validRows = rows.filter((r) => r.payload && r.status !== 'skipped');

  const startUpload = async () => {
    if (validRows.length === 0 || uploading) return;
    setUploading(true);
    let success = 0;
    let error = 0;
    let skipped = rows.filter((r) => r.status === 'skipped').length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.payload || row.status === 'skipped') continue;

      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'uploading' as BulkRowStatus } : r))
      );

      try {
        await onSaveElephant(row.payload);
        success++;
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: 'success' as BulkRowStatus } : r))
        );
      } catch (err: any) {
        error++;
        const msg = err?.message || String(err);
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'error' as BulkRowStatus, error: msg } : r
          )
        );
      }
      setDoneCount({ success, error, skipped });
    }

    setUploading(false);
  };

  const finished = !uploading && rows.length > 0 && rows.every((r) => r.status !== 'pending' && r.status !== 'uploading');

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-parchment-200 hover:bg-parchment-50 text-ink-700 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink-950">Bulk Upload Elephants</h1>
          <p className="text-xs text-ink-500 mt-0.5">Import many records from a CSV file at once.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-parchment-300 bg-white hover:bg-parchment-50 text-ink-800 text-sm font-bold transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download CSV template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Choose CSV file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <div className="text-[11px] text-ink-500 leading-relaxed space-y-1">
          <p>
            <span className="font-bold text-ink-700">Required column:</span> <code className="font-mono">name</code>
          </p>
          <p>
            Optional: sinhalaName, otherNames (comma or ; separated), gender (male/female), type (elephant/tusker),
            dateOfBirth (year or YYYY-MM-DD — age auto-calculated if age empty), age, dateOfDeath (required for memorial),
            location, organization, mahout, tusks, physicalCharacteristics, description,
            peraheraParticipation (; separated), photos (; separated image URLs), verified (true/false),
            status (living/memorial), isFeatured, isLive, customBadge.
          </p>
          <p>Photo URLs only — image files are not uploaded in bulk (use single Add/Edit for Cloudinary uploads).</p>
        </div>

        {fileName && (
          <p className="text-xs text-ink-600">
            File: <span className="font-semibold">{fileName}</span>
            {rows.length > 0 && (
              <>
                {' '}
                · {rows.length} row(s) · {validRows.length} valid
              </>
            )}
          </p>
        )}

        {parseError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-parchment-200 overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-parchment-50 border-b border-parchment-200">
                  <tr>
                    <th className="px-3 py-2 font-bold text-ink-600 w-10">#</th>
                    <th className="px-3 py-2 font-bold text-ink-600">Name</th>
                    <th className="px-3 py-2 font-bold text-ink-600 hidden sm:table-cell">Location</th>
                    <th className="px-3 py-2 font-bold text-ink-600 hidden md:table-cell">Type</th>
                    <th className="px-3 py-2 font-bold text-ink-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.index} className="border-b border-parchment-100 last:border-0">
                      <td className="px-3 py-2 text-ink-400">{row.index}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-ink-900">{row.payload?.name || row.raw['name'] || '—'}</div>
                        {row.error && <div className="text-[10px] text-red-600 mt-0.5">{row.error}</div>}
                      </td>
                      <td className="px-3 py-2 text-ink-600 hidden sm:table-cell">
                        {row.payload?.location || '—'}
                      </td>
                      <td className="px-3 py-2 text-ink-600 hidden md:table-cell">
                        {row.payload?.type || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'pending' && (
                          <span className="text-ink-400">Pending</span>
                        )}
                        {row.status === 'uploading' && (
                          <span className="inline-flex items-center gap-1 text-pine-700">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                          </span>
                        )}
                        {row.status === 'success' && (
                          <span className="inline-flex items-center gap-1 text-pine-700 font-semibold">
                            <Check className="w-3 h-3" /> Saved
                          </span>
                        )}
                        {row.status === 'error' && (
                          <span className="text-red-600 font-semibold">Failed</span>
                        )}
                        {row.status === 'skipped' && (
                          <span className="text-amber-600 font-semibold">Skipped</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-ink-500">
              {uploading || finished ? (
                <span>
                  Done: <span className="text-pine-700 font-bold">{doneCount.success}</span> ok ·{' '}
                  <span className="text-red-600 font-bold">{doneCount.error}</span> failed ·{' '}
                  <span className="text-amber-600 font-bold">{doneCount.skipped}</span> skipped
                </span>
              ) : (
                <span>{validRows.length} row(s) ready to upload</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl border border-parchment-300 text-sm font-bold text-ink-700 hover:bg-parchment-50 disabled:opacity-50"
              >
                {finished ? 'Close' : 'Cancel'}
              </button>
              {!finished && (
                <button
                  type="button"
                  onClick={startUpload}
                  disabled={uploading || validRows.length === 0}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload {validRows.length} elephant(s)
                    </>
                  )}
                </button>
              )}
              {finished && doneCount.success > 0 && (
                <button
                  type="button"
                  onClick={onDone}
                  className="px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold"
                >
                  Back to list
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Elephant Add/Edit Form
// -------------------------------------------------------------

function ElephantForm({
  elephant,
  onCancel,
  onSaved,
  onSaveElephant,
}: {
  elephant: Elephant | null;
  onCancel: () => void;
  onSaved: () => void;
  onSaveElephant: AdminPanelProps['onSaveElephant'];
}) {
  const isEdit = !!elephant;
  const [form, setForm] = useState(() => {
    if (!elephant) return { ...EMPTY_ELEPHANT_FORM };
    return {
      name: elephant.name || '',
      sinhalaName: elephant.sinhalaName || '',
      otherNames: (elephant.otherNames || []).join(', '),
      gender: elephant.gender || 'male',
      type: elephant.type || 'elephant',
      dateOfBirth: elephant.dateOfBirth || '',
      age: elephant.age !== undefined ? String(elephant.age) : '',
      dateOfDeath: elephant.dateOfDeath || '',
      location: elephant.location || '',
      organization: elephant.organization || '',
      mahout: elephant.mahout || '',
      tusks: elephant.tusks || '',
      physicalCharacteristics: elephant.physicalCharacteristics || '',
      description: elephant.description || '',
      peraheraParticipation: (elephant.peraheraParticipation || []).join(', '),
      sourcesText: (elephant.sources || []).map((s) => s.title + (s.url ? ` | ${s.url}` : '')).join('\n'),
      verified: elephant.verified ?? true,
      status: elephant.status || 'living',
      isFeatured: !!elephant.isFeatured,
      isLive: !!elephant.isLive,
      liveStreamUrl: elephant.liveStreamUrl || '',
      customBadge: elephant.customBadge || '',
    };
  });

  const [photos, setPhotos] = useState<PhotoSlot[]>(() =>
    elephant?.photos?.length
      ? elephant.photos.map((url, idx) => ({
          url,
          publicId: elephant.cloudinaryPhotos?.[idx]?.publicId || '',
          status: 'ready' as const,
        }))
      : []
  );

  const [profilePhoto, setProfilePhoto] = useState<PhotoSlot | null>(() =>
    elephant?.profilePhoto
      ? { url: elephant.profilePhoto, publicId: '', status: 'ready' as const }
      : null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-calculate age when date of birth (year or full date) is entered
      // Recalculate age when birth, death, or status changes
      if (key === 'dateOfBirth' || key === 'dateOfDeath' || key === 'status') {
        const birth = key === 'dateOfBirth' ? String(value || '') : next.dateOfBirth;
        const status = key === 'status' ? String(value || '') : next.status;
        const death = key === 'dateOfDeath' ? String(value || '') : next.dateOfDeath;
        const end = status === 'memorial' && death.trim() ? death.trim() : null;
        const calculated = calcAgeBetween(String(birth || '').trim(), end);
        if (calculated !== null) {
          next.age = String(calculated);
        }
      }
      return next;
    });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newSlots: PhotoSlot[] = Array.from(files).map(() => ({ url: '', publicId: '', status: 'uploading' }));
    setPhotos((prev) => [...prev, ...newSlots]);
    const startIndex = photos.length;

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const slotIndex = startIndex + i;
        try {
          const compressed = await compressImageFile(file, { maxDimension: 1280, quality: 0.82 });
          const result = await uploadPhotoToCloudinary(compressed);
          setPhotos((prev) => {
            const next = [...prev];
            next[slotIndex] = { url: result.url, publicId: result.publicId, status: 'ready' };
            return next;
          });
        } catch (err) {
          console.error('Photo upload failed:', err);
          setPhotos((prev) => {
            const next = [...prev];
            next[slotIndex] = { ...next[slotIndex], status: 'error' };
            return next;
          });
        }
      })
    );
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    if (form.status === 'memorial' && !form.dateOfDeath.trim()) {
      setError('Date of death is required for memorial elephants.');
      return;
    }
    if (photos.some((p) => p.status === 'uploading') || profilePhoto?.status === 'uploading') {
      setError('Please wait for all photos to finish uploading.');
      return;
    }

    const readyPhotos = photos.filter((p) => p.status === 'ready' && p.url);
    const readyProfilePhoto =
      profilePhoto?.status === 'ready' && profilePhoto.url ? profilePhoto.url.trim() : '';

    const sources: ElephantSource[] = form.sourcesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, url] = line.split('|').map((s) => s.trim());
        return { title: title || line, url: url || undefined };
      });

    const payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(),
      sinhalaName: form.sinhalaName.trim(),
      otherNames: form.otherNames.split(',').map((s) => s.trim()).filter(Boolean),
      gender: form.gender,
      type: form.type,
      dateOfBirth: form.dateOfBirth.trim(),
      age: (() => {
        const end = form.status === 'memorial' && form.dateOfDeath.trim()
          ? form.dateOfDeath.trim()
          : null;
        const calculated = calcAgeBetween(form.dateOfBirth.trim(), end);
        if (calculated !== null) return String(calculated);
        return form.age.trim();
      })(),
      dateOfDeath: form.status === 'memorial' ? form.dateOfDeath.trim() : '',
      location: form.location.trim(),
      organization: form.organization.trim(),
      mahout: form.mahout.trim(),
      tusks: form.tusks.trim(),
      physicalCharacteristics: form.physicalCharacteristics.trim(),
      description: form.description.trim(),
      peraheraParticipation: form.peraheraParticipation.split(',').map((s) => s.trim()).filter(Boolean),
      photos: readyPhotos.map((p) => p.url),
      profilePhoto: readyProfilePhoto,
      cloudinaryPhotos: readyPhotos.map((p) => ({ url: p.url, publicId: p.publicId })),
      sources,
      verified: form.verified,
      status: form.status,
      isFeatured: form.isFeatured,
      isLive: form.isLive,
      liveStreamUrl: form.liveStreamUrl.trim(),
      customBadge: form.customBadge.trim(),
      followerCount: elephant?.followerCount || 0,
    };

    setSaving(true);
    try {
      await onSaveElephant(payload, elephant?.id);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn pb-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-xl bg-white border border-parchment-200 flex items-center justify-center text-ink-600 hover:bg-parchment-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-lg font-bold text-ink-950">{isEdit ? `Edit ${elephant!.name}` : 'Add New Elephant'}</h1>
          <p className="text-xs text-ink-500">{isEdit ? 'Update this record in the registry.' : 'Create a new record in the registry.'}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile picture (feed avatar) */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink-950">Profile picture</h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Shown as the elephant avatar in the feed header and story tray. Not replaced by the latest community post.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-parchment-100 border-2 border-parchment-200 shrink-0">
            {profilePhoto?.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {profilePhoto?.url ? (
              <img src={profilePhoto.url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-300 text-[10px] font-bold text-center px-2">
                No profile pic
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => profilePhotoInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-pine-700 text-white text-xs font-bold hover:bg-pine-800 transition-colors"
              >
                Upload profile pic
              </button>
              {profilePhoto?.url && (
                <button
                  type="button"
                  onClick={() => setProfilePhoto(null)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-parchment-200 text-ink-600 text-xs font-bold hover:bg-parchment-50 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setProfilePhoto({ url: '', publicId: '', status: 'uploading' });
                try {
                  const compressed = await compressImageFile(file, { maxDimension: 800, quality: 0.85 });
                  const result = await uploadPhotoToCloudinary(compressed);
                  setProfilePhoto({ url: result.url, publicId: result.publicId, status: 'ready' });
                  setError(null);
                } catch (err: any) {
                  setProfilePhoto(null);
                  setError(err?.message || 'Profile photo upload failed.');
                }
              }}
            />
            <input
              type="url"
              placeholder="Or paste profile image URL (https://…)"
              className={inputCls}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const url = e.currentTarget.value.trim();
                  if (!url) return;
                  if (!/^https:\/\//i.test(url)) {
                    setError('Profile photo URL must start with https://');
                    return;
                  }
                  setProfilePhoto({ url, publicId: '', status: 'ready' });
                  e.currentTarget.value = '';
                  setError(null);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Gallery Photos */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink-950">Gallery photos</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {photos.map((p, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-parchment-100 border border-parchment-200">
              {p.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {p.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              )}
              {p.url && <img src={p.url} alt="" className="w-full h-full object-cover" />}
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-parchment-300 flex flex-col items-center justify-center gap-1 text-ink-400 hover:text-pine-600 hover:border-pine-400 transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10px] font-bold">Add</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <input
            type="url"
            placeholder="Or paste image URL (https://…)"
            id="admin-photo-url-input"
            className={`${inputCls} flex-1`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const el = e.currentTarget;
                const url = el.value.trim();
                if (!url) return;
                if (!/^https:\/\//i.test(url)) {
                  setError('Photo URL must start with https://');
                  return;
                }
                setPhotos((prev) => [...prev, { url, publicId: '', status: 'ready' as const }]);
                el.value = '';
                setError(null);
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('admin-photo-url-input') as HTMLInputElement | null;
              const url = el?.value.trim() || '';
              if (!url) return;
              if (!/^https:\/\//i.test(url)) {
                setError('Photo URL must start with https://');
                return;
              }
              setPhotos((prev) => [...prev, { url, publicId: '', status: 'ready' as const }]);
              if (el) el.value = '';
              setError(null);
            }}
            className="px-3 py-2 rounded-xl bg-pine-800 text-parchment-50 text-xs font-bold hover:bg-pine-900 shrink-0"
          >
            Add URL
          </button>
        </div>
        <p className="text-[10.5px] text-ink-500">Upload files (Cloudinary) or paste an https image URL.</p>
      </div>

      {/* Live stream */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink-950 flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500" />
          Live stream
        </h3>
        <label className="flex items-center gap-2 text-sm text-ink-800 cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.isLive}
            onChange={(e) => setField('isLive', e.target.checked)}
            className="rounded border-parchment-300"
          />
          <span className="font-semibold">Mark as LIVE now</span>
        </label>
        <Field label="Stream URL (YouTube / Facebook / Twitch / m3u8 / embed)">
          <input
            className={inputCls}
            value={form.liveStreamUrl}
            onChange={(e) => setField('liveStreamUrl', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://…/stream.m3u8"
          />
        </Field>
        <p className="text-[10.5px] text-ink-500">
          When LIVE is on and a URL is set, the elephant profile shows an embedded live player.
        </p>
      </div>

      {/* Core identity */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" required>
            <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Indiraja" />
          </Field>
          <Field label="Sinhala Name">
            <input className={`${inputCls} font-sinhala`} value={form.sinhalaName} onChange={(e) => setField('sinhalaName', e.target.value)} placeholder="e.g. ඉන්දිරාජා" />
          </Field>
          <Field label="Other Names (comma separated)">
            <input className={inputCls} value={form.otherNames} onChange={(e) => setField('otherNames', e.target.value)} />
          </Field>
          <Field label="Custom Badge">
            <input className={inputCls} value={form.customBadge} onChange={(e) => setField('customBadge', e.target.value)} placeholder="e.g. National Treasure" />
          </Field>
          <Field label="Gender">
            <select className={inputCls} value={form.gender} onChange={(e) => setField('gender', e.target.value as Gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setField('type', e.target.value as ElephantType)}>
              <option value="elephant">Elephant</option>
              <option value="tusker">Tusker</option>
            </select>
          </Field>
          <Field label="Date of Birth / Year">
            <input
              className={inputCls}
              value={form.dateOfBirth}
              onChange={(e) => setField('dateOfBirth', e.target.value)}
              placeholder="YYYY or YYYY-MM-DD"
            />
            <p className="text-[10px] text-ink-400 mt-1">Year or YYYY-MM-DD. Living: age to today. Memorial: age to date of death.</p>
          </Field>
          <Field label="Age">
            <input
              className={inputCls + (form.dateOfBirth.trim() ? ' bg-ink-50/50 dark:bg-white/5 cursor-default' : '')}
              value={form.age}
              onChange={(e) => {
                if (!form.dateOfBirth.trim()) setField('age', e.target.value);
              }}
              readOnly={!!form.dateOfBirth.trim()}
              placeholder={form.dateOfBirth.trim() ? 'Auto-calculated from birth year' : 'Enter age or set birth year'}
              title={form.dateOfBirth.trim() ? 'Living: age to today. Memorial: age to death date.' : undefined}
            />
            {form.dateOfBirth.trim() && (
              <p className="text-[10px] text-pine-600 mt-1">Auto: living → today · memorial → death date</p>
            )}
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setField('status', e.target.value as 'living' | 'memorial')}>
              <option value="living">Living</option>
              <option value="memorial">Memorial</option>
            </select>
          </Field>
          {form.status === 'memorial' && (
            <Field label="Date of Death" required>
              <input
                className={inputCls}
                value={form.dateOfDeath}
                onChange={(e) => setField('dateOfDeath', e.target.value)}
                placeholder="YYYY-MM-DD or year"
                required
              />
              <p className="text-[10px] text-ink-400 mt-1">Required for memorial elephants.</p>
            </Field>
          )}
        </div>
      </div>

      {/* Location & care */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Location & Care</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Location" required>
            <input className={inputCls} value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="e.g. Kandy" />
          </Field>
          <Field label="Organization">
            <input className={inputCls} value={form.organization} onChange={(e) => setField('organization', e.target.value)} placeholder="e.g. Sri Dalada Maligawa" />
          </Field>
          <Field label="Mahout">
            <input className={inputCls} value={form.mahout} onChange={(e) => setField('mahout', e.target.value)} />
          </Field>
          <Field label="Tusks">
            <input className={inputCls} value={form.tusks} onChange={(e) => setField('tusks', e.target.value)} />
          </Field>
          <Field label="Physical Characteristics">
            <input className={inputCls} value={form.physicalCharacteristics} onChange={(e) => setField('physicalCharacteristics', e.target.value)} />
          </Field>
          <Field label="Perahera Participation (comma separated)">
            <input className={inputCls} value={form.peraheraParticipation} onChange={(e) => setField('peraheraParticipation', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Description & sources */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Description & Sources</h3>
        <Field label="Description" required>
          <textarea
            className={`${inputCls} min-h-[110px] resize-y`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Comprehensive background, sacred history, guardianship…"
          />
        </Field>
        <Field label="Sources (one per line: Title | URL)">
          <textarea
            className={`${inputCls} min-h-[70px] resize-y`}
            value={form.sourcesText}
            onChange={(e) => setField('sourcesText', e.target.value)}
            placeholder={'Department of Wildlife Conservation | https://...'}
          />
        </Field>
      </div>

      {/* Flags */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink-950">Flags</h3>
        <div className="flex flex-wrap gap-2">
          <CheckboxChip label="Verified" checked={form.verified} onChange={(v) => setField('verified', v)} />
          <CheckboxChip label="Featured" checked={form.isFeatured} onChange={(v) => setField('isFeatured', v)} />
          <CheckboxChip label="Live now" checked={form.isLive} onChange={(v) => setField('isLive', v)} />
        </div>
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-parchment-50 py-3 -mx-1 px-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-parchment-200 text-ink-800 text-sm font-bold hover:bg-parchment-300 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-[2] py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Elephant'}
        </button>
      </div>
    </form>
  );
}

function CheckboxChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
        checked ? 'bg-pine-700 text-white border-pine-700' : 'bg-transparent text-ink-500 border-parchment-300'
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

// -------------------------------------------------------------
// Events Tab — full CRUD
// -------------------------------------------------------------

function EventsTab({
  elephants,
  events,
  onSaveEvent,
  onDeleteEvent,
}: {
  elephants: Elephant[];
  events: CulturalEvent[];
  onSaveEvent: AdminPanelProps['onSaveEvent'];
  onDeleteEvent: AdminPanelProps['onDeleteEvent'];
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CulturalEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const editingEvent = editingId && editingId !== 'new' ? events.find((e) => e.id === editingId) || null : null;

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await onDeleteEvent(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  if (editingId) {
    return (
      <EventForm
        event={editingEvent}
        onCancel={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
        onSaveEvent={onSaveEvent}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Events & Notices</h1>
          <p className="text-xs text-ink-500 mt-0.5">{events.length} entr{events.length === 1 ? 'y' : 'ies'} published.</p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No events published yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map((ev) => (
            <div key={ev.id} className="bg-white rounded-2xl border border-parchment-200 p-3.5 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-parchment-200 overflow-hidden shrink-0 flex items-center justify-center text-ink-300">
                {ev.coverImage ? <img src={ev.coverImage} alt="" className="w-full h-full object-cover" /> : <CalendarDays className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-950 truncate flex items-center gap-1.5">
                  {ev.title}
                  {ev.isLive && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-600 text-white shrink-0">
                      <Radio className="w-2.5 h-2.5" /> LIVE
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-ink-500 truncate">
                  {ev.type} · {ev.location || 'No location'} {ev.date ? `· ${ev.date}` : ''}
                </p>
                {!ev.isActive && <span className="text-[10px] font-bold text-ink-400">Inactive</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingId(ev.id!)} className="w-8 h-8 rounded-lg flex items-center justify-center text-pine-700 hover:bg-pine-50 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(ev)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          message="This permanently removes the event notice. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function EventForm({
  event,
  onCancel,
  onSaved,
  onSaveEvent,
}: {
  event: CulturalEvent | null;
  onCancel: () => void;
  onSaved: () => void;
  onSaveEvent: AdminPanelProps['onSaveEvent'];
}) {
  const isEdit = !!event;
  const [form, setForm] = useState(() =>
    event
      ? {
          title: event.title || '',
          sinhalaTitle: event.sinhalaTitle || '',
          description: event.description || '',
          location: event.location || '',
          date: event.date || '',
          type: event.type || 'perahera',
          participatingElephants: (event.participatingElephants || []).join(', '),
          isActive: event.isActive ?? true,
          coverImage: event.coverImage || '',
          isLive: !!event.isLive,
          liveStreamUrl: event.liveStreamUrl || '',
        }
      : { ...EMPTY_EVENT_FORM }
  );
  const [coverStatus, setCoverStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleCoverSelected = async (file: File | null) => {
    if (!file) return;
    setCoverStatus('uploading');
    try {
      const compressed = await compressImageFile(file, { maxDimension: 1280, quality: 0.82 });
      const result = await uploadPhotoToCloudinary(compressed);
      setField('coverImage', result.url);
      setCoverStatus('idle');
    } catch (err) {
      console.error('Cover upload failed:', err);
      setCoverStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }

    const payload: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title: form.title.trim(),
      sinhalaTitle: form.sinhalaTitle.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      date: form.date.trim(),
      type: form.type,
      participatingElephants: form.participatingElephants.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      coverImage: form.coverImage,
      isLive: !!form.isLive,
      liveStreamUrl: form.liveStreamUrl.trim(),
    };

    setSaving(true);
    try {
      await onSaveEvent(payload, event?.id);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn pb-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-xl bg-white border border-parchment-200 flex items-center justify-center text-ink-600 hover:bg-parchment-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-lg font-bold text-ink-950">{isEdit ? 'Edit Event' : 'Add New Event'}</h1>
          <p className="text-xs text-ink-500">Cultural events, ceremonies and notices shown to visitors.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <Field label="Cover Image">
          <div className="flex items-center gap-3">
            <div className="w-20 h-14 rounded-xl bg-parchment-100 overflow-hidden border border-parchment-200 flex items-center justify-center text-ink-300 shrink-0">
              {coverStatus === 'uploading' ? (
                <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
              ) : form.coverImage ? (
                <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-parchment-200 text-ink-800 text-xs font-bold hover:bg-parchment-300 transition-colors"
            >
              {form.coverImage ? 'Replace image' : 'Upload image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverSelected(e.target.files?.[0] || null)} />
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title" required>
            <input className={inputCls} value={form.title} onChange={(e) => setField('title', e.target.value)} />
          </Field>
          <Field label="Sinhala Title">
            <input className={`${inputCls} font-sinhala`} value={form.sinhalaTitle} onChange={(e) => setField('sinhalaTitle', e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setField('type', e.target.value as CulturalEvent['type'])}>
              <option value="perahera">Perahera</option>
              <option value="ceremony">Ceremony</option>
              <option value="conservation">Conservation</option>
              <option value="general">General</option>
              <option value="update">Platform Update</option>
              <option value="alert">Urgent Alert</option>
              <option value="news">News</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date">
            <input className={inputCls} value={form.date} onChange={(e) => setField('date', e.target.value)} placeholder="e.g. 2026-08-30" />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={form.location} onChange={(e) => setField('location', e.target.value)} />
          </Field>
          <Field label="Participating Elephants (comma separated)">
            <input className={inputCls} value={form.participatingElephants} onChange={(e) => setField('participatingElephants', e.target.value)} />
          </Field>
        </div>

        <Field label="Description" required>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.description} onChange={(e) => setField('description', e.target.value)} />
        </Field>

        <CheckboxChip label="Active / Visible to users" checked={form.isActive} onChange={(v) => setField('isActive', v)} />

        {/* Live stream for Perahara / ceremony sessions (not individual elephants) */}
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-600" />
            <span className="text-sm font-bold text-ink-950">Live session (Perahara / ceremony)</span>
          </div>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Mark this event LIVE so it auto-pins at the top of every user’s feed. Use for Perahara and cultural sessions — not for individual elephant profiles.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.isLive}
              onChange={(e) => setField('isLive', e.target.checked)}
              className="rounded border-parchment-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-semibold text-ink-900">Mark as LIVE now</span>
          </label>
          <Field label="Live stream URL (YouTube / Facebook / Twitch / HLS)">
            <input
              className={inputCls}
              value={form.liveStreamUrl}
              onChange={(e) => setField('liveStreamUrl', e.target.value)}
              placeholder="https://youtube.com/watch?v=… or Facebook live link"
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-parchment-50 py-3 -mx-1 px-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-parchment-200 text-ink-800 text-sm font-bold hover:bg-parchment-300 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || coverStatus === 'uploading'}
          className="flex-[2] py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Event'}
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------
// Posts moderation tab
// -------------------------------------------------------------

function PostsTab({ posts }: { posts: ElephantPost[] }) {
  const [deleteTarget, setDeleteTarget] = useState<ElephantPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<ElephantPost | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [liveLikes, setLiveLikes] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = subscribeToPostLikes((map) => {
      const counts: Record<string, number> = {};
      for (const [id, v] of Object.entries(map)) {
        counts[id] = v.likesCount ?? 0;
      }
      setLiveLikes(counts);
    });
    return () => unsub();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteElephantPost(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete post: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (post: ElephantPost) => {
    setEditTarget(post);
    setEditCaption(post.caption || '');
  };

  const handleSaveEdit = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      await updateElephantPost(editTarget.id, { caption: editCaption }, { isAdmin: true });
      setEditTarget(null);
    } catch (err: any) {
      alert(`Failed to update post: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-950">Community Posts</h1>
        <p className="text-xs text-ink-500 mt-0.5">{posts.length} post(s) submitted by the community.</p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No community posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((post) => {
            const likes =
              (post.id && liveLikes[post.id] !== undefined
                ? liveLikes[post.id]
                : post.likesCount) || 0;
            return (
              <div key={post.id} className="bg-white rounded-2xl border border-parchment-200 overflow-hidden group relative">
                <div className="aspect-square bg-parchment-100">
                  <img src={post.photoUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-bold text-ink-950 truncate">
                    {post.elephantName && !/^unknown\s+elephant$/i.test(String(post.elephantName).trim())
                      ? post.elephantName
                      : post.authorName || 'Community'}
                  </p>
                  <p className="text-[10.5px] text-ink-500 truncate">by {post.authorName}</p>
                  {post.caption ? (
                    <p className="text-[10px] text-ink-400 line-clamp-2 mt-0.5">{post.caption}</p>
                  ) : null}
                  <div className="flex items-center gap-1 mt-1 text-[10.5px] text-ink-600 font-semibold">
                    <Heart className="w-3 h-3 text-red-500" /> {likes}
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    title="Edit caption"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(post)}
                    className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this post?"
          message="This permanently removes the post and its photo from the feed. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {editTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-display text-lg font-bold text-ink-950">Edit post caption</h3>
            <p className="text-[11px] text-ink-500 truncate">by {editTarget.authorName}</p>
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-parchment-300 px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-pine-500"
              placeholder="Caption..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-ink-600 hover:bg-parchment-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-pine-700 text-white hover:bg-pine-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Users tab
// -------------------------------------------------------------

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewUser, setViewUser] = useState<UserProfile | null>(null);
  const [suspendBusyId, setSuspendBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.uid || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUserAccount(deleteTarget.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid));
      if (viewUser?.uid === deleteTarget.uid) setViewUser(null);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete user: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSuspend = async (u: UserProfile) => {
    setSuspendBusyId(u.uid);
    try {
      const next = !u.suspended;
      await setUserSuspended(u.uid, next);
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, suspended: next } : x)));
      if (viewUser?.uid === u.uid) setViewUser({ ...u, suspended: next });
    } catch (err: any) {
      alert(`Failed to update suspend status: ${err?.message || err}`);
    } finally {
      setSuspendBusyId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Users</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {users.length} registered · {users.filter((u) => u.suspended).length} suspended
          </p>
        </div>
        <button onClick={load} className="text-xs font-bold text-pine-700 hover:underline">
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, username or UID…"
          className={`${inputCls} pl-9`}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-ink-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No registered users yet.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map((u) => (
            <div
              key={u.uid}
              className={`bg-white rounded-2xl border p-3.5 flex items-center gap-3 ${
                u.suspended ? 'border-red-200 bg-red-50/40' : 'border-parchment-200'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-parchment-200 overflow-hidden shrink-0">
                {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold text-ink-950 truncate">{u.displayName}</p>
                  {u.suspended && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ink-500 truncate">{u.email || u.username}</p>
              </div>
              <p className="text-[11px] text-ink-500 shrink-0 hidden sm:block">
                {u.followedElephants?.length || 0} following
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setViewUser(u)}
                  title="View user"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-pine-700 hover:bg-pine-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleSuspend(u)}
                  disabled={suspendBusyId === u.uid}
                  title={u.suspended ? 'Unsuspend user' : 'Suspend user'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                    u.suspended
                      ? 'text-amber-700 hover:bg-amber-50'
                      : 'text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  {suspendBusyId === u.uid ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setDeleteTarget(u)}
                  title="Delete user"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" onClick={() => setViewUser(null)}>
          <div
            className="bg-parchment-50 rounded-2xl max-w-md w-full border border-parchment-300 shadow-2xl p-5 space-y-4 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-full bg-parchment-200 overflow-hidden shrink-0">
                  {viewUser.photoURL ? (
                    <img src={viewUser.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-300">
                      <UserRound className="w-7 h-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-ink-950 truncate">{viewUser.displayName}</h2>
                  <p className="text-xs text-ink-500 truncate">{viewUser.username}</p>
                  {viewUser.suspended && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      Suspended
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewUser(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-parchment-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2 border-b border-parchment-200 pb-2">
                <span className="text-ink-500 text-xs font-bold uppercase">Email</span>
                <span className="text-ink-900 text-xs text-right break-all">{viewUser.email || '—'}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-parchment-200 pb-2">
                <span className="text-ink-500 text-xs font-bold uppercase">UID</span>
                <span className="text-ink-900 text-[10px] font-mono text-right break-all">{viewUser.uid}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-parchment-200 pb-2">
                <span className="text-ink-500 text-xs font-bold uppercase">Following</span>
                <span className="text-ink-900 text-xs">{viewUser.followedElephants?.length || 0} elephants</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-parchment-200 pb-2">
                <span className="text-ink-500 text-xs font-bold uppercase">Bio</span>
                <span className="text-ink-900 text-xs text-right max-w-[60%]">{viewUser.bio || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-500 text-xs font-bold uppercase">Status</span>
                <span className={`text-xs font-bold ${viewUser.suspended ? 'text-red-600' : 'text-pine-700'}`}>
                  {viewUser.suspended ? 'Suspended' : 'Active'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => handleToggleSuspend(viewUser)}
                disabled={suspendBusyId === viewUser.uid}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                  viewUser.suspended
                    ? 'bg-pine-800 text-parchment-50 hover:bg-pine-900'
                    : 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200'
                }`}
              >
                {suspendBusyId === viewUser.uid ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                {viewUser.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
              <button
                onClick={() => {
                  setDeleteTarget(viewUser);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Remove ${deleteTarget.displayName}?`}
          message="This deletes their profile and community posts from the platform. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
