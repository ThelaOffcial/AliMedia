import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Elephant } from '../types/elephant';
import {
  X,
  Heart,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserPlus,
  Crown,
  ExternalLink,
  User,
  Pause
} from 'lucide-react';
import { Language, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { ElephantHeartPop } from './ElephantHeartPop';
import { toggleLikeElephantPost, formatRelativeTime } from '../firebase/postService';
import { preloadImage } from '../utils/imageCompressor';

export interface StoryItem {
  id: string;
  elephantId: string;
  elephantName: string;
  elephantSinhalaName?: string;
  photoUrl: string;
  caption?: string;
  authorName?: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  createdAt?: any;
  linkedElephant?: Elephant;
  isFollowed?: boolean;
  isTusker?: boolean;
  likesCount?: number;
}

export interface ElephantStoryGroup {
  elephantId: string;
  elephantName: string;
  elephantSinhalaName?: string;
  avatarPhoto: string;
  coverPhoto: string;
  linkedElephant?: Elephant;
  isTusker?: boolean;
  isFollowed?: boolean;
  isLive?: boolean;
  isViewed?: boolean;
  latestStoryTimestamp?: number;
  stories: StoryItem[];
}

interface StoryViewerModalProps {
  storyGroups?: ElephantStoryGroup[];
  stories?: StoryItem[];
  initialGroupIndex?: number;
  initialSegmentIndex?: number;
  initialIndex?: number;
  language: Language;
  onClose: () => void;
  onSelectElephant: (elephant: Elephant) => void;
  onShowNotification?: (msg: string) => void;
  onMarkStoryViewed?: (elephantId: string) => void;
}

const FALLBACK_STORY_IMAGE =
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1080&q=80';

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  storyGroups,
  stories,
  initialGroupIndex = 0,
  initialSegmentIndex = 0,
  initialIndex = 0,
  language,
  onClose,
  onSelectElephant,
  onShowNotification,
  onMarkStoryViewed,
}) => {
  const { toggleFollowElephant, isFollowing, user } = useAuth();

  // Normalize groups
  const normalizedGroups: ElephantStoryGroup[] = React.useMemo(() => {
    if (storyGroups && storyGroups.length > 0) {
      return storyGroups.filter((g) => g && g.stories && g.stories.length > 0);
    }
    if (stories && stories.length > 0) {
      const map = new Map<string, ElephantStoryGroup>();
      stories.forEach((st) => {
        const key = st.elephantId || st.elephantName || 'default';
        if (!map.has(key)) {
          map.set(key, {
            elephantId: st.elephantId || '',
            elephantName:
              st.elephantName && !/^unknown\s+elephant$/i.test(String(st.elephantName).trim())
                ? st.elephantName
                : st.authorName || 'Story',
            elephantSinhalaName: st.elephantSinhalaName,
            avatarPhoto: st.linkedElephant?.photos?.[0] || st.photoUrl || FALLBACK_STORY_IMAGE,
            coverPhoto: st.photoUrl || FALLBACK_STORY_IMAGE,
            linkedElephant: st.linkedElephant,
            isTusker: st.isTusker,
            isFollowed: st.isFollowed,
            stories: [],
          });
        }
        map.get(key)!.stories.push(st);
      });
      return Array.from(map.values());
    }
    return [];
  }, [storyGroups, stories]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState<number>(() => {
    const start = storyGroups ? initialGroupIndex : 0;
    return Math.min(Math.max(0, start), Math.max(0, normalizedGroups.length - 1));
  });

  const [currentSegmentIdx, setCurrentSegmentIdx] = useState<number>(() => {
    return initialSegmentIndex || initialIndex || 0;
  });

  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedStories, setSavedStories] = useState<{ [id: string]: boolean }>({});
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [imgError, setImgError] = useState<{ [id: string]: boolean }>({});
  const [heartAnim, setHeartAnim] = useState<{ show: boolean; pos?: { x: number; y: number } }>({ show: false });

  const lastTapRef = useRef<number>(0);
  const holdTimerRef = useRef<any>(null);

  const getEffectiveUid = (): string => {
    if (user?.uid) return user.uid;
    try {
      let saved = localStorage.getItem('alimedia_client_uid');
      if (!saved) {
        saved = 'guest_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('alimedia_client_uid', saved);
      }
      return saved;
    } catch {
      return 'guest_anon';
    }
  };

  const currentGroup = normalizedGroups[currentGroupIdx] || normalizedGroups[0];
  const groupStories = currentGroup?.stories || [];
  const currentStory = groupStories[currentSegmentIdx] || groupStories[0];

  const markedElephantsRef = useRef<Set<string>>(new Set());

  // Mark viewed elephant story safely (once per elephant ID per session)
  useEffect(() => {
    const elId = currentGroup?.elephantId;
    if (elId && !markedElephantsRef.current.has(elId)) {
      markedElephantsRef.current.add(elId);
      if (onMarkStoryViewed) {
        onMarkStoryViewed(elId);
      }
      try {
        const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
        const map = raw ? JSON.parse(raw) : {};
        map[elId] = Date.now();
        localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
      } catch {}
    }
  }, [currentGroup?.elephantId, onMarkStoryViewed]);

  // Preload next upcoming slide and next group cover for 0-latency instant switching
  useEffect(() => {
    if (!currentGroup) return;
    const nextInGroup = groupStories[currentSegmentIdx + 1]?.photoUrl;
    if (nextInGroup) {
      preloadImage(nextInGroup);
    } else {
      const nextGroup = normalizedGroups[currentGroupIdx + 1];
      if (nextGroup?.stories?.[0]?.photoUrl) {
        preloadImage(nextGroup.stories[0].photoUrl);
      }
    }
  }, [currentGroup, currentSegmentIdx, currentGroupIdx, groupStories, normalizedGroups]);

  const triggerHeartAnimation = (pos?: { x: number; y: number }) => {
    setHeartAnim({ show: true, pos });
    setTimeout(() => {
      setHeartAnim({ show: false });
    }, 850);
  };

  // Move to next story segment, next elephant group, or auto-close
  const handleNext = useCallback(() => {
    if (currentSegmentIdx < groupStories.length - 1) {
      setCurrentSegmentIdx((prev) => prev + 1);
    } else {
      if (currentGroupIdx < normalizedGroups.length - 1) {
        setCurrentGroupIdx((prev) => prev + 1);
        setCurrentSegmentIdx(0);
      } else {
        onClose();
      }
    }
  }, [currentSegmentIdx, groupStories.length, currentGroupIdx, normalizedGroups.length, onClose]);

  // Move to previous story segment or previous elephant group
  const handlePrev = useCallback(() => {
    if (currentSegmentIdx > 0) {
      setCurrentSegmentIdx((prev) => prev - 1);
    } else {
      if (currentGroupIdx > 0) {
        const prevGroup = normalizedGroups[currentGroupIdx - 1];
        setCurrentGroupIdx((prev) => prev - 1);
        setCurrentSegmentIdx(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
      }
    }
  }, [currentSegmentIdx, currentGroupIdx, normalizedGroups]);

  // Keyboard navigation & lock scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, onClose]);

  if (!currentGroup || !currentStory) {
    return null;
  }

  const elephantId = currentGroup.elephantId || currentStory.elephantId;
  const followingThisElephant = elephantId ? isFollowing(elephantId) : false;
  const effectiveUid = getEffectiveUid();
  const isLiked = userLiked[currentStory.id] !== undefined
    ? userLiked[currentStory.id]
    : false;
  const likeCount = likes[currentStory.id] !== undefined
    ? likes[currentStory.id]
    : (currentStory.likesCount || 0);
  const isSaved = !!savedStories[currentStory.id];

  const rawPhoto = currentStory.photoUrl || currentGroup.coverPhoto || currentGroup.avatarPhoto;
  const imageSrc = !imgError[currentStory.id] && rawPhoto ? rawPhoto : FALLBACK_STORY_IMAGE;

  const handleLike = async () => {
    const nextLiked = !isLiked;
    setUserLiked((prev) => ({ ...prev, [currentStory.id]: nextLiked }));
    setLikes((lp) => {
      const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : (currentStory.likesCount || 0);
      return { ...lp, [currentStory.id]: nextLiked ? count + 1 : Math.max(0, count - 1) };
    });

    if (nextLiked) {
      triggerHeartAnimation();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(20); } catch {}
      }
    }

    try {
      await toggleLikeElephantPost(currentStory.id, effectiveUid, false);
    } catch (err) {}
  };

  const handleDoubleClickStory = async (e: React.MouseEvent | React.TouchEvent) => {
    let pos: { x: number; y: number } | undefined = undefined;
    if ('clientX' in e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    triggerHeartAnimation(pos);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([30, 20]); } catch {}
    }

    if (!isLiked) {
      setUserLiked((prev) => ({ ...prev, [currentStory.id]: true }));
      setLikes((lp) => {
        const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : (currentStory.likesCount || 0);
        return { ...lp, [currentStory.id]: count + 1 };
      });

      try {
        await toggleLikeElephantPost(currentStory.id, effectiveUid, true);
      } catch (err) {}
    }
  };

  const handleTouchStart = () => {
    holdTimerRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 180);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    setIsPaused(false);

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleClickStory(e);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleBookmark = () => {
    setSavedStories((prev) => {
      const saved = !prev[currentStory.id];
      if (onShowNotification) {
        onShowNotification(
          saved
            ? (language === 'si' ? 'Story එක Bookmark විය' : 'Saved!')
            : (language === 'si' ? 'Bookmark ඉවත් විය' : 'Removed')
        );
      }
      return { ...prev, [currentStory.id]: saved };
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const bilingualName = formatBilingualElephantName(
      { name: currentGroup.elephantName, sinhalaName: currentGroup.elephantSinhalaName },
      language
    );

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${bilingualName} - Story`,
          url: shareUrl,
        });
        return;
      } catch (err) {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      if (onShowNotification) {
        onShowNotification(language === 'si' ? 'Link එක Copy විය' : 'Link copied!');
      }
    } catch (err) {}
  };

  const bilingualElephantName = formatBilingualElephantName(
    { name: currentGroup.elephantName, sinhalaName: currentGroup.elephantSinhalaName },
    language
  );

  const rawHandle = currentStory.authorUsername || currentStory.authorName || 'ali_fan';
  const cleanUsername = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
  const relativeTimeStr = formatRelativeTime(currentStory.createdAt, language);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center animate-fadeIn select-none backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes storyFillAnim {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      {/* Instagram Story Mobile Container Frame (9:16) */}
      <div
        className="relative w-full h-full max-w-md max-h-[100dvh] sm:max-h-[92vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Immersive Photo Layer */}
        <div
          onDoubleClick={handleDoubleClickStory}
          className="absolute inset-0 z-0 bg-black flex items-center justify-center cursor-pointer"
        >
          <img
            key={currentStory.id}
            src={imageSrc}
            alt={currentGroup.elephantName}
            decoding="async"
            loading="eager"
            onError={() => {
              setImgError((prev) => ({ ...prev, [currentStory.id]: true }));
            }}
            className="w-full h-full object-cover transition-opacity duration-200 pointer-events-none"
            style={{ contain: 'paint' }}
          />

          {/* Clean Instagram-style Vignettes */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          {/* Minimalist Pause Indicator */}
          {isPaused && (
            <div className="absolute top-16 right-4 p-2 rounded-full bg-black/50 backdrop-blur-md text-white/90 border border-white/10 animate-fadeScale">
              <Pause className="w-3.5 h-3.5 fill-white stroke-none" />
            </div>
          )}

          {/* Double-Tap Heart Pop Effect */}
          <ElephantHeartPop show={heartAnim.show} position={heartAnim.pos} />
        </div>

        {/* TOP INSTAGRAM HEADER: Progress Bar + Avatar + Name + Minimal Icons */}
        <div className="relative z-20 pt-3 px-3 pb-1 space-y-2 pointer-events-auto">
          {/* Hardware-Accelerated 60fps CSS Progress Bars */}
          <div className="flex gap-1 w-full items-center">
            {groupStories.map((s, idx) => (
              <div
                key={s.id || idx}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-xs relative"
              >
                {idx < currentSegmentIdx && (
                  <div className="h-full w-full bg-white rounded-full" />
                )}
                {idx === currentSegmentIdx && (
                  <div
                    key={`bar-${currentGroupIdx}-${currentSegmentIdx}`}
                    className="h-full bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                    style={{
                      animation: 'storyFillAnim 6000ms linear forwards',
                      animationPlayState: isPaused ? 'paused' : 'running',
                    }}
                    onAnimationEnd={handleNext}
                  />
                )}
                {idx > currentSegmentIdx && (
                  <div className="h-full w-0 bg-white/0" />
                )}
              </div>
            ))}
          </div>

          {/* Instagram Top Profile Bar */}
          <div className="flex items-center justify-between">
            {/* Left: Avatar + Elephant Name + Time */}
            <div
              onClick={() => currentGroup.linkedElephant && onSelectElephant(currentGroup.linkedElephant)}
              className="flex items-center gap-2.5 cursor-pointer group min-w-0"
            >
              {/* Instagram Glowing Avatar Ring */}
              <div className="w-9 h-9 rounded-full p-[1.5px] bg-[#062E22] ring-2 ring-emerald-500/80 shrink-0 shadow-md">
                <div className="w-full h-full rounded-full overflow-hidden bg-black">
                  <img
                    src={currentGroup.avatarPhoto || imageSrc}
                    alt={currentGroup.elephantName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="min-w-0 flex items-center gap-1.5">
                <span className="font-bold text-sm text-white drop-shadow truncate group-hover:text-emerald-300 transition-colors">
                  {bilingualElephantName}
                </span>

                {currentGroup.isTusker && (
                  <Crown className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 shrink-0" />
                )}

                <span className="text-white/60 text-xs font-light">•</span>
                <span className="text-white/70 text-xs font-medium shrink-0">
                  {relativeTimeStr}
                </span>
              </div>
            </div>

            {/* Right: Minimalist Follow Icon & Close Icon */}
            <div className="flex items-center gap-2 shrink-0">
              {elephantId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFollowElephant(elephantId);
                  }}
                  className={`p-2 rounded-full transition-all cursor-pointer active:scale-90 ${
                    followingThisElephant
                      ? 'bg-white text-black shadow-md'
                      : 'bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20'
                  }`}
                  title={followingThisElephant ? 'Following' : 'Follow'}
                >
                  {followingThisElephant ? (
                    <UserCheck className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/20 active:scale-90"
                title="Close"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* TAP NAVIGATION ZONES (Left 30% for Prev, Right 70% for Next) */}
        <div className="absolute inset-y-16 inset-x-0 z-10 flex">
          <div
            onClick={handlePrev}
            className="w-1/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-3 transition-opacity text-white/70"
            title="Prev"
          >
            {(currentSegmentIdx > 0 || currentGroupIdx > 0) && (
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <ChevronLeft className="w-5 h-5" />
              </div>
            )}
          </div>

          <div
            onClick={handleNext}
            className="w-2/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-3 transition-opacity text-white/70"
            title="Next"
          >
            <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* BOTTOM CLEAN INSTAGRAM OVERLAY */}
        <div className="relative z-20 p-4 space-y-2.5 pointer-events-auto">
          {/* Author Tag & Profile Shortcut */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 shadow-xs">
              <div className="w-4 h-4 rounded-full overflow-hidden bg-[#062E22] flex items-center justify-center shrink-0 border border-emerald-500/50">
                {currentStory.authorPhotoURL ? (
                  <img src={currentStory.authorPhotoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-2.5 h-2.5 text-white" />
                )}
              </div>
              <span className="text-white font-mono text-[11px] font-semibold">
                {cleanUsername}
              </span>
            </div>

            {currentGroup.linkedElephant && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectElephant(currentGroup.linkedElephant!);
                }}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20 transition-all cursor-pointer active:scale-95"
              >
                <span>Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Caption (if exists) */}
          {currentStory.caption && (
            <p className="text-white text-xs leading-snug drop-shadow font-normal line-clamp-2 px-0.5">
              {currentStory.caption}
            </p>
          )}

          {/* Action Row: LARGE Instagram Size Icons for Like, Share, Bookmark */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {/* Like Icon */}
              <button
                type="button"
                onClick={handleLike}
                className={`p-2.5 rounded-full flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer border active:scale-110 ${
                  isLiked
                    ? 'bg-rose-600/90 text-white border-rose-500 shadow-md'
                    : 'bg-black/60 text-white hover:bg-black/80 border-white/20'
                }`}
                title="Like"
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-white stroke-none' : 'stroke-[2]'}`} />
                {likeCount > 0 && <span className="text-xs font-bold">{likeCount}</span>}
              </button>

              {/* Share Icon */}
              <button
                type="button"
                onClick={handleShare}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer active:scale-110"
                title="Share"
              >
                <Share2 className="w-6 h-6 stroke-[2]" />
              </button>
            </div>

            {/* Bookmark Icon */}
            <button
              type="button"
              onClick={handleBookmark}
              className={`p-2.5 rounded-full backdrop-blur-md transition-all cursor-pointer border active:scale-110 ${
                isSaved
                  ? 'bg-white text-black border-white'
                  : 'bg-black/60 text-white hover:bg-black/80 border-white/20'
              }`}
              title="Bookmark"
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-black stroke-none' : 'stroke-[2]'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body);
  }
  return modalContent;
};
