import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { ViewTab } from '../types';
import { ceremonialAudio } from '../utils/audioSynth';
import { 
  Volume2, 
  VolumeX, 
  Globe, 
  ShieldCheck, 
  Layers,
  BookOpen,
  Calendar,
  Image as ImageIcon,
  Flame,
  Scale,
  Menu,
  X,
  Radio,
  CloudLightning,
  Sparkles
} from 'lucide-react';

export const Header: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { 
    activeTab, 
    setActiveTab, 
    isAdmin, 
    compareList, 
    isFirebaseLive,
    firebaseStatus
  } = useRegistry();
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleAmbience = () => {
    const active = ceremonialAudio.toggleAmbience();
    setIsAudioActive(active);
  };

  const navItems: { id: ViewTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'registry', label: t('navDirectory'), icon: <Layers className="w-4 h-4" /> },
    { id: 'memorials', label: t('navMemorials'), icon: <Flame className="w-4 h-4 text-amber-500" /> },
    { id: 'perahera', label: t('navPerahera'), icon: <Calendar className="w-4 h-4 text-blue-500" /> },
    { id: 'gallery', label: t('navGallery'), icon: <ImageIcon className="w-4 h-4 text-emerald-500" /> },
    { id: 'lore', label: t('navLore'), icon: <BookOpen className="w-4 h-4 text-indigo-500" /> },
    { 
      id: 'compare', 
      label: t('navCompare'), 
      icon: <Scale className="w-4 h-4 text-amber-600" />,
      badge: compareList.length > 0 ? `${compareList.length}` : undefined
    }
  ];

  // Close mobile menu on tab switch
  const handleNavClick = (tabId: ViewTab) => {
    setActiveTab(tabId);
    if (tabId === 'admin') {
      window.location.hash = 'admin';
    } else {
      window.location.hash = tabId;
    }
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 border-b border-slate-200 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleNavClick('registry')}
            className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg py-1 cursor-pointer"
            aria-label="AliMedia Home"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-lg sm:text-xl shadow-xs group-hover:bg-amber-700 transition-colors">
              🐘
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-xl sm:text-2xl tracking-tight text-slate-950 group-hover:text-amber-800 transition-colors whitespace-nowrap">
                අලි<span className="text-amber-600">Media</span>
              </span>
            </div>
          </button>

          {/* Realtime Live Indicator */}
          <div 
            title={isFirebaseLive ? 'Realtime Database Connected (aliapp-e5196)' : 'Realtime Sync Active'}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="uppercase tracking-wider">LIVE DB</span>
          </div>
        </div>

        {/* Zone 2: Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer ${
                  isActive
                    ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-extrabold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (Audio, Language, Admin & Mobile Hamburger) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Hewisi Traditional Ambience Rhythm */}
          <button
            onClick={toggleAmbience}
            title={isAudioActive ? t('soundAmbienceOn') : t('soundAmbienceOff')}
            className={`p-2 rounded-lg text-xs border transition-all flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer ${
              isAudioActive
                ? 'bg-amber-600 text-white font-bold border-amber-700 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-950 hover:bg-slate-200/80'
            }`}
            aria-label="Toggle traditional ceremonial hewisi ambience rhythm"
          >
            {isAudioActive ? <Volume2 className="w-4 h-4 animate-pulse text-white" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden xl:inline font-mono font-bold">
              {isAudioActive ? 'HEWISI ON' : 'HEWISI'}
            </span>
          </button>

          {/* Bilingual Language Switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 hover:text-slate-950 hover:bg-slate-200/80 text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
            title="භාෂාව මාරු කරන්න / Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-amber-700" />
            <span>{lang === 'en' ? 'සිංහල' : 'ENG'}</span>
          </button>

          {/* Admin Control Portal */}
          <button
            onClick={() => handleNavClick('admin')}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer ${
              activeTab === 'admin' || isAdmin
                ? 'bg-amber-600 text-white border border-amber-700 shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 border border-slate-200'
            }`}
            title="Authorized Admin & Database Rules Portal (#admin)"
          >
            <ShieldCheck className={`w-4 h-4 ${activeTab === 'admin' || isAdmin ? 'text-white' : 'text-amber-700'}`} />
            <span>{t('navAdmin')}</span>
          </button>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label="Toggle Mobile Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2 shadow-lg animate-in fade-in duration-150">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
            මෙනුව • Navigation
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Admin link inside mobile drawer */}
            <button
              onClick={() => handleNavClick('admin')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer sm:col-span-2 ${
                activeTab === 'admin' || isAdmin
                  ? 'bg-amber-600 text-white border border-amber-700'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>{t('navAdmin')} (#admin)</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Horizontal Quick Tab Scroller (Always accessible for rapid one-thumb switching) */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 bg-slate-50/90 border-t border-slate-200 gap-1.5 scrollbar-none">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className={`px-1 rounded-full text-[9px] font-black ${isActive ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
