import React from 'react';
import { Globe, CircleUser, Moon, Sun, Megaphone, Compass, MessageCircle } from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

export const LOGO_URL = '/icons/alimedia-logo-lockup.png';

interface NavbarProps {
  currentTab: 'home' | 'elephant' | 'notifications' | 'profile' | 'admin' | 'messages';
  onSelectTab: (tab: 'home' | 'elephant' | 'notifications' | 'profile' | 'admin' | 'messages') => void;
  language: Language;
  onToggleLanguage: () => void;
  darkMode: boolean;
  onToggleDarkMode: (e?: React.MouseEvent) => void;
  hasNewNotifications?: boolean;
  /** Unread replies / mentions (Messages page) */
  hasUnreadMessages?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  language,
  onToggleLanguage,
  darkMode,
  onToggleDarkMode,
  hasNewNotifications = false,
  hasUnreadMessages = false,
}) => {
  const t = translations[language];
  const { user, profile } = useAuth();
  const rawPhoto = profile?.photoURL || user?.photoURL;
  const userPhoto = rawPhoto && typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto : null;
  const isLoggedIn = !!(user && !user.isAnonymous) || !!profile;
  const profileLabel = (() => {
    if (!isLoggedIn) return language === 'si' ? 'මගේ Profile' : 'Profile';
    const name = (profile?.displayName || user?.displayName || '').trim();
    if (!name) return language === 'si' ? 'මගේ Profile' : 'Me';
    // Prefer first name; never show generic "Elephant Fan" as-is without trim
    const first = name.split(/\s+/)[0];
    return first || name;
  })();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-24 sm:h-28 flex items-center justify-between">
        {/* Brand Logo - Instagram Style */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center cursor-pointer group active:scale-95 transition-transform"
        >
          <img
            src={LOGO_URL}
            alt="අලි Media"
            referrerPolicy="no-referrer"
            className="h-18 sm:h-22 w-auto object-contain logo-theme-aware"
          />
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1 bg-zinc-100 dark:bg-black p-1 rounded-full border border-zinc-200 dark:border-white/10 shadow-2xs">
          <button
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{language === 'si' ? 'Feed' : 'Feed'}</span>
          </button>
          <button
            onClick={() => onSelectTab('elephant')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'elephant'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <ElephantIcon className="w-3.5 h-3.5" fill={currentTab === 'elephant'} />
            <span>{language === 'si' ? 'අලි නාමාවලිය' : 'Elephants'}</span>
          </button>
          <button
            onClick={() => onSelectTab('notifications' as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer relative ${
              currentTab === 'notifications'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{language === 'si' ? 'නිවේදන' : 'Notices'}</span>
            {hasNewNotifications && currentTab !== 'notifications' && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#062E22] text-white dark:bg-emerald-600 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {userPhoto ? (
              <img src={userPhoto} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
            ) : (
              <CircleUser className="w-3.5 h-3.5" />
            )}
            <span>{profileLabel}</span>
          </button>
        </nav>

        {/* Language, Dark Mode, Messages & Admin Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Messages & mentions — same style as dark mode toggle */}
          <button
            onClick={() => onSelectTab('messages')}
            className={`relative p-2 rounded-full border transition-all duration-300 cursor-pointer shadow-2xs active:scale-90 ${
              currentTab === 'messages'
                ? 'bg-[#062E22] text-white border-[#062E22] dark:bg-emerald-700 dark:border-emerald-700'
                : 'bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border-zinc-200 dark:border-emerald-900/40 text-[#062E22] dark:text-emerald-300'
            }`}
            title={language === 'si' ? 'පණිවිඩ හා mentions' : 'Messages & mentions'}
            aria-label={language === 'si' ? 'පණිවිඩ හා mentions' : 'Messages & mentions'}
          >
            <MessageCircle className="w-4 h-4" />
            {hasUnreadMessages && currentTab !== 'messages' && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-black" />
              </span>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-[#062E22] dark:text-amber-400 transition-all duration-300 cursor-pointer shadow-2xs active:scale-90"
            title={darkMode ? (language === 'si' ? 'Light Mode වෙත මාරුවන්න' : 'Switch to Light Mode') : (language === 'si' ? 'Dark Mode වෙත මාරුවන්න' : 'Switch to Dark Mode')}
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

          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-xs font-bold text-[#062E22] dark:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
            title="Toggle Sinhala / English"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{language === 'si' ? 'සිංහල' : 'English'}</span>
          </button>

        </div>
      </div>
    </header>
  );
};
