import React from 'react';
import { Elephant } from '../types/elephant';
import { ShieldCheck, MapPin, Building2, Sparkles, Crown, Image as ImageIcon, Calendar } from 'lucide-react';
import { Language, translations, getElephantProfilePhoto } from '../utils/translations';

interface ElephantCardProps {
  elephant: Elephant;
  language: Language;
  onSelect: (elephant: Elephant) => void;
}

export const ElephantCard: React.FC<ElephantCardProps> = ({
  elephant,
  language,
  onSelect,
}) => {
  const t = translations[language];
  const isTusker = elephant.type === 'tusker';
  const coverPhoto =
    (elephant.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) ||
    getElephantProfilePhoto(elephant);

  return (
    <div
      onClick={() => onSelect(elephant)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(elephant);
        }
      }}
      className="group relative bg-white dark:bg-zinc-900/90 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-emerald-950/10 dark:border-zinc-800 hover:border-amber-500/40 cursor-pointer flex flex-col transform hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          src={coverPhoto}
          alt={elephant.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-75 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          {/* Tusker / Elephant badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-md ${
                isTusker
                  ? 'bg-amber-500/90 text-amber-950 border border-amber-300/40'
                  : 'bg-emerald-700/90 text-emerald-50 border border-emerald-500/30'
              }`}
            >
              {isTusker ? <Crown className="w-3.5 h-3.5 text-amber-950" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-200" />}
              {isTusker ? (language === 'si' ? 'ඇතා (Tusker)' : 'Tusker (ඇතා)') : (language === 'si' ? 'අලියා (Elephant)' : 'Elephant (අලියා)')}
            </span>

            {elephant.status === 'memorial' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900/80 text-amber-300 border border-amber-400/30 backdrop-blur-md">
                {language === 'si' ? 'සමරු' : 'Memorial'}
              </span>
            )}
          </div>

          {/* Verified Badge */}
          {elephant.verified && (
            <span
              title="Verified Domesticated Elephant Record"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600/90 text-white border border-emerald-400/40 shadow-sm backdrop-blur-md"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
              <span>{language === 'si' ? 'තහවුරු කළ' : 'Verified'}</span>
            </span>
          )}
        </div>

        {/* Bottom Overlay Info (Floating on Image) */}
        <div className="absolute bottom-3 left-3 right-3 text-white z-10">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
              {elephant.name}
            </h3>
            {elephant.sinhalaName && (
              <span className="text-sm font-medium text-amber-200/90 drop-shadow-sm font-sinhala">
                {elephant.sinhalaName}
              </span>
            )}
          </div>

          {elephant.otherNames && elephant.otherNames.length > 0 && (
            <p className="text-xs text-zinc-300 line-clamp-1 mt-0.5">
              aka {elephant.otherNames.join(', ')}
            </p>
          )}
        </div>

        {/* Photo count indicator */}
        {elephant.photos && elephant.photos.length > 1 && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-white/90 border border-white/10">
            <ImageIcon className="w-3 h-3" />
            <span>{elephant.photos.length}</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
          {/* Organization / Temple */}
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">
              {elephant.organization || t.noInfo}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="line-clamp-1">{elephant.location || t.noInfo}</span>
          </div>

          {/* Age / Date of Birth */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <span>
              {t.age}:{' '}
              <strong className="font-semibold text-zinc-700 dark:text-zinc-200">
                {elephant.age ? `${elephant.age} ${t.years}` : t.noInfo}
              </strong>
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">•</span>
            <span>
              {elephant.gender === 'male' ? t.male : t.female}
            </span>
          </div>

          {/* Tusks brief */}
          {elephant.tusks && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 italic bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-900/40">
              {elephant.tusks}
            </p>
          )}
        </div>

        {/* View Profile Action */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 group-hover:text-amber-600 transition-colors flex items-center gap-1">
            {t.viewProfile} →
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            ID: {elephant.id?.slice(0, 6) || 'VERIFIED'}
          </span>
        </div>
      </div>
    </div>
  );
};
