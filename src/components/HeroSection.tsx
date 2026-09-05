import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { ceremonialAudio } from '../utils/audioSynth';
import { Search, Sparkles, Volume2, ShieldCheck, Heart, Award, Landmark } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { lang, t } = useLanguage();
  const { 
    elephants, 
    peraheras, 
    searchQuery, 
    setSearchQuery, 
    filterStatus, 
    setFilterStatus, 
    filterType, 
    setFilterType,
    bookmarks
  } = useRegistry();

  const livingCount = elephants.filter(e => e.status === 'living' || e.isLive).length;
  const tuskerCount = elephants.filter(e => e.type === 'tusker' || (e.tusks && e.tusks.length > 0)).length;
  const memorialCount = elephants.filter(e => e.status === 'memorial' || !e.isLive).length;
  const totalCount = elephants.length;

  const playTrumpet = () => {
    ceremonialAudio.playElephantTrumpet();
  };

  return (
    <section className="relative w-full overflow-hidden border-b border-slate-200 bg-gradient-to-b from-amber-50/60 via-white to-slate-50 py-10 md:py-14">
      
      {/* Decorative subtle ambient pattern */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-amber-400/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Tagline / National Registry Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold tracking-wide">
            <Landmark className="w-4 h-4 text-amber-700 shrink-0" />
            <span>ශ්‍රී ලංකා හීලෑ අලි ඇතුන් ජාතික ලේඛනාගාරය • National Elephant Registry</span>
          </div>

          <button
            onClick={playTrumpet}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-300 text-slate-800 hover:text-amber-800 hover:border-amber-400 text-xs font-bold transition-all shadow-xs cursor-pointer group"
          >
            <Volume2 className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            <span>{t('playTrumpet')}</span>
          </button>
        </div>

        {/* Headline & Description */}
        <div className="max-w-3xl mb-7">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3.5 leading-tight font-display">
            {t('heroTitle')}
          </h1>
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-sans font-medium">
            {t('heroSubtitle')}
          </p>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-7">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-400 transition-colors">
            <div className="text-2xl md:text-3xl font-black text-amber-700 font-display">
              {totalCount}
            </div>
            <div className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">
              {t('statTotal')}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-400 transition-colors">
            <div className="text-2xl md:text-3xl font-black text-emerald-700 font-display">
              {livingCount}
            </div>
            <div className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">
              {t('statLivingTuskers')}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-400 transition-colors">
            <div className="text-2xl md:text-3xl font-black text-amber-600 font-display">
              {peraheras.length}
            </div>
            <div className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">
              {t('statPageants')}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-purple-400 transition-colors">
            <div className="text-2xl md:text-3xl font-black text-purple-700 font-display">
              {memorialCount}
            </div>
            <div className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wider">
              {t('statMemorials')}
            </div>
          </div>
        </div>

        {/* Search & Quick Filters Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm">
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            
            {/* Filter: All */}
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterType('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filterStatus === 'all' && filterType === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {t('all')}
            </button>

            {/* Filter: Tuskers */}
            <button
              onClick={() => {
                setFilterType(filterType === 'tusker' ? 'all' : 'tusker');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filterType === 'tusker'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              👑 {t('tuskers')}
            </button>

            {/* Filter: Living */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === 'living' ? 'all' : 'living');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filterStatus === 'living'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              🌿 {t('living')}
            </button>

            {/* Filter: Memorials */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === 'memorial' ? 'all' : 'memorial');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filterStatus === 'memorial'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              🕊️ {t('memorial')}
            </button>

            {/* Filter: Bookmarks */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === 'favorites' ? 'all' : 'favorites');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 cursor-pointer ${
                filterStatus === 'favorites'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>{t('bookmarkedOnly')} ({bookmarks.length})</span>
            </button>

            {(searchQuery || filterStatus !== 'all' || filterType !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterType('all');
                }}
                className="ml-auto text-xs font-bold text-amber-700 hover:underline px-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('resetFilters')}
              </button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
};
