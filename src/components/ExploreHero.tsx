import React from 'react';
import { Elephant } from '../types/elephant';
import { ShieldCheck, Crown, Sparkles, Building2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface ExploreHeroProps {
  elephants: Elephant[];
  language: Language;
  onSelectCategory: (type: 'all' | 'tusker' | 'elephant' | 'casket-bearers') => void;
  activeCategory: string;
}

export const ExploreHero: React.FC<ExploreHeroProps> = ({
  elephants,
  language,
  onSelectCategory,
  activeCategory,
}) => {
  const t = translations[language];

  const totalCount = elephants.length;
  const tuskersCount = elephants.filter((e) => e.type === 'tusker').length;
  const verifiedCount = elephants.filter((e) => e.verified).length;
  const templesCount = new Set(elephants.map((e) => e.organization).filter(Boolean)).size;

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-950 via-zinc-900 to-zinc-950 text-white p-6 sm:p-10 border border-emerald-800/30 shadow-2xl">
      {/* Background Decorative Graphic */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{language === 'si' ? 'හීලෑ අලි ඇත් නිල තොරතුරු වේදිකාව' : 'Official Domesticated Elephant Registry'}</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            AliMedia <span className="text-amber-400 font-sinhala font-medium text-2xl sm:text-4xl ml-2">අලිමීඩියා</span>
          </h1>
          <p className="mt-2 text-base sm:text-lg text-emerald-100/80 font-medium max-w-2xl leading-relaxed">
            {language === 'si'
              ? 'ශ්‍රී ලංකාවේ පූජනීය විහාරස්ථාන සහ භාරකාරත්වයේ පසුවන හීලෑ අලි සහ ඇතුන් පිළිබඳ නිවැරදි හා තහවුරු කළ තොරතුරු ගවේෂණය කරන්න.'
              : 'Discover verified profiles, cultural heritage, and lineage of Sri Lanka’s revered domesticated elephants and majestic ceremonial tuskers.'}
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{totalCount}</div>
            <div className="text-xs text-zinc-300 font-medium mt-1">{t.statsDomesticated}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-amber-300 flex items-center gap-1.5">
              <span>{tuskersCount}</span>
              <Crown className="w-4 h-4 text-amber-400 inline" />
            </div>
            <div className="text-xs text-zinc-300 font-medium mt-1">{t.statsTuskers}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-emerald-300 flex items-center gap-1.5">
              <span>{templesCount}</span>
              <Building2 className="w-4 h-4 text-emerald-400 inline" />
            </div>
            <div className="text-xs text-zinc-300 font-medium mt-1">{t.statsTemples}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              {totalCount > 0 ? `${Math.round((verifiedCount / totalCount) * 100)}%` : '100%'}
            </div>
            <div className="text-xs text-zinc-300 font-medium mt-1">{t.statsVerified}</div>
          </div>
        </div>

        {/* Quick Discovery Topic Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
            {language === 'si' ? 'ක්ෂණික තේරීම්:' : 'Quick Discovery:'}
          </span>
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-lg ring-2 ring-amber-300/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {language === 'si' ? 'සියලු හීලෑ අලි/ඇත්තු' : 'All Domesticated'}
          </button>
          <button
            onClick={() => onSelectCategory('tusker')}
            className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'tusker'
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-lg ring-2 ring-amber-300/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Crown className="w-3 h-3" />
            <span>{language === 'si' ? 'පූජනීය ඇත්තු (Tuskers)' : 'Revered Tuskers'}</span>
          </button>
          <button
            onClick={() => onSelectCategory('elephant')}
            className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === 'elephant'
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-lg ring-2 ring-amber-300/50'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{language === 'si' ? 'අලි / ඇතින්නියෝ' : 'Elephants & Females'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
