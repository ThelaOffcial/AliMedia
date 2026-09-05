import React, { useState, useMemo } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Building2,
  Calendar,
  User,
  Crown,
  Sparkles,
  Share2,
  Bookmark,
  ExternalLink,
  Plus,
  Heart,
  Grid,
  Info,
  Maximize2,
  Flame,
  Award,
  Scroll,
  UserCheck,
  UserPlus,
  Radio
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName, getElephantPrimarySecondaryNames, getElephantProfilePhoto } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { TranslatedText } from './TranslatedText';

interface ElephantProfileScreenProps {
  elephant: Elephant;
  communityPosts?: ElephantPost[];
  language: Language;
  onBack: () => void;
  onSelectPhoto: (photoUrl: string) => void;
  onOpenCreatePost: (elephantId?: string) => void;
}


function toEmbedStreamUrl(raw?: string): { type: 'iframe' | 'video'; src: string } | null {
  if (!raw || !raw.trim()) return null;
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return null;

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (yt) {
    // Cleaner player: no related videos, no annotations, modest branding.
    // YouTube always keeps a small logo — full removal is blocked by their terms.
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '0',
      rel: '0',
      modestbranding: '1',
      controls: '1',
      iv_load_policy: '3',
      fs: '1',
      playsinline: '1',
      cc_load_policy: '0',
      color: 'white',
    });
    return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?${params.toString()}` };
  }
  const twitch = url.match(/twitch\.tv\/([A-Za-z0-9_]+)/i);
  if (twitch && !url.includes('/videos/')) {
    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return {
      type: 'iframe',
      src: `https://player.twitch.tv/?channel=${twitch[1]}&parent=${parent}&autoplay=true&muted=false`,
    };
  }
  if (/facebook\.com\//i.test(url) || /fb\.watch/i.test(url)) {
    return {
      type: 'iframe',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&autoplay=1`,
    };
  }
  if (/\.m3u8(\?|$)/i.test(url) || /\.(mp4|webm)(\?|$)/i.test(url)) {
    return { type: 'video', src: url };
  }
  return { type: 'iframe', src: url };
}

export const ElephantProfileScreen: React.FC<ElephantProfileScreenProps> = ({
  elephant,
  communityPosts = [],
  language,
  onBack,
  onSelectPhoto,
  onOpenCreatePost,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [activeTab, setActiveTab] = useState<'gallery' | 'details' | 'physical' | 'cultural'>('gallery');

  const following = elephant.id ? isFollowing(elephant.id) : false;
  const isTusker = elephant.type === 'tusker';
  const isMemorial = elephant.status === 'memorial';

  // Specific community photos uploaded for this elephant
  const elephantCommunityPosts = useMemo(() => {
    return communityPosts.filter((p) => p.elephantId === elephant.id || p.elephantName === elephant.name);
  }, [communityPosts, elephant]);

  const allPhotos = useMemo(() => {
    const registryPhotos = (elephant.photos || []).filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    const communityPhotos = elephantCommunityPosts.map((p) => p.photoUrl).filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    const combined = Array.from(new Set([...registryPhotos, ...communityPhotos]));
    return combined.length > 0 ? combined : ['https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80'];
  }, [elephant, elephantCommunityPosts]);

  // Admin-set profile photo always wins as the cover/hero image.
  // Only fall back to a community/registry photo if no profile photo has been set.
  const heroPhoto = (elephant.profilePhoto && elephant.profilePhoto.trim().length > 0)
    ? elephant.profilePhoto
    : (allPhotos[0] || getElephantProfilePhoto(elephant));

  // Base followers
  const followerCount = elephant.followerCount || 0;

  const handleShare = async () => {
    const { shareRegistryCard } = await import('../utils/registryCard');
    await shareRegistryCard(elephant, {
      language,
      notify: (msg) => alert(msg),
    });
  };

  const { primary, secondary } = getElephantPrimarySecondaryNames(elephant, language);

  const stream = elephant.isLive ? toEmbedStreamUrl(elephant.liveStreamUrl) : null;

  return (
    <div className="max-w-lg mx-auto w-full pb-28 animate-fadeIn">
      {elephant.isLive && (
        <div className="mb-3 rounded-2xl overflow-hidden border border-red-500/40 bg-black shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 bg-red-600 text-white text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {language === 'si' ? 'සජීවී විකාශනය' : 'LIVE NOW'}
              {primary ? ` · ${primary}` : ''}
            </span>
            {elephant.liveStreamUrl ? (
              <a
                href={elephant.liveStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 opacity-90 hover:opacity-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {language === 'si' ? 'විවෘත කරන්න' : 'Open'}
              </a>
            ) : null}
          </div>
          {stream ? (
            stream.type === 'video' ? (
              <video src={stream.src} controls autoPlay playsInline className="w-full aspect-video bg-black" />
            ) : (
              <iframe
                src={stream.src}
                title="Live stream"
                className="w-full aspect-video bg-black"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )
          ) : (
            <div className="px-4 py-8 text-center text-sm text-white/80">
              {language === 'si'
                ? 'සජීවී බැජ් එක සක්‍රියයි. Stream URL එකක් Admin හි එක් කරන්න.'
                : 'Live badge is on. Add a stream URL in Admin to embed the player here.'}
            </div>
          )}
        </div>
      )}
      {/* Top Floating Control Bar */}
      <div className="sticky top-14 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-md py-2 px-1 flex items-center justify-between border-b border-zinc-200 dark:border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-black text-[#062E22] dark:text-white text-xs font-bold border border-zinc-200 dark:border-white/15 shadow-2xs hover:bg-zinc-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToDirectory}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white dark:bg-black text-zinc-700 dark:text-white hover:text-[#062E22] border border-zinc-200 dark:border-white/15 shadow-2xs cursor-pointer"
            title={t.share}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => elephant.id && toggleFollowElephant(elephant.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              following
                ? 'bg-white text-black border border-zinc-300 dark:border-white/30 hover:bg-zinc-100'
                : 'bg-[#062E22] text-white hover:bg-emerald-900'
            }`}
          >
            {following ? (
              <>
                <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.following}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ {t.follow}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white dark:bg-black rounded-3xl p-4 sm:p-5 border border-zinc-200 dark:border-white/10 shadow-2xs space-y-4 relative mt-2">
        {/* Cover Photo */}
        <div
          onClick={() => onSelectPhoto(heroPhoto)}
          className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-black cursor-pointer group shadow-inner"
        >
          <img
            src={heroPhoto}
            alt={elephant.name}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Badges on Hero */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md backdrop-blur-md bg-[#062E22] text-white"
              >
                {isTusker ? t.tusker : t.elephant}
              </span>

              {isMemorial && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/90 text-white border border-white/10">
                  {t.memorial}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {elephant.verified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#062E22]/90 text-white shadow-md backdrop-blur-md">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{t.verified}</span>
                </span>
              )}
              <span className="p-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Title on Hero Bottom */}
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h1 className="text-2xl sm:text-3xl font-bold drop-shadow-md tracking-tight leading-tight">
              {primary}
            </h1>
            {secondary && (
              <p className="text-base sm:text-lg font-bold text-zinc-300 drop-shadow mt-0.5 font-sinhala">
                ({secondary})
              </p>
            )}
          </div>
        </div>

        {/* Stats Row: Followers, Posts, Photos */}
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-100 dark:border-white/10 text-center">
          <div>
            <div className="text-sm sm:text-base font-bold text-[#062E22] dark:text-white">
              {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}K` : followerCount}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.followers}
            </div>
          </div>

          <div className="border-x border-zinc-100 dark:border-white/10">
            <div className="text-sm sm:text-base font-bold text-[#062E22] dark:text-white">
              {allPhotos.length}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.photos}
            </div>
          </div>

          <div>
            <div className="text-sm sm:text-base font-bold text-[#062E22] dark:text-white">
              {elephant.category === 'temple' ? (language === 'si' ? 'විහාරස්ථ' : 'Temple') : (language === 'si' ? 'හීලෑ' : 'Domestic')}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.status}
            </div>
          </div>
        </div>

        {/* Location & Organization Quick Matrix */}
        <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-[#062E22] dark:text-white shrink-0 mt-0.5" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {elephant.organization || (language === 'si' ? 'විහාරස්ථානය / සංවිධානය සටහන්ව නැත' : 'Temple / Owner not specified')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#062E22] dark:text-white shrink-0" />
            <span>{elephant.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
          </div>

          {elephant.mahout && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#062E22] dark:text-white shrink-0" />
              <span>{t.mahout}: <strong className="text-zinc-800 dark:text-zinc-200">{elephant.mahout}</strong></span>
            </div>
          )}
        </div>

        {/* Add Photo Button Action */}
        <button
          onClick={() => onOpenCreatePost(elephant.id)}
          className="w-full py-2.5 px-4 rounded-2xl bg-[#062E22] hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t.addPhotoStory}</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-zinc-200 dark:border-white/10 mt-4 bg-white dark:bg-black rounded-2xl p-1 shadow-2xs">
        {[
          { id: 'gallery', label: `${t.photoGallery} (${allPhotos.length})`, icon: Grid },
          { id: 'details', label: t.verifiedData, icon: Info },
          { id: 'physical', label: t.physicalTraits, icon: Sparkles },
          { id: 'cultural', label: t.culturalHeritage, icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#062E22] text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Photo Gallery Grid (Primary View) */}
      {activeTab === 'gallery' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allPhotos.map((photo, idx) => (
              <div
                key={idx}
                onClick={() => onSelectPhoto(photo)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer group shadow-2xs"
              >
                <img
                  src={photo}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
            ))}
          </div>

          {/* Add more photos button */}
          <button
            onClick={() => onOpenCreatePost(elephant.id)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-700 dark:hover:border-emerald-500 bg-white dark:bg-[#121F1B] text-xs font-bold text-[#062E22] dark:text-emerald-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addPhotoStory}</span>
          </button>
        </div>
      )}

      {/* Tab 2: Verified Details */}
      {activeTab === 'details' && (
        <div className="mt-3 bg-white dark:bg-[#121F1B] rounded-3xl p-5 border border-zinc-200 dark:border-emerald-950/70 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase text-[#062E22] dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{t.basicInfo}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/70 dark:border-emerald-950/50">
              <span className="text-zinc-400 dark:text-zinc-400 font-bold block text-[10px] uppercase">{t.age}</span>
              <span className="font-extrabold text-[#062E22] dark:text-emerald-100 text-sm">
                {elephant.age ? `${elephant.age} ${t.years}` : t.noInfo}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/70 dark:border-emerald-950/50">
              <span className="text-zinc-400 dark:text-zinc-400 font-bold block text-[10px] uppercase">{t.gender}</span>
              <span className="font-extrabold text-[#062E22] dark:text-emerald-100 text-sm">
                {elephant.gender === 'male' ? t.male : t.female}
              </span>
            </div>

            {isMemorial && elephant.dateOfDeath && (
              <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/70 dark:border-emerald-950/50 col-span-2">
                <span className="text-zinc-400 dark:text-zinc-400 font-bold block text-[10px] uppercase">
                  {language === 'si' ? 'මරණ දිනය' : 'Date of Death'}
                </span>
                <span className="font-extrabold text-[#062E22] dark:text-emerald-100 text-sm">
                  {elephant.dateOfDeath}
                </span>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/70 dark:border-emerald-950/50 col-span-2">
              <span className="text-zinc-400 dark:text-zinc-400 font-bold block text-[10px] uppercase">{t.organization}</span>
              <span className="font-extrabold text-[#062E22] dark:text-emerald-100 text-sm">
                {elephant.organization || t.noInfo}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/70 dark:border-emerald-950/50 col-span-2">
              <span className="text-zinc-400 dark:text-zinc-400 font-bold block text-[10px] uppercase">{t.mahout}</span>
              <span className="font-extrabold text-[#062E22] dark:text-emerald-100 text-sm">
                {elephant.mahout || t.noInfo}
              </span>
            </div>
          </div>

          {/* Description — follows UI language */}
          {elephant.description && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-xs font-bold text-[#062E22] dark:text-emerald-200">{t.description}</h4>
              <TranslatedText
                as="p"
                className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line"
                text={elephant.description}
                language={language}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Physical Traits & Tusks */}
      {activeTab === 'physical' && (
        <div className="mt-3 bg-white dark:bg-[#121F1B] rounded-3xl p-5 border border-zinc-200 dark:border-emerald-950/70 shadow-2xs space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-[#062E22] dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.tusks}</span>
            </h3>
            {elephant.tusks ? (
              <TranslatedText
                as="p"
                className="text-xs text-zinc-700 dark:text-zinc-200 bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 leading-relaxed"
                text={elephant.tusks}
                language={language}
              />
            ) : (
              <p className="text-xs text-zinc-700 dark:text-zinc-200 bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 leading-relaxed">
                {language === 'si' ? 'දළ පිහිටීම පිළිබඳ සටහනක් නොමැත.' : 'No specific tusk description available.'}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-black uppercase text-[#062E22] dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.physicalTraits}</span>
            </h3>
            {elephant.physicalCharacteristics ? (
              <TranslatedText
                as="p"
                className="text-xs text-zinc-700 dark:text-zinc-200 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 leading-relaxed"
                text={elephant.physicalCharacteristics}
                language={language}
              />
            ) : (
              <p className="text-xs text-zinc-700 dark:text-zinc-200 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 leading-relaxed">
                {language === 'si' ? 'ශාරීරික ලක්ෂණ සටහන්ව නැත.' : 'No physical characteristics specified.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Cultural Heritage & Perahera */}
      {activeTab === 'cultural' && (
        <div className="mt-3 bg-white dark:bg-[#121F1B] rounded-3xl p-5 border border-zinc-200 dark:border-emerald-950/70 shadow-2xs space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-[#062E22] dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.peraheraParticipation}</span>
            </h3>
            {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {elephant.peraheraParticipation.map((perahera, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40"
                  >
                    🎪 {perahera}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                {language === 'si' ? 'පෙරහැර සහභාගීත්ව වාර්තා සටහන්ව නැත.' : 'No recorded perahera festivals yet.'}
              </p>
            )}
          </div>

          {/* Sources & References */}
          <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-black uppercase text-[#062E22] dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{t.sources}</span>
            </h3>
            {elephant.sources && elephant.sources.length > 0 ? (
              <div className="space-y-2">
                {elephant.sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-[#FAF9F5] dark:bg-[#1A2C26] border border-zinc-200/80 dark:border-emerald-950/60 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#062E22] dark:text-emerald-100 truncate">{src.title}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-400">{src.publisher} {src.verifiedDate ? `(${src.verifiedDate})` : ''}</p>
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-[10px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                {language === 'si' ? 'සත්‍යාපිත මූලාශ්‍ර වාර්තාවල අඩංගුයි.' : 'Verified through national Sri Lankan cultural records.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
