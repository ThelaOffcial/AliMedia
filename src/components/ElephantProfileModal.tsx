import React, { useState } from 'react';
import { Elephant } from '../types/elephant';
import {
  X,
  ShieldCheck,
  MapPin,
  Building2,
  Calendar,
  User,
  Sparkles,
  Crown,
  ExternalLink,
  Share2,
  Check,
  Maximize2,
  Scroll,
  Award,
  Info,
  Edit
} from 'lucide-react';
import { Language, translations, getElephantProfilePhoto } from '../utils/translations';
import { PhotoLightbox } from './PhotoLightbox';
import { TranslatedText } from './TranslatedText';

interface ElephantProfileModalProps {
  elephant: Elephant | null;
  language: Language;
  onClose: () => void;
  onEdit?: (elephant: Elephant) => void;
  isAdmin?: boolean;
}

export const ElephantProfileModal: React.FC<ElephantProfileModalProps> = ({
  elephant,
  language,
  onClose,
  onEdit,
  isAdmin,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!elephant) return null;

  const t = translations[language];
  const isTusker = elephant.type === 'tusker';
  const photos = (elephant.photos || []).filter((p) => typeof p === 'string' && p.trim().length > 0);
  // Admin-set profile photo is the default display photo; the gallery is only
  // browsed into once the user taps a specific thumbnail (selectedPhotoIndex > 0).
  const currentPhoto = selectedPhotoIndex > 0
    ? (photos[selectedPhotoIndex] || getElephantProfilePhoto(elephant))
    : (getElephantProfilePhoto(elephant) || photos[0] || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80');

  const handleShare = () => {
    if (navigator.clipboard) {
      const url = window.location.href;
      navigator.clipboard.writeText(`${elephant.name} (${elephant.sinhalaName || ''}) - Sri Lankan Domesticated Elephant Profile: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
        {/* Background dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Window */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden z-10 border border-zinc-200 dark:border-zinc-800 my-8">
          {/* Top Floating Control Bar */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(elephant)}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md cursor-pointer border border-white/20"
                title={t.editRecord}
              >
                <Edit className="w-5 h-5 text-amber-300" />
              </button>
            )}
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md cursor-pointer border border-white/20 flex items-center gap-1.5 px-3.5"
              title={t.share}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">{t.copied}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-white" />
                  <span className="text-xs hidden sm:inline">{t.share}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md cursor-pointer border border-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Hero Media Section */}
          <div className="relative w-full bg-zinc-950 aspect-[16/10] sm:aspect-[21/9] max-h-[460px] overflow-hidden group">
            <img
              src={currentPhoto}
              alt={elephant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-black/30" />

            {/* Click to expand lightbox */}
            <button
              onClick={() => setIsLightboxOpen(true)}
              className="absolute bottom-4 right-4 z-10 p-2.5 rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md flex items-center gap-2 text-xs font-medium cursor-pointer transition-all shadow-lg"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Full Screen Photo</span>
            </button>

            {/* Primary Details Header on Hero */}
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-8 right-24 text-white z-10">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide backdrop-blur-md shadow-md ${
                    isTusker
                      ? 'bg-amber-500 text-amber-950 border border-amber-300/60'
                      : 'bg-emerald-600 text-white border border-emerald-400/40'
                  }`}
                >
                  {isTusker ? <Crown className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isTusker ? (language === 'si' ? 'ඇතා (Tusker)' : 'Tusker (ඇතා)') : (language === 'si' ? 'අලියා (Elephant)' : 'Elephant (අලියා)')}
                </span>

                {elephant.verified && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/90 text-white border border-emerald-300/40 backdrop-blur-md shadow-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{language === 'si' ? 'තහවුරු කළ වාර්තාවක්' : 'Verified Domesticated Record'}</span>
                  </span>
                )}

                {elephant.status === 'memorial' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-amber-300 border border-amber-400/50 backdrop-blur-md">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'si' ? 'ජාතික උරුම / සමරු' : 'National Treasure / Memorial'}</span>
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
                {elephant.name}
              </h1>

              {elephant.sinhalaName && (
                <p className="text-xl sm:text-2xl font-semibold text-amber-300/95 font-sinhala drop-shadow-md mt-0.5">
                  {elephant.sinhalaName}
                </p>
              )}

              {elephant.otherNames && elephant.otherNames.length > 0 && (
                <p className="text-xs sm:text-sm text-zinc-300 mt-1">
                  වෙනත් නම් (Aliases): {elephant.otherNames.join(' • ')}
                </p>
              )}
            </div>
          </div>

          {/* Photo Gallery Strip (if multiple photos) */}
          {photos.length > 1 && (
            <div className="bg-zinc-100 dark:bg-zinc-950 px-4 sm:px-8 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 overflow-x-auto">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex-shrink-0">
                {t.photos}:
              </span>
              <div className="flex gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                      selectedPhotoIndex === index
                        ? 'border-amber-500 ring-2 ring-amber-400/40 scale-105 shadow-md'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="p-6 sm:p-8 space-y-8 max-h-[60vh] overflow-y-auto">
            {/* Key Information Matrix (Strictly following "Never invent missing information" rule) */}
            <div>
              <h2 className="text-xs uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-500" />
                <span>මූලික තොරතුරු (Verified Specifications)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Age */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>{t.age}</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {elephant.age ? `${elephant.age} ${t.years}` : <span className="text-zinc-400 font-normal">{t.noInfo}</span>}
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>{t.dateOfBirth}</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {elephant.dateOfBirth && elephant.dateOfBirth.trim() ? (
                      elephant.dateOfBirth
                    ) : (
                      <span className="text-zinc-400 font-normal">{t.noInfo}</span>
                    )}
                  </div>
                </div>

                {/* Gender & Type */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>{t.type} / {t.gender}</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {isTusker ? 'Tusker (ඇතා)' : 'Elephant (අලියා)'} • {elephant.gender === 'male' ? t.male : t.female}
                  </div>
                </div>

                {/* Temple / Organization */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>{t.organization}</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {elephant.organization || <span className="text-zinc-400 font-normal">{t.noInfo}</span>}
                  </div>
                </div>

                {/* Location */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>{t.location}</span>
                  </div>
                  <div className="mt-1.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {elephant.location || <span className="text-zinc-400 font-normal">{t.noInfo}</span>}
                  </div>
                </div>

                {/* Mahout / Keeper (Only verified or תොරතුරු නොමැත) */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 sm:col-span-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <User className="w-4 h-4 text-amber-600" />
                    <span>{t.mahout} (භාරකාර ඇත්ගොව්වා)</span>
                  </div>
                  <div className="mt-1.5 text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {elephant.mahout && elephant.mahout.trim() ? (
                      elephant.mahout
                    ) : (
                      <span className="text-zinc-400 font-normal">{t.noInfo}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tusks & Physical Characteristics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tusks */}
              <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span>{t.tusks} (දළ පිහිටීම)</span>
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {elephant.tusks && elephant.tusks.trim() ? (
                    elephant.tusks
                  ) : (
                    <span className="text-zinc-400">{t.noInfo}</span>
                  )}
                </p>
              </div>

              {/* Physical Characteristics */}
              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>{t.physicalTraits} (ශාරීරික ලක්ෂණ)</span>
                </h3>
                {elephant.physicalCharacteristics && elephant.physicalCharacteristics.trim() ? (
                  <TranslatedText
                    as="p"
                    className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
                    text={elephant.physicalCharacteristics}
                    language={language}
                  />
                ) : (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span className="text-zinc-400">{t.noInfo}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Description & Cultural Story */}
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
                <Scroll className="w-5 h-5 text-amber-600" />
                <span>{t.description}</span>
              </h3>
              {elephant.description && elephant.description.trim() ? (
                <TranslatedText
                  as="p"
                  className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line"
                  text={elephant.description}
                  language={language}
                />
              ) : (
                <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  <span className="text-zinc-400">{t.noInfo}</span>
                </p>
              )}
            </div>

            {/* Perahera / Procession Participation */}
            {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 && (
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>{t.peraheraParticipation}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {elephant.peraheraParticipation.map((perahera, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-300/50 dark:border-amber-800/40"
                    >
                      🎪 {perahera}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Sources & References Section */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t.sources}</span>
              </h3>

              {elephant.sources && elephant.sources.length > 0 ? (
                <div className="space-y-2">
                  {elephant.sources.map((src, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {src.title}
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {src.publisher ? `Publisher: ${src.publisher}` : ''}
                          {src.verifiedDate ? ` • Year: ${src.verifiedDate}` : ''}
                        </div>
                      </div>

                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-medium transition-colors"
                        >
                          <span>Visit Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">
                  {t.noInfo}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      {isLightboxOpen && (
        <PhotoLightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          elephantName={elephant.name}
          onClose={() => setIsLightboxOpen(false)}
          onNext={() => setSelectedPhotoIndex((prev) => (prev + 1) % photos.length)}
          onPrev={() => setSelectedPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)}
        />
      )}
    </>
  );
};
