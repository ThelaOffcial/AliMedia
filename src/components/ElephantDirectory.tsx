import React, { useState, useMemo } from 'react';
import { Elephant } from '../types/elephant';
import {
  Search,
  ShieldCheck,
  Crown,
  Building2,
  ChevronRight,
  Flame,
  Users,
  Award,
  Sparkles,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName, getElephantProfilePhoto } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

interface ElephantDirectoryProps {
  elephants: Elephant[];
  posts?: any[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onSelectPhoto?: (photoUrl: string) => void;
  onShowNotification?: (msg: string) => void;
}

export const ElephantDirectory: React.FC<ElephantDirectoryProps> = ({
  elephants,
  language,
  onSelectElephant,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tusker' | 'elephant' | 'living' | 'memorial'>('all');

  // -------------------------------------------------------------
  // TOP 3 MOST FOLLOWED ELEPHANTS
  // -------------------------------------------------------------
  const topFollowedElephants = useMemo(() => {
    const scored = elephants.map((el) => {
      const totalFollowers = el.followerCount || 0;
      const isCurrentlyFollowed = el.id ? isFollowing(el.id) : false;
      return {
        elephant: el,
        followers: totalFollowers,
        isFollowed: isCurrentlyFollowed,
      };
    });

    scored.sort((a, b) => b.followers - a.followers);
    return scored.slice(0, 3);
  }, [elephants, isFollowing]);

  // Filtered elephants for directory list
  const filteredElephants = useMemo(() => {
    return elephants.filter((el) => {
      if (activeCategory === 'tusker' && el.type !== 'tusker') return false;
      if (activeCategory === 'elephant' && el.type !== 'elephant') return false;
      if (activeCategory === 'living' && el.status !== 'living') return false;
      if (activeCategory === 'memorial' && el.status !== 'memorial') return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const hay = [
        el.name,
        el.sinhalaName,
        ...(el.otherNames || []),
        el.location,
        el.organization,
        el.mahout,
        el.description,
        ...(el.peraheraParticipation || []),
        el.customBadge,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [elephants, activeCategory, searchTerm]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-4 pb-24 animate-fadeIn">
      {/* Title Header */}
      <div className="pt-2 px-1 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#062E22] dark:text-white tracking-tight">
            {t.elephantDirectoryTitle}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t.registeredElephantsCount}
          </p>
        </div>

        <span className="px-3 py-1 bg-zinc-100 dark:bg-black text-black dark:text-white rounded-full text-xs font-bold border border-zinc-200 dark:border-white/10">
          {filteredElephants.length}
        </span>
      </div>

      {/* ================================================================= */}
      {/* TRENDING SECTION: Top 3 Most Followed Elephants in Story-box size */}
      {/* ================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#062E22] dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
              <Flame className="w-3 h-3 fill-current" />
            </div>
            <h2 className="text-xs font-bold text-[#062E22] dark:text-white uppercase tracking-wider">
              {t.topFollowedTrending}
            </h2>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#062E22] dark:bg-black text-white border border-transparent dark:border-white/10">
            Top #1 - #3
          </span>
        </div>

        {/* 3 Compact Story-Sized Boxes */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {topFollowedElephants.map((item, index) => {
            const el = item.elephant;
            const rank = index + 1;
            const photo = getElephantProfilePhoto(el);
            const formattedFollowers = item.followers >= 1000 ? `${(item.followers / 1000).toFixed(1)}K` : `${item.followers}`;
            const bilingualName = formatBilingualElephantName(el, language);

            return (
              <div
                key={el.id || index}
                onClick={() => onSelectElephant(el)}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs cursor-pointer group border-2 transition-all transform hover:scale-[1.02] bg-black border-zinc-200 dark:border-white/15 hover:border-[#062E22] dark:hover:border-white"
              >
                <img
                  src={photo}
                  alt={el.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" />

                {/* Top Badge: Rank & Follow status */}
                <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shadow-xs ${
                    rank === 1
                      ? 'bg-white text-black'
                      : rank === 2
                      ? 'bg-zinc-200 text-zinc-900'
                      : 'bg-[#062E22] text-white'
                  }`}>
                    {rank === 1 ? <Crown className="w-2.5 h-2.5 fill-current" /> : <Award className="w-2.5 h-2.5" />}
                    <span>#{rank}</span>
                  </span>

                  {/* Follow / Unfollow Mini Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (el.id) toggleFollowElephant(el.id);
                    }}
                    title={item.isFollowed ? t.following : t.follow}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-md ${
                      item.isFollowed
                        ? 'bg-white text-black'
                        : 'bg-black/60 text-white hover:bg-[#062E22] backdrop-blur-xs'
                    }`}
                  >
                    {item.isFollowed ? (
                      <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <UserPlus className="w-3 h-3 stroke-[2.5]" />
                    )}
                  </button>
                </div>

                {/* Bottom Details: Follower count & Elephant Bilingual Name */}
                <div className="absolute bottom-2 left-2 right-2 text-white space-y-0.5">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-300 drop-shadow">
                    <Users className="w-2.5 h-2.5 text-white" />
                    <span>{formattedFollowers} {t.followers}</span>
                  </div>

                  <h3 className="text-xs font-bold truncate drop-shadow leading-tight" title={bilingualName}>
                    {el.name}
                  </h3>

                  {el.sinhalaName && (
                    <p className="text-[10px] font-medium text-zinc-300 truncate font-sinhala leading-tight">
                      {el.sinhalaName}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative pt-1">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-[#062E22] dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#062E22] dark:focus:ring-white shadow-xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Filter Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: t.all },
          { id: 'tusker', label: t.tuskers },
          { id: 'elephant', label: t.elephants },
          { id: 'living', label: t.living },
          { id: 'memorial', label: t.memorial },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#062E22] text-white shadow-xs'
                : 'bg-white dark:bg-black text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Elephant Profile Cards List */}
      <div className="space-y-3.5">
        {filteredElephants.length === 0 ? (
          <div className="bg-white dark:bg-black rounded-3xl p-8 text-center border border-zinc-200 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {t.noProfilesFound}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveCategory('all');
              }}
              className="mt-3 text-xs text-[#062E22] dark:text-white font-bold hover:underline cursor-pointer"
            >
              {t.resetFilters}
            </button>
          </div>
        ) : (
          filteredElephants.map((elephant) => {
            const isTusker = elephant.type === 'tusker';
            const photo = getElephantProfilePhoto(elephant);
            const bilingualName = formatBilingualElephantName(elephant, language);

            return (
              <div
                key={elephant.id}
                className="bg-white dark:bg-black rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md border border-zinc-200 dark:border-white/10 transition-all flex items-center justify-between gap-3 group"
              >
                {/* Left side: Avatar + Bilingual Details */}
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                >
                  {/* Circular Image with Status Indicator */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-[#062E22] ring-2 ring-[#062E22]/50 dark:ring-white/20">
                      <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <img
                          src={photo}
                          alt={elephant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                    {isTusker ? (
                      <div className="absolute -bottom-1 -right-0.5 bg-black dark:bg-white text-white dark:text-black p-1 rounded-full shadow border border-white dark:border-zinc-900">
                        <Crown className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="absolute -bottom-1 -right-0.5 bg-[#062E22] dark:bg-white text-white dark:text-black p-1 rounded-full shadow border border-white dark:border-zinc-900">
                        <Sparkles className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Information with Both Names */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-[#062E22] dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {bilingualName}
                      </h3>
                      {elephant.verified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#062E22] dark:text-white fill-emerald-600/20 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#062E22] dark:text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#062E22] text-white"
                      >
                        {isTusker ? t.tusker : t.elephant}
                      </span>
                      {elephant.age && (
                        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                          {elephant.age} {t.years}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Prominent VIEW BUTTON */}
                <button
                  onClick={() => onSelectElephant(elephant)}
                  className="flex-shrink-0 px-3.5 py-2 bg-[#062E22] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t.view}</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
