import React, { useState } from 'react';
import { Elephant } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { ceremonialAudio } from '../utils/audioSynth';
import { 
  X, 
  ShieldCheck, 
  Heart, 
  Scale, 
  Volume2, 
  Share2, 
  Printer, 
  Calendar, 
  MapPin, 
  Landmark, 
  User, 
  Award, 
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2
} from 'lucide-react';

interface ElephantDetailModalProps {
  elephant: Elephant;
  onClose: () => void;
}

export const ElephantDetailModal: React.FC<ElephantDetailModalProps> = ({ elephant, onClose }) => {
  const { lang, t } = useLanguage();
  const { 
    bookmarks, 
    toggleBookmark, 
    compareList, 
    toggleCompare,
    posts 
  } = useRegistry();

  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const isBookmarked = bookmarks.includes(elephant.id);
  const isCompared = compareList.includes(elephant.id);
  const isMemorial = elephant.status === 'memorial' || !elephant.isLive;

  const photos = (elephant.photos && elephant.photos.length > 0)
    ? elephant.photos
    : ['https://upload.wikimedia.org/wikipedia/commons/4/4e/Nadungamuwa_Raja.jpg'];

  const relatedPosts = posts.filter(
    p => p.elephantId === elephant.id || p.elephantName?.toLowerCase() === elephant.name?.toLowerCase()
  );

  const handleShare = () => {
    const url = `${window.location.origin}/#elephant-${elephant.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const playTrumpet = () => {
    ceremonialAudio.playElephantTrumpet();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl bg-white border border-slate-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐘</span>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-amber-800 font-bold tracking-wider uppercase">
                {t('verifiedRecord')} • ID: {elephant.id.slice(0, 8)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Play Sound */}
            <button
              onClick={playTrumpet}
              title={t('playTrumpet')}
              className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-amber-700 hover:border-amber-400 transition-colors shadow-xs cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Compare Toggle */}
            <button
              onClick={() => toggleCompare(elephant.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs cursor-pointer ${
                isCompared
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-slate-800 hover:text-slate-950 border-slate-300'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{isCompared ? t('compareRemove') : t('compareAdd')}</span>
            </button>

            {/* Bookmark Toggle */}
            <button
              onClick={() => toggleBookmark(elephant.id)}
              className={`p-2 rounded-lg border transition-colors shadow-xs cursor-pointer ${
                isBookmarked
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-white text-slate-700 hover:text-rose-600 border-slate-300'
              }`}
            >
              <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            {/* Share link */}
            <button
              onClick={handleShare}
              title={copied ? "Link Copied!" : t('share')}
              className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-slate-900 transition-colors relative shadow-xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              {copied && (
                <span className="absolute -bottom-8 right-0 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
                  Link Copied!
                </span>
              )}
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              title={t('printProfile')}
              className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors ml-1 shadow-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* Main Visual Showcase & Core Dossier Info */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Gallery Column (5 cols) */}
            <div className="md:col-span-5 space-y-3">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
                <img
                  src={photos[selectedPhotoIdx]}
                  alt={elephant.name}
                  className="w-full h-full object-cover"
                />
                
                {photos.length > 1 && (
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedPhotoIdx(p => (p - 1 + photos.length) % photos.length)}
                      className="p-1 rounded bg-black/60 text-white hover:bg-amber-500 hover:text-slate-950 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono bg-black/60 text-white px-2 py-0.5 rounded">
                      {selectedPhotoIdx + 1} / {photos.length}
                    </span>
                    <button
                      onClick={() => setSelectedPhotoIdx(p => (p + 1) % photos.length)}
                      className="p-1 rounded bg-black/60 text-white hover:bg-amber-500 hover:text-slate-950 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((ph, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={`relative aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                        idx === selectedPhotoIdx
                          ? 'border-amber-600 ring-2 ring-amber-600/40'
                          : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={ph} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dossier Header Info (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {isMemorial ? (
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 shadow-xs">
                    🕊️ {t('statusMemorial')}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs">
                    ● {t('statusLiving')}
                  </span>
                )}

                {elephant.customBadge && (
                  <span className="px-3 py-1 rounded-md text-xs font-extrabold bg-amber-100 text-amber-950 border border-amber-300 uppercase shadow-xs">
                    👑 {elephant.customBadge}
                  </span>
                )}

                {elephant.verified && (
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>{t('verifiedRecord')}</span>
                  </span>
                )}
              </div>

              {/* Elephant Names */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                  {elephant.name}
                </h2>
                {elephant.sinhalaName && (
                  <div className="text-xl font-black text-amber-800 font-sinhala mt-1">
                    {elephant.sinhalaName}
                  </div>
                )}
                {elephant.otherNames && elephant.otherNames.length > 0 && (
                  <div className="text-xs text-slate-600 mt-1.5">
                    <span className="font-bold text-slate-700">විකල්ප නම් (Aliases):</span> {elephant.otherNames.join(', ')}
                  </div>
                )}
              </div>

              {/* Primary Attributes Table */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">{t('custodian')}:</span>
                  <span className="font-bold text-slate-900">{elephant.organization || 'පෞද්ගලික / විහාරස්ථාන'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">{t('location')}:</span>
                  <span className="font-bold text-slate-900">{elephant.location || 'ශ්‍රී ලංකාව (Sri Lanka)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">{t('mahout')}:</span>
                  <span className="font-bold text-slate-900">{elephant.mahout || 'ඇත්ගොව්වන් (Custodians)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">{t('born')}:</span>
                  <span className="font-bold text-slate-900">
                    {elephant.age ? `${elephant.age} ${t('ageYears')}` : elephant.dateOfBirth || 'නොදනී'}
                  </span>
                </div>
              </div>

              {/* Tusk Specifications Box */}
              {elephant.tusks && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('tusks')} (දළ පිහිටීම)</span>
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed">
                    {elephant.tusks}
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* Historical Description & Cultural Importance */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2.5">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-700" />
              <span>ඓතිහාසික පසුබිම හා සාහිත්‍ය සටහන් (Historical Significance)</span>
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line font-normal">
              {elephant.description}
            </p>
          </div>

          {/* Physical & Behavioral Characteristics */}
          {elephant.physicalCharacteristics && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2.5">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>{t('characteristics')} (හස්ති ශරීර ලක්ෂණ හා හැසිරීම්)</span>
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed font-sans font-normal">
                {elephant.physicalCharacteristics}
              </p>
            </div>
          )}

          {/* Perahera Participations */}
          {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span>{t('peraheraRoles')} (පෙරහැර මංගල්‍ය දායකත්වය)</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {elephant.peraheraParticipation.map((pName, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 border border-amber-300 text-amber-950 shadow-xs"
                  >
                    👑 {pName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Official Citations & Sources */}
          {elephant.sources && elephant.sources.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <h5 className="font-bold text-slate-700 uppercase tracking-wider">
                {t('sources')} (මූලාශ්‍ර හා සාක්ෂි)
              </h5>
              <ul className="space-y-1.5 text-slate-600">
                {elephant.sources.map((src, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                    <div>
                      <strong className="text-slate-800">{src.title}</strong> — {src.publisher} ({src.verifiedDate})
                    </div>
                    {src.url && (
                      <a 
                        href={src.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-amber-700 hover:text-amber-900 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span>මූලාශ්‍රය</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Community Sightings Photos */}
          {relatedPosts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                ප්‍රජා ඡායාරූප හා මතක සටහන් ({relatedPosts.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {relatedPosts.map(post => (
                  <div key={post.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                    <img src={post.photoUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                      <p className="text-[11px] text-white font-medium line-clamp-2">{post.caption}</p>
                      <span className="text-[10px] text-amber-300 font-semibold mt-0.5">{post.authorName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span className="font-medium">අලිMedia • ශ්‍රී ලංකා හීලෑ අලි ඇතුන් ලේඛනාගාරය</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
          >
            {t('closeModal')}
          </button>
        </div>

      </div>
    </div>
  );
};
