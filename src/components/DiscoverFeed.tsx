import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Elephant, ElephantPost, CulturalEvent } from '../types/elephant';
import {
  Heart,
  Bookmark,
  Share2,
  ShieldCheck,
  Crown,
  Sparkles,
  Building2,
  Radio,
  Plus,
  Play,
  UserCheck,
  Check,
  Maximize2,
  Search,
  X,
  MapPin,
  ExternalLink,
  Pencil,
  Trash2,
  MoreHorizontal,
  Flag,
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { ALI_MEDIA_LOGO_URL, isSuperAdminPostEmail } from '../utils/aliMediaTeam';
import { Language, translations, formatBilingualElephantName, getElephantProfilePhoto } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { StoryViewerModal, StoryItem, ElephantStoryGroup } from './StoryViewerModal';
import { ElephantHeartPop } from './ElephantHeartPop';
import { toggleLikeElephantPost, isWithin24Hours, subscribeToPostLikes, deleteElephantPost, formatRelativeTime, toTimestampMs, wasEdited } from '../firebase/postService';
import { reportPost, type ReportReason } from '../firebase/commentService';
import { checkIsAdmin } from '../firebase/adminAuthService';
import { toggleCulturalEventLike, toggleLikeElephant } from '../firebase/elephantService';
import { toggleBookmarkPost, subscribeToUserBookmarks } from '../firebase/bookmarkService';
import type { PhotoAspectRatio } from '../types/elephant';
import { TranslatedText, useTranslatedText } from './TranslatedText';
import { PostComments } from './PostComments';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase/config';

/** Caption / body text that follows the UI language (EN ↔ SI). */
function LocalizedBody({
  text,
  language,
  altText,
  altLanguage,
  expanded,
  limit = 110,
  onToggle,
  seeMoreLabel,
  seeLessLabel,
}: {
  text: string;
  language: Language;
  altText?: string;
  altLanguage?: Language;
  expanded: boolean;
  limit?: number;
  onToggle: () => void;
  seeMoreLabel: string;
  seeLessLabel: string;
}) {
  const translated = useTranslatedText(text, language, altText, altLanguage);
  const isLong = translated.length > limit;
  const shown =
    isLong && !expanded ? `${translated.slice(0, limit)}... ` : translated;
  return (
    <>
      <span className="whitespace-pre-line">{shown}</span>
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          className="ml-1 text-[11px] font-bold text-[#062E22] dark:text-emerald-400 hover:underline cursor-pointer"
        >
          {expanded ? seeLessLabel : seeMoreLabel}
        </button>
      )}
    </>
  );
}

/** Map stored aspect ratio to Tailwind aspect class; default portrait-friendly 3:4 */
function aspectClassFor(ratio?: PhotoAspectRatio | string): string {
  switch (ratio) {
    case '1:1':
      return 'aspect-square';
    case '9:16':
      return 'aspect-[9/16]';
    case '3:4':
      return 'aspect-[3/4]';
    case '4:3':
      return 'aspect-[4/3]';
    default:
      return 'aspect-[3/4]';
  }
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
    return {
      type: 'iframe',
      src: `https://player.twitch.tv/?channel=${twitch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=true&muted=false`,
    };
  }
  if (/\.(m3u8|mp4)(\?|$)/i.test(url) || url.includes('hls')) {
    return { type: 'video', src: url };
  }
  if (url.includes('facebook.com') || url.includes('fb.watch')) {
    return {
      type: 'iframe',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`,
    };
  }
  return { type: 'iframe', src: url };
}

interface DiscoverFeedProps {
  elephants: Elephant[];
  posts?: ElephantPost[];
  events?: CulturalEvent[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenCreatePost: (elephantId?: string, isStoryOnly?: boolean) => void;
  onSelectPhoto?: (photoUrl: string) => void;
  onShowNotification?: (msg: string) => void;
  onOpenDirectory?: () => void;
  /** Navigate to the dedicated Edit Post screen (not an inline modal). */
  onEditPost?: (post: ElephantPost) => void;
  onDeletePost?: (post: ElephantPost) => void;
  /** Post to scroll to & auto-open comments for (e.g. arriving from a notification) */
  focusPostId?: string | null;
  /** Specific comment/reply within that post to scroll to & highlight */
  focusCommentId?: string | null;
  /** Called once the focus target has been scrolled to / handled */
  onFocusHandled?: () => void;
}

export const DiscoverFeed: React.FC<DiscoverFeedProps> = ({
  elephants,
  posts = [],
  events = [],
  language,
  onSelectElephant,
  onOpenCreatePost,
  onSelectPhoto,
  onShowNotification,
  onOpenDirectory,
  onEditPost,
  onDeletePost,
  focusPostId,
  focusCommentId,
  onFocusHandled,
}) => {
  const t = translations[language];
  const { user, profile, isFollowing, toggleFollowElephant } = useAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Arriving from a notification: scroll the target post into view.
  // The matching PostComments instance is told to open + highlight via props below;
  // once handled it reports back via onFocusHandled so this doesn't refire.
  useEffect(() => {
    if (!focusPostId) return;
    const el = postRefs.current[focusPostId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusPostId]);

  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [postActionBusy, setPostActionBusy] = useState(false);
  const [deletePostTarget, setDeletePostTarget] = useState<ElephantPost | null>(null);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [submittingPostReport, setSubmittingPostReport] = useState(false);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [id: string]: boolean }>({});
  const [expandedCaptions, setExpandedCaptions] = useState<{ [id: string]: boolean }>({});
  const [heartAnims, setHeartAnims] = useState<{ [id: string]: { show: boolean; pos?: { x: number; y: number } } }>({});
  const [activeStoryViewer, setActiveStoryViewer] = useState<{
    groups: ElephantStoryGroup[];
    initialIndex: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLiveId, setExpandedLiveId] = useState<string | null>(null);
  const [liveLikes, setLiveLikes] = useState<{ [id: string]: number }>({});
  const [liveUserLiked, setLiveUserLiked] = useState<{ [id: string]: boolean }>({});

  // Track timestamps when stories for each elephant were viewed by user (persisted in localStorage)
  const [viewedTimestamps, setViewedTimestamps] = useState<{ [elephantId: string]: number }>(() => {
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Real-time elephant likes (persisted under elephant_likes/)
  const [elephantLikesMap, setElephantLikesMap] = useState<
    Record<string, { likesCount: number; likedBy: string[] }>
  >({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid || user.isAnonymous) {
        if (!cancelled) setIsAdminUser(false);
        return;
      }
      try {
        const ok = await checkIsAdmin(user.uid);
        if (!cancelled) setIsAdminUser(!!ok);
      } catch {
        if (!cancelled) setIsAdminUser(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, user?.isAnonymous]);

  // Real-time post likes (persisted under post_likes/) — source of truth for counts
  const [postLikesMap, setPostLikesMap] = useState<
    Record<string, { likesCount: number; likedBy: string[] }>
  >({});

  React.useEffect(() => {
    const likesRef = ref(db, 'elephant_likes');
    const unsub = onValue(
      likesRef,
      (snap) => {
        const map: Record<string, { likesCount: number; likedBy: string[] }> = {};
        if (snap.exists()) {
          const val = snap.val() || {};
          for (const [id, data] of Object.entries(val) as [string, any][]) {
            const raw = data?.likedBy;
            let likedBy: string[] = [];
            if (Array.isArray(raw)) {
              likedBy = raw.filter((v: unknown) => typeof v === 'string');
            } else if (raw && typeof raw === 'object') {
              for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
                if (k.startsWith('_')) continue;
                if (v === true) likedBy.push(k);
                else if (typeof v === 'string') likedBy.push(v);
              }
            }
            const unique = Array.from(new Set(likedBy));
            map[id] = { likesCount: unique.length, likedBy: unique };
          }
        }
        setElephantLikesMap(map);
      },
      () => {}
    );
    return unsub;
  }, []);

  React.useEffect(() => {
    return subscribeToPostLikes(setPostLikesMap);
  }, []);

  // Real-time event likes
  React.useEffect(() => {
    const likesRef = ref(db, 'event_likes');
    const unsub = onValue(
      likesRef,
      (snap) => {
        if (!snap.exists()) {
          setLiveLikes({});
          setLiveUserLiked({});
          return;
        }
        const val = snap.val() || {};
        const counts: { [id: string]: number } = {};
        const liked: { [id: string]: boolean } = {};
        const uid = profile?.uid || user?.uid || '';
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          const likedBy = Array.isArray(data?.likedBy) ? data.likedBy : [];
          counts[id] = typeof data?.likesCount === 'number' ? data.likesCount : likedBy.length;
          if (uid) liked[id] = likedBy.includes(uid);
        }
        setLiveLikes(counts);
        setLiveUserLiked(liked);
      },
      () => {}
    );
    return unsub;
  }, [profile?.uid, user?.uid]);

  const handleMarkStoryViewed = useCallback((elephantId: string) => {
    if (!elephantId) return;
    const now = Date.now();
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      const map = raw ? JSON.parse(raw) : {};
      map[elephantId] = now;
      localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
    } catch {}
  }, []);

  const refreshViewedState = useCallback(() => {
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      if (raw) {
        setViewedTimestamps(JSON.parse(raw));
      }
    } catch {}
  }, []);

  const lastTapRef = useRef<{ [id: string]: number }>({});

  const getEffectiveUid = (): string => {
    if (profile?.uid) return profile.uid;
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

  const triggerHeartAnimation = (id: string, pos?: { x: number; y: number }) => {
    setHeartAnims((prev) => ({ ...prev, [id]: { show: true, pos } }));
    setTimeout(() => {
      setHeartAnims((prev) => ({ ...prev, [id]: { show: false } }));
    }, 950);
  };

  const notify = (msg: string) => {
    if (onShowNotification) {
      onShowNotification(msg);
    }
  };

  const handleLike = async (id: string, initialCount: number = 0, isPost = true) => {
    if (!profile) {
      alert(
        language === 'si'
          ? 'Like කිරීමට කරුණාකර පළමුව පිවිසෙන්න (Email හෝ Google)!'
          : 'Please sign in first (email or Google) to like!'
      );
      return;
    }
    const effectiveUid = profile.uid || user?.uid;
    if (!effectiveUid) {
      notify(language === 'si' ? 'පිවිසුම අවශ්‍යයි' : 'Sign in required');
      return;
    }

    const postEngagement = isPost ? postLikesMap[id] : undefined;
    const elephantEngagement = !isPost ? elephantLikesMap[id] : undefined;
    const serverLiked = isPost
      ? postEngagement?.likedBy?.includes(effectiveUid) || false
      : elephantEngagement?.likedBy?.includes(effectiveUid) || false;
    const isCurrentlyLiked = userLiked[id] !== undefined ? userLiked[id] : serverLiked;

    const nextLiked = !isCurrentlyLiked;
    const serverCount = isPost
      ? postEngagement?.likesCount ?? initialCount
      : elephantEngagement?.likesCount ?? initialCount;

    // Optimistic UI
    setUserLiked((prev) => ({ ...prev, [id]: nextLiked }));
    setLikes((likePrev) => {
      const current = likePrev[id] !== undefined ? likePrev[id] : serverCount;
      return { ...likePrev, [id]: nextLiked ? current + 1 : Math.max(0, current - 1) };
    });

    if (nextLiked) {
      triggerHeartAnimation(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch {}
      }
    }

    try {
      if (isPost) {
        const result = await toggleLikeElephantPost(id, effectiveUid, false);
        setUserLiked((prev) => ({ ...prev, [id]: result.isLiked }));
        setLikes((prev) => ({ ...prev, [id]: result.newCount }));
      } else {
        const result = await toggleLikeElephant(id, effectiveUid, false);
        setUserLiked((prev) => ({ ...prev, [id]: result.isLiked }));
        setLikes((prev) => ({ ...prev, [id]: result.newCount }));
      }
    } catch (err) {
      console.warn('Like toggle sync error:', err);
      setUserLiked((prev) => ({ ...prev, [id]: isCurrentlyLiked }));
      setLikes((prev) => ({ ...prev, [id]: serverCount }));
      notify(
        language === 'si'
          ? 'Like සුරැකීමට නොහැකි විය. නැවත උත්සාහ කරන්න.'
          : 'Could not save like. Please try again.'
      );
    }
  };

  const handlePostDoubleClick = async (
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    initialCount: number = 0,
    isPost = true
  ) => {
    e.stopPropagation();
    if (!profile) {
      alert(
        language === 'si'
          ? 'Like කිරීමට කරුණාකර පළමුව පිවිසෙන්න (Email හෝ Google)!'
          : 'Please sign in first (email or Google) to like!'
      );
      return;
    }
    const effectiveUid = profile.uid || user?.uid;
    if (!effectiveUid) return;

    const postEngagement = isPost ? postLikesMap[id] : undefined;
    const elephantEngagement = !isPost ? elephantLikesMap[id] : undefined;

    let pos: { x: number; y: number } | undefined = undefined;
    if ('clientX' in e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    triggerHeartAnimation(id, pos);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([35, 20]); } catch {}
    }

    const serverLiked = isPost
      ? postEngagement?.likedBy?.includes(effectiveUid) || false
      : elephantEngagement?.likedBy?.includes(effectiveUid) || false;
    const isCurrentlyLiked = userLiked[id] !== undefined ? userLiked[id] : serverLiked;

    // Double-tap only adds a like (does not unlike)
    if (!isCurrentlyLiked) {
      const serverCount = isPost
        ? postEngagement?.likesCount ?? initialCount
        : elephantEngagement?.likesCount ?? initialCount;
      setUserLiked((prev) => ({ ...prev, [id]: true }));
      setLikes((likePrev) => {
        const current = likePrev[id] !== undefined ? likePrev[id] : serverCount;
        return { ...likePrev, [id]: current + 1 };
      });

      try {
        if (isPost) {
          const result = await toggleLikeElephantPost(id, effectiveUid, true);
          setUserLiked((prev) => ({ ...prev, [id]: result.isLiked }));
          setLikes((prev) => ({ ...prev, [id]: result.newCount }));
        } else {
          const result = await toggleLikeElephant(id, effectiveUid, true);
          setUserLiked((prev) => ({ ...prev, [id]: result.isLiked }));
          setLikes((prev) => ({ ...prev, [id]: result.newCount }));
        }
      } catch (err) {
        console.warn('Double click like sync error:', err);
        setUserLiked((prev) => ({ ...prev, [id]: false }));
        setLikes((prev) => ({ ...prev, [id]: serverCount }));
      }
    }
  };

  const handleTouchEndImage = (
    e: React.TouchEvent,
    id: string,
    initialCount: number = 0,
    isPost = true
  ) => {
    const now = Date.now();
    const last = lastTapRef.current[id] || 0;
    if (now - last < 380) {
      // Double tap detected! Like & animate heart
      handlePostDoubleClick(e, id, initialCount, isPost);
      lastTapRef.current[id] = 0;
    } else {
      lastTapRef.current[id] = now;
    }
  };

  // Sync bookmarks from RTDB when signed in
  React.useEffect(() => {
    const uid = profile?.uid || user?.uid;
    if (!uid || user?.isAnonymous) return;
    return subscribeToUserBookmarks(uid, (map) => {
      const next: { [id: string]: boolean } = {};
      for (const id of Object.keys(map)) next[id] = true;
      setSavedPosts(next);
    });
  }, [profile?.uid, user?.uid, user?.isAnonymous]);

  const handleBookmark = async (id: string, name: string) => {
    const uid = profile?.uid || user?.uid;
    if (!uid || user?.isAnonymous || !profile) {
      notify(
        language === 'si'
          ? 'සුරැකීමට Google මගින් පිවිසෙන්න.'
          : 'Sign in with Google to save bookmarks.'
      );
      return;
    }
    const post = posts.find((p) => p.id === id);
    if (!post) {
      // Elephant card bookmark — store as lightweight local+notify only
      setSavedPosts((prev) => {
        const isNowSaved = !prev[id];
        notify(
          isNowSaved
            ? language === 'si'
              ? `${name} සුරැකිණි!`
              : `Saved ${name}!`
            : language === 'si'
              ? 'ඉවත් කළා'
              : 'Removed from bookmarks.'
        );
        return { ...prev, [id]: isNowSaved };
      });
      return;
    }
    const currentlySaved = !!savedPosts[id];
    try {
      const nowSaved = await toggleBookmarkPost(uid, post, currentlySaved);
      setSavedPosts((prev) => ({ ...prev, [id]: nowSaved }));
      notify(
        nowSaved
          ? language === 'si'
            ? `${name} ඔබේ profile Saved ට එක් විය!`
            : `Saved to your profile bookmarks!`
          : language === 'si'
            ? 'සුරැකි ලැයිස්තුවෙන් ඉවත් විය.'
            : 'Removed from bookmarks.'
      );
    } catch (err) {
      console.warn(err);
      notify(
        language === 'si' ? 'සුරැකීම අසාර්ථකයි.' : 'Could not save bookmark.'
      );
    }
  };

  const handleShare = async (id: string, name: string, captionText?: string) => {
    const el =
      elephants.find((e) => e.id === id) ||
      elephants.find((e) => e.name === name);
    if (el) {
      const { shareRegistryCard } = await import('../utils/registryCard');
      await shareRegistryCard(el, { language, notify });
      return;
    }

    const shareUrl = `${window.location.origin}/#e/${id}`;
    const shareData = {
      title: `${name} - Sri Lankan Elephant`,
      text: captionText
        ? `${captionText} | ${name}\n${shareUrl}`
        : `Check out ${name} on AliMedia — sign in to view the full profile:\n${shareUrl}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      notify(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී!' : 'Link copied to clipboard!');
    } catch (err) {
      notify(language === 'si' ? 'සබැඳිය සූදානම්!' : 'Link ready to share!');
    }
  };

  const toggleCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // HELPER: Extract timestamp in milliseconds
  // -------------------------------------------------------------
  const getStoryTimestampMs = (createdAt: any): number => {
    return toTimestampMs(createdAt);
  };

  // -------------------------------------------------------------
  // STORIES TRAY BUILDER
  // Community stories (24h) only — elephants the user follows are
  // excluded from the story line (not shown after you follow them).
  // -------------------------------------------------------------
  const compiledStoryGroups: ElephantStoryGroup[] = useMemo(() => {
    const groupMap = new Map<string, ElephantStoryGroup>();

    // Gather user-submitted community stories (within 24 hours)
    // Skip any elephant the current user is already following
    posts.forEach((post) => {
      if (post.isStory !== false && post.photoUrl && isWithin24Hours(post.createdAt)) {
        const rawName = (post.elephantName || '').trim();
        const isPlaceholderName = !rawName || /^unknown\s+elephant$/i.test(rawName);
        const linked =
          isPlaceholderName && !post.elephantId
            ? undefined
            : elephants.find(
                (e) =>
                  (post.elephantId && e.id === post.elephantId) ||
                  (!isPlaceholderName && e.name === post.elephantName)
              );
        const postElephantId = post.elephantId || linked?.id;
        if (!postElephantId) return;

        // Do not show followed elephants in the story line
        if (isFollowing(postElephantId)) return;

        const groupKey = postElephantId;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            elephantId: groupKey,
            elephantName: post.elephantName || linked?.name || 'Elephant',
            elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
            avatarPhoto: getElephantProfilePhoto(linked) || post.photoUrl,
            coverPhoto: post.photoUrl,
            linkedElephant: linked,
            isTusker: linked?.type === 'tusker',
            isFollowed: false,
            isLive: linked?.isLive,
            latestStoryTimestamp: getStoryTimestampMs(post.createdAt),
            stories: [],
          });
        }

        const group = groupMap.get(groupKey)!;
        const postTimestamp = getStoryTimestampMs(post.createdAt);
        if (postTimestamp > (group.latestStoryTimestamp || 0)) {
          group.latestStoryTimestamp = postTimestamp;
          group.coverPhoto = post.photoUrl;
        }

        group.stories.push({
          id: post.id || `post-story-${Math.random()}`,
          elephantId: groupKey,
          elephantName: post.elephantName || linked?.name || 'Elephant',
          elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
          photoUrl: post.photoUrl,
          caption: post.caption,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          authorPhotoURL: post.authorPhotoURL,
          createdAt: post.createdAt,
          linkedElephant: linked,
          isFollowed: false,
          isTusker: linked?.type === 'tusker',
          likesCount: post.likesCount,
        });
      }
    });

    // Calculate viewed state for each group
    const groupsArray = Array.from(groupMap.values()).filter((g) => g.stories.length > 0);
    groupsArray.forEach((group) => {
      const lastViewed = viewedTimestamps[group.elephantId] || 0;
      const latestTs = group.latestStoryTimestamp || 0;
      group.isViewed = lastViewed >= latestTs && lastViewed > 0;
    });

    // Partition into Unviewed and Viewed groups
    const unviewedGroups = groupsArray.filter((g) => !g.isViewed);
    const viewedGroups = groupsArray.filter((g) => g.isViewed);

    // Sort by upload/update time (newest timestamp first)
    unviewedGroups.sort((a, b) => (b.latestStoryTimestamp || 0) - (a.latestStoryTimestamp || 0));
    viewedGroups.sort((a, b) => (b.latestStoryTimestamp || 0) - (a.latestStoryTimestamp || 0));

    // UNVIEWED stories appear first, VIEWED stories move to the back!
    return [...unviewedGroups, ...viewedGroups];
  }, [elephants, posts, isFollowing, viewedTimestamps]);

  // Main Feed Posts (Excludes story-only posts)
  const feedPosts = useMemo(() => {
    const base = posts.filter((p) => !p.isStoryOnly);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    const matched = base.filter((p) => {
      const hay = [p.caption, p.elephantName, p.elephantSinhalaName, p.authorName, p.authorUsername]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    // If caption search has hits, narrow the feed; otherwise keep all posts
    // so elephant-only matches still show the normal stream.
    return matched.length > 0 ? matched : base;
  }, [posts, searchQuery]);

  // Live Perahara / ceremony sessions — auto-pinned at top of feed for every user
  const liveSessions = useMemo(() => {
    return events.filter((ev) => ev.isLive && ev.isActive !== false);
  }, [events]);

  const handleLiveLike = async (eventId: string, initialCount: number = 0) => {
    if (!profile) {
      alert(
        language === 'si'
          ? 'සජීවී session එකකට Like කිරීමට කරුණාකර පළමුව පිවිසෙන්න (Email හෝ Google)!'
          : 'Please sign in first (email or Google) to like live sessions!'
      );
      return;
    }
    const uid = profile.uid || user?.uid;
    if (!uid || !eventId) return;

    const ev = events.find((e) => e.id === eventId);
    const isCurrentlyLiked =
      liveUserLiked[eventId] !== undefined
        ? liveUserLiked[eventId]
        : (ev?.likedBy?.includes(uid) || false);

    const nextLiked = !isCurrentlyLiked;
    setLiveUserLiked((prev) => ({ ...prev, [eventId]: nextLiked }));
    setLiveLikes((prev) => {
      const current = prev[eventId] !== undefined ? prev[eventId] : (ev?.likesCount ?? initialCount);
      return { ...prev, [eventId]: nextLiked ? current + 1 : Math.max(0, current - 1) };
    });

    if (nextLiked && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch {}
    }

    try {
      const result = await toggleCulturalEventLike(eventId, uid);
      setLiveUserLiked((prev) => ({ ...prev, [eventId]: result.isLiked }));
      setLiveLikes((prev) => ({ ...prev, [eventId]: result.newCount }));
    } catch {
      // keep optimistic UI
    }
  };

  // Search: elephants (names, places, mahouts…) + posts (captions / author)
  type SearchHit =
    | { kind: 'elephant'; elephant: Elephant }
    | { kind: 'post'; post: ElephantPost };
  const searchResults = useMemo((): SearchHit[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const el of elephants) {
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
      if (hay.includes(q)) hits.push({ kind: 'elephant', elephant: el });
      if (hits.length >= 12) break;
    }
    if (hits.length < 12) {
      for (const p of posts) {
        const hay = [
          p.caption,
          p.elephantName,
          p.elephantSinhalaName,
          p.authorName,
          p.authorUsername,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (hay.includes(q)) hits.push({ kind: 'post', post: p });
        if (hits.length >= 12) break;
      }
    }
    return hits;
  }, [elephants, posts, searchQuery]);


  return (
    <div className="max-w-lg mx-auto w-full space-y-4 pb-24 animate-fadeIn pt-1">
      {/* ----------------------------------------------------------------- */}
      {/* THEMED SEARCH BAR (elephants · temples · perahera)                */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-emerald-700/70 dark:text-emerald-400/80 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'si'
                ? '🐘 අලි, පෙරහැර, විහාරස්ථාන හෝ ස්ථාන සොයන්න...'
                : '🐘 Search elephants, perahera, temples or places...'
            }
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm font-medium
              bg-white dark:bg-[#0f1a16] border border-emerald-900/15 dark:border-emerald-800/40
              text-[#062E22] dark:text-emerald-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500
              shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600/50
              transition-all"
            aria-label={language === 'si' ? 'සෙවුම' : 'Search'}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {searchQuery.trim() && (
          <div className="mt-2 rounded-2xl border border-zinc-200 dark:border-emerald-950/60 bg-white dark:bg-[#121F1B] shadow-md overflow-hidden max-h-72 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                {language === 'si' ? 'ප්‍රතිඵල හමු නොවීය. වෙනත් නමක්, ස්ථානයක් හෝ caption එකක් උත්සාහ කරන්න.' : 'No matches. Try a name, place, or post caption.'}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {searchResults.map((hit) => {
                  if (hit.kind === 'elephant') {
                    const el = hit.elephant;
                    const label = formatBilingualElephantName(el, language);
                    const photo = el.photos?.[0];
                    return (
                      <li key={`e-${el.id || el.name}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            onSelectElephant(el);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#062E22]/10 dark:bg-emerald-900/30 shrink-0 border border-zinc-200 dark:border-emerald-900/40">
                            {photo ? (
                              <img src={photo} alt={label} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg" aria-hidden="true">🐘</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[#062E22] dark:text-emerald-100 truncate flex items-center gap-1.5">
                              {label}
                              {el.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-label="Verified" />}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                              {[el.location, el.organization].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  }
                  const p = hit.post;
                  const caption = (p.caption || '').trim();
                  const title = caption.slice(0, 80) || p.elephantName || p.authorName || 'Post';
                  return (
                    <li key={`p-${p.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          const el = document.querySelector(`[data-post-id="${p.id}"]`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-emerald-900/40">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">Post</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#062E22] dark:text-emerald-100 truncate">{title}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {language === 'si' ? 'පෝස්ට්' : 'Post'} · {p.authorUsername || p.authorName || '—'}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {onOpenDirectory && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onOpenDirectory();
                }}
                className="w-full px-4 py-2.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 border-t border-zinc-100 dark:border-emerald-950/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                {language === 'si' ? 'සම්පූර්ණ අලි නාමාවලිය විවෘත කරන්න →' : 'Open full elephant directory →'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* AUTO-PINNED LIVE SESSIONS (Perahara / ceremonies — not elephants) */}
      {/* ----------------------------------------------------------------- */}
      {liveSessions.length > 0 && (
        <div className="space-y-2">
          {liveSessions.map((ev) => {
            const stream = toEmbedStreamUrl(ev.liveStreamUrl);
            const isExpanded = expandedLiveId === (ev.id || ev.title);
            const eventId = ev.id || '';
            const uid = profile?.uid || user?.uid || '';
            const liveLiked =
              liveUserLiked[eventId] !== undefined
                ? liveUserLiked[eventId]
                : !!(uid && ev.likedBy?.includes(uid));
            const liveLikeCount =
              liveLikes[eventId] !== undefined ? liveLikes[eventId] : (ev.likesCount || 0);
            return (
              <div
                key={ev.id || ev.title}
                className="rounded-2xl overflow-hidden border-2 border-red-500/60 dark:border-red-500/50 bg-gradient-to-br from-red-50 via-white to-amber-50 dark:from-red-950/40 dark:via-[#121F1B] dark:to-amber-950/20 shadow-md"
              >
                <div className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    <Radio className="w-3 h-3" />
                    LIVE
                  </span>
                  <span className="text-xs font-bold truncate flex-1">
                    {language === 'si' ? 'පෙරහැර / උත්සව සජීවී' : 'Perahera / Ceremony Live'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full shrink-0">
                    <Heart className={`w-3 h-3 ${liveLiked ? 'fill-white' : ''}`} />
                    {liveLikeCount}
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  <TranslatedText
                    as="h3"
                    className="text-sm font-extrabold text-[#062E22] dark:text-emerald-100 leading-snug"
                    text={ev.title || ''}
                    language={language}
                    altText={ev.sinhalaTitle}
                    altLanguage="si"
                  />
                  {(ev.location || ev.date) && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-2">
                      {ev.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.location}
                        </span>
                      )}
                      {ev.date && <span>{ev.date}</span>}
                    </p>
                  )}
                  {ev.description && (
                    <TranslatedText
                      as="p"
                      className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2"
                      text={ev.description}
                      language={language}
                    />
                  )}

                  {isExpanded && stream && (
                    <div className="rounded-xl overflow-hidden bg-black aspect-video border border-zinc-800">
                      {stream.type === 'iframe' ? (
                        <iframe
                          src={stream.src}
                          title={ev.sinhalaTitle && language === 'si' ? ev.sinhalaTitle : (ev.title || 'Live')}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video src={stream.src} controls autoPlay playsInline className="w-full h-full" />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {eventId && (
                      <button
                        type="button"
                        onClick={() => handleLiveLike(eventId, ev.likesCount || 0)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          liveLiked
                            ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-[#062E22] dark:text-emerald-100 hover:bg-red-50 dark:hover:bg-red-950/30'
                        }`}
                        title={language === 'si' ? 'සජීවී Like' : 'Like live'}
                      >
                        <Heart className={`w-4 h-4 ${liveLiked ? 'fill-red-600 text-red-600' : ''}`} />
                        <span>{liveLikeCount}</span>
                        <span className="opacity-70 font-semibold">
                          {language === 'si' ? 'Like' : 'Likes'}
                        </span>
                      </button>
                    )}
                    {stream && (
                      <button
                        type="button"
                        onClick={() => setExpandedLiveId(isExpanded ? null : (ev.id || ev.title))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {isExpanded
                          ? language === 'si'
                            ? 'සඟවන්න'
                            : 'Hide player'
                          : language === 'si'
                            ? 'සජීවීව නරඹන්න'
                            : 'Watch live'}
                      </button>
                    )}
                    {ev.liveStreamUrl && (
                      <a
                        href={ev.liveStreamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[#062E22] dark:text-emerald-100 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {language === 'si' ? 'නව ටැබ්' : 'Open'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STORIES TRAY (Clean Minimalist Instagram Style)                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-1">
        {/* Horizontal Scrollable Story Cards Row */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-1 px-1 items-stretch">
          {/* Rectangular Add Story Box */}
          <div
            onClick={() => onOpenCreatePost(undefined, true)}
            className="flex-shrink-0 w-24 sm:w-26 cursor-pointer group"
          >
            <div className="relative h-full min-h-[125px] sm:min-h-[140px] aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-[#062E22] border-2 border-dashed border-emerald-500/60 group-hover:border-white transition-all flex flex-col items-center justify-center p-2 text-center text-white">
              <div className="w-10 h-10 rounded-full bg-white text-[#062E22] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform shadow-md">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-bold leading-tight">
                {language === 'si' ? 'Story එක් කරන්න' : 'Add Story'}
              </span>
            </div>
          </div>

          {/* Grouped Elephant Story Cards */}
          {compiledStoryGroups.length === 0 ? (
            <div className="flex-1 min-w-[220px] p-3 rounded-2xl bg-white dark:bg-black border border-dashed border-zinc-300 dark:border-white/20 flex flex-col justify-center items-start text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#062E22] dark:text-white">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>{language === 'si' ? 'ඇතුන්ගේ Stories නැරඹීමට Follow කරන්න' : 'Follow elephants to see stories'}</span>
              </div>
              {onOpenDirectory && (
                <button
                  type="button"
                  onClick={onOpenDirectory}
                  className="mt-1 px-3 py-1 bg-[#062E22] hover:bg-emerald-900 text-white text-[11px] font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <span>{language === 'si' ? '🐘 ඇතුන් සොයන්න' : '🐘 Explore'}</span>
                </button>
              )}
            </div>
          ) : (
            compiledStoryGroups.map((group, groupIdx) => {
              const isLive = group.isLive;
              const isViewed = group.isViewed;
              const bilingualName = formatBilingualElephantName(
                { name: group.elephantName, sinhalaName: group.elephantSinhalaName },
                language
              );
              const segmentCount = group.stories.length;
              const coverImg = group.coverPhoto || group.avatarPhoto || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=600&q=80';
              const avatarImg = group.avatarPhoto || coverImg;

              return (
                <div
                  key={group.elephantId || groupIdx}
                  onClick={() =>
                    setActiveStoryViewer({
                      groups: compiledStoryGroups,
                      initialIndex: groupIdx,
                    })
                  }
                  className="flex-shrink-0 w-24 sm:w-26 cursor-pointer group"
                >
                  <div
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-black border-2 transition-all transform group-hover:scale-[1.03] ${
                      isViewed
                        ? 'border-white/20 opacity-70 group-hover:opacity-100'
                        : 'border-[#062E22] ring-2 ring-emerald-500 shadow-md'
                    }`}
                  >
                    <img
                      src={coverImg}
                      alt={group.elephantName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                      {isLive ? (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-xs">
                          <Radio className="w-2 h-2" />
                        </span>
                      ) : !isViewed ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white/50 animate-pulse" />
                      ) : (
                        <span className="p-0.5 rounded-full bg-black/50 backdrop-blur-xs border border-white/20">
                          <Check className="w-2 h-2 text-white stroke-[3]" />
                        </span>
                      )}

                      {/* Segments count */}
                      {segmentCount > 1 && (
                        <div className="px-1.5 py-0.2 rounded-full bg-black/60 backdrop-blur-xs flex items-center gap-0.5 text-[8px] font-bold text-white/90 border border-white/20 shadow-xs">
                          <Play className="w-1.5 h-1.5 fill-white stroke-none" />
                          <span>{segmentCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Avatar & Elephant Name */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5 text-white pointer-events-none">
                      <div className={`w-5 h-5 rounded-full overflow-hidden border-2 flex-shrink-0 bg-[#062E22] shadow-xs ${
                        isViewed ? 'border-white/30' : 'border-emerald-400'
                      }`}>
                        <img
                          src={avatarImg}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold truncate block drop-shadow text-white group-hover:text-emerald-300 transition-colors" title={bilingualName}>
                          {bilingualName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* USER-SUBMITTED COMMUNITY POSTS                                    */}
      {/* ----------------------------------------------------------------- */}
      {feedPosts && feedPosts.length > 0 && (
        <div className="space-y-4">

          {feedPosts.map((post) => {
            const postId = post.id || '';
            if (!postId) return null;
            // Untagged = empty / legacy "Unknown Elephant" with no elephantId.
            // Real names still display even if the elephant is not in the local registry yet.
            const rawElephantName = (post.elephantName || '').trim();
            const isPlaceholderName = !rawElephantName || /^unknown\s+elephant$/i.test(rawElephantName);
            const isUntaggedElephant = isPlaceholderName && !post.elephantId;
            const linkedElephant = isUntaggedElephant
              ? undefined
              : elephants.find(
                  (e) =>
                    (post.elephantId && e.id === post.elephantId) ||
                    (!isPlaceholderName && e.name === post.elephantName)
                );
            const effectiveUid = profile?.uid || user?.uid || '';
            const postEngagement = postLikesMap[postId];
            // Source of truth: post_likes map → optimistic local → legacy post fields
            const isLiked =
              userLiked[postId] !== undefined
                ? userLiked[postId]
                : postEngagement?.likedBy?.includes(effectiveUid) ||
                  post.likedBy?.includes(effectiveUid) ||
                  false;
            const currentLikes =
              likes[postId] !== undefined
                ? likes[postId]
                : postEngagement?.likesCount ??
                  (typeof post.likesCount === 'number'
                    ? post.likesCount
                    : Array.isArray(post.likedBy)
                      ? post.likedBy.length
                      : 0);
            const isSaved = !!savedPosts[postId];
            const isExpanded = !!expandedCaptions[postId];
            const captionText = post.caption || '';
            const isElephantFollowed = linkedElephant?.id ? isFollowing(linkedElephant.id) : false;

            // Empty bilingualName → header falls back to author name + photo (author profile)
            const bilingualName = isUntaggedElephant
              ? ''
              : formatBilingualElephantName(
                  {
                    name: isPlaceholderName ? '' : post.elephantName,
                    sinhalaName: post.elephantSinhalaName || linkedElephant?.sinhalaName,
                  },
                  language
                );

            const postPhoto = (post.photoUrl && post.photoUrl.trim().length > 0)
              ? post.photoUrl
              : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';
            const isTeamAuthor = !!(post.authorIsAliMedia || /ali\s*media/i.test(post.authorName || ''));
            const postAuthorUid = (post.authorUid || '').toString().trim();
            const myUid = (user?.uid && !user.isAnonymous ? user.uid : '').toString().trim();
            const isPostOwner = !!(myUid && postAuthorUid && myUid === postAuthorUid);
            const isSuperAdmin = isSuperAdminPostEmail(user?.email);
            // Author, RTDB admin allowlist, or designated super-admin email
            const canManagePost = !!(myUid && (isPostOwner || isAdminUser || isSuperAdmin));
            const wasPostEdited = wasEdited(post.createdAt, post.updatedAt);
            const authorPhoto = isTeamAuthor
              ? ALI_MEDIA_LOGO_URL
              : ((post.authorPhotoURL && post.authorPhotoURL.trim().length > 0)
                  ? post.authorPhotoURL
                  : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80');

            return (
              <div
                key={postId}
                data-post-id={postId}
                ref={(el) => {
                  postRefs.current[postId] = el;
                }}
                className="bg-white dark:bg-black rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200 dark:border-white/10 transition-all space-y-3"
              >
                {/* 1. Header: Elephant (if tagged) or Author */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => linkedElephant && onSelectElephant(linkedElephant)}
                    className={`flex items-center gap-2.5 min-w-0 ${linkedElephant ? 'cursor-pointer group' : ''}`}
                    title={linkedElephant ? (language === 'si' ? `${bilingualName} ගේ Profile එක බලන්න` : `View ${bilingualName} Profile`) : undefined}
                  >
                    <div className="w-10 h-10 rounded-full p-0.5 bg-[#062E22] ring-2 ring-emerald-600/70 shrink-0 group-hover:scale-105 transition-transform">
                      <div className="w-full h-full rounded-full overflow-hidden bg-black">
                        <img
                          src={
                            !isUntaggedElephant
                              ? getElephantProfilePhoto(linkedElephant)
                              : authorPhoto
                          }
                          alt={bilingualName || post.authorName || 'Post'}
                          className={`w-full h-full object-cover ${isUntaggedElephant && isTeamAuthor ? 'team-logo-theme-aware' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-[#062E22] dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {bilingualName || (isTeamAuthor ? 'Ali Media' : (post.authorName || 'Community'))}
                        </h4>
                        {isTeamAuthor && !bilingualName && <VerifiedBadge size={18} />}
                        {linkedElephant?.type === 'tusker' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#062E22] text-white">
                            {t.tusker}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        {linkedElephant ? (
                          <>
                            <Building2 className="w-3 h-3 text-[#062E22] dark:text-emerald-400 shrink-0" />
                            <span>{linkedElephant?.organization || linkedElephant?.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
                          </>
                        ) : (
                          <span>{post.authorUsername || (language === 'si' ? 'Community post' : 'Community post')}</span>
                        )}
                        {post.createdAt ? (
                          <span className="text-zinc-400 dark:text-zinc-500 shrink-0">
                            · {formatRelativeTime(post.createdAt, language)}
                          </span>
                        ) : null}
                        {wasPostEdited ? (
                          <span
                            className="text-zinc-400 dark:text-zinc-500 shrink-0 italic"
                            title={
                              language === 'si'
                                ? 'මෙම පෝස්ට් සංස්කරණය කර ඇත'
                                : 'This post was edited'
                            }
                          >
                            · {language === 'si' ? 'සංස්කරණය කළා' : 'edited'}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* Corner Follow Button */}
                  {linkedElephant?.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollowElephant(linkedElephant.id!);
                        onShowNotification?.(
                          isElephantFollowed
                            ? `${bilingualName} Follow ලැයිස්තුවෙන් ඉවත් විය`
                            : `${bilingualName} සාර්ථකව Follow කරන ලදී! ⭐`
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                        isElephantFollowed
                          ? 'bg-white text-black border border-zinc-300 dark:border-white/30 hover:bg-zinc-100'
                          : 'bg-[#062E22] hover:bg-emerald-900 text-white'
                      }`}
                      aria-label={
                        isElephantFollowed
                          ? (language === 'si' ? `${bilingualName} unfollow` : `Unfollow ${bilingualName}`)
                          : (language === 'si' ? `${bilingualName} follow` : `Follow ${bilingualName}`)
                      }
                      aria-pressed={isElephantFollowed}
                    >
                      {isElephantFollowed ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t.following}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t.follow}</span>
                        </>
                      )}
                    </button>
                  )}

                  {(canManagePost || (!!myUid && !isPostOwner)) && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPostMenuId(postMenuId === postId ? null : postId);
                          if (postMenuId !== postId) setReportingPostId(null);
                        }}
                        className="p-1.5 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white transition-colors"
                        title={language === 'si' ? 'විකල්ප' : 'Options'}
                        aria-label={language === 'si' ? 'විකල්ප' : 'Post options'}
                        aria-haspopup="menu"
                        aria-expanded={postMenuId === postId}
                      >
                        <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                      </button>
                      {postMenuId === postId && (
                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
                          {canManagePost && (
                            <>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostMenuId(null);
                                  setDeletePostTarget(null);
                                  if (onEditPost) {
                                    onEditPost(post);
                                  }
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {language === 'si' ? 'සංස්කරණය' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostMenuId(null);
                                  if (onDeletePost) {
                                    onDeletePost(post);
                                  } else {
                                    setDeletePostTarget(post);
                                  }
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {language === 'si' ? 'මකන්න' : 'Delete'}
                              </button>
                            </>
                          )}
                          {!!myUid && !isPostOwner && (
                            reportedPostIds.has(postId) ? (
                              <div className="px-3 py-2.5 text-xs font-bold text-zinc-400 flex items-center gap-2">
                                <Flag className="w-3.5 h-3.5" />
                                {language === 'si' ? 'වාර්තා කළා' : 'Reported'}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportingPostId(reportingPostId === postId ? null : postId);
                                }}
                              >
                                <Flag className="w-3.5 h-3.5" />
                                {language === 'si' ? 'වාර්තා කරන්න' : 'Report post'}
                              </button>
                            )
                          )}
                          {reportingPostId === postId && !reportedPostIds.has(postId) && (
                            <div className="border-t border-zinc-100 dark:border-white/10 p-2 space-y-1 bg-zinc-50 dark:bg-zinc-950/50">
                              {(
                                [
                                  { key: 'harassment' as ReportReason, en: 'Harassment', si: 'හිරිහැර' },
                                  { key: 'spam' as ReportReason, en: 'Spam', si: 'ස්පෑම්' },
                                  { key: 'wrong_id' as ReportReason, en: 'Wrong ID / misinfo', si: 'වැරදි හඳුනාගැනීම' },
                                  { key: 'off_topic' as ReportReason, en: 'Off topic', si: 'මාතෘකාවෙන් බැහැර' },
                                  { key: 'other' as ReportReason, en: 'Other', si: 'වෙනත්' },
                                ] as const
                              ).map(({ key, en, si }) => (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={submittingPostReport}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!user?.uid || user.isAnonymous) {
                                      notify(language === 'si' ? 'පිවිසුම අවශ්‍යයි' : 'Sign in required');
                                      return;
                                    }
                                    setSubmittingPostReport(true);
                                    try {
                                      await reportPost({
                                        postId,
                                        postCaption: post.caption || post.elephantName || '',
                                        postAuthorUid: postAuthorUid,
                                        postAuthorName: post.authorName || 'User',
                                        photoUrl: post.photoUrl,
                                        reportedByUid: user.uid,
                                        reason: key,
                                      });
                                      setReportedPostIds((prev) => new Set(prev).add(postId));
                                      setReportingPostId(null);
                                      setPostMenuId(null);
                                      notify(
                                        language === 'si'
                                          ? 'වාර්තාව ලැබිණ. පරිපාලක තීරණය ගනී. ස්තූතියි!'
                                          : 'Report received. Admin will decide. Thank you!'
                                      );
                                    } catch (err: any) {
                                      notify(
                                        err?.message ||
                                          (language === 'si'
                                            ? 'වාර්තා කිරීම අසාර්ථකයි.'
                                            : 'Could not submit report.')
                                      );
                                    } finally {
                                      setSubmittingPostReport(false);
                                    }
                                  }}
                                >
                                  {submittingPostReport ? '…' : language === 'si' ? si : en}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="w-full text-center px-2 py-1 text-[10px] text-zinc-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportingPostId(null);
                                }}
                              >
                                {language === 'si' ? 'අවලංගු' : 'Cancel'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Photo View — respects 1:1 / 3:4 / 9:16 so full image shows on index */}
                <div
                  onDoubleClick={(e) =>
                    handlePostDoubleClick(
                      e,
                      postId,
                      postLikesMap[postId]?.likesCount ?? post.likesCount ?? 0,
                      true
                    )
                  }
                  onTouchEnd={(e) =>
                    handleTouchEndImage(
                      e,
                      postId,
                      postLikesMap[postId]?.likesCount ?? post.likesCount ?? 0,
                      true
                    )
                  }
                  className={`relative ${aspectClassFor(post.aspectRatio)} max-h-[70vh] rounded-2xl overflow-hidden bg-zinc-900 dark:bg-black cursor-pointer shadow-inner group select-none flex items-center justify-center`}
                >
                  <img
                    src={postPhoto}
                    alt={post.caption || post.elephantName}
                    className="w-full h-full object-contain group-hover:scale-[1.01] transition-transform duration-300 pointer-events-none"
                  />

                  {/* Animated Glowing Elephant Heart on Double Click */}
                  <ElephantHeartPop
                    show={!!heartAnims[postId]?.show}
                    position={heartAnims[postId]?.pos}
                  />

                  {/* Fullscreen Expand Button in bottom corner */}
                  {onSelectPhoto && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPhoto(post.photoUrl);
                      }}
                      className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md active:scale-95 border border-white/20 opacity-80 hover:opacity-100"
                      title={language === 'si' ? 'සම්පූර්ණ ප්‍රමාණයෙන් බලන්න' : 'View Fullscreen'}
                      aria-label={language === 'si' ? 'සම්පූර්ණ ප්‍රමාණයෙන් බලන්න' : 'View fullscreen'}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 3. Action Buttons: INSTAGRAM SIZE LIKE, SHARE, SAVE */}
                <div className="flex items-center justify-between pt-1 px-1">
                  <div className="flex items-center gap-4">
                    {/* LIKE BUTTON */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(postId, postLikesMap[postId]?.likesCount ?? post.likesCount ?? 0, true);
                      }}
                      className="flex items-center gap-2 transition-transform active:scale-125 cursor-pointer text-black dark:text-white"
                      title="Like"
                      aria-label={isLiked ? (language === 'si' ? 'Unlike' : 'Unlike') : (language === 'si' ? 'Like' : 'Like')}
                      aria-pressed={isLiked}
                    >
                      <Heart
                        className={`w-7 h-7 transition-all ${
                          isLiked ? 'fill-red-600 text-red-600' : 'stroke-[1.8] hover:text-[#062E22] dark:hover:text-emerald-400'
                        }`}
                      />
                      <span className="text-sm font-bold tabular-nums">{currentLikes}</span>
                    </button>

                    {/* SHARE BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleShare(linkedElephant?.id || postId, bilingualName, post.caption)}
                      className="transition-transform active:scale-125 cursor-pointer text-black dark:text-white hover:text-[#062E22] dark:hover:text-emerald-400"
                      title={t.sharePost}
                      aria-label={t.sharePost || 'Share'}
                    >
                      <Share2 className="w-6.5 h-6.5 stroke-[1.8]" />
                    </button>
                  </div>

                  {/* SAVE / BOOKMARK BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleBookmark(postId, bilingualName)}
                    className="transition-transform active:scale-125 cursor-pointer text-black dark:text-white hover:text-[#062E22] dark:hover:text-emerald-400"
                    title={t.save}
                    aria-label={isSaved ? (language === 'si' ? 'සුරැකුම ඉවත් කරන්න' : 'Remove bookmark') : (t.save || 'Save')}
                    aria-pressed={isSaved}
                  >
                    <Bookmark
                      className={`w-6.5 h-6.5 ${
                        isSaved ? 'fill-black dark:fill-white text-black dark:text-white' : 'stroke-[1.8]'
                      }`}
                    />
                  </button>
                </div>

                {/* 4. Caption with "See more" & clickable elephant name — follows UI language */}
                {captionText && (
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 px-1 leading-relaxed">
                    {bilingualName ? (
                      <span
                        onClick={() => linkedElephant && onSelectElephant(linkedElephant)}
                        className="font-bold text-[#062E22] dark:text-white mr-1.5 cursor-pointer hover:underline"
                      >
                        {bilingualName}
                      </span>
                    ) : null}
                    <LocalizedBody
                      text={captionText}
                      language={language}
                      expanded={isExpanded}
                      limit={110}
                      onToggle={() => toggleCaption(postId)}
                      seeMoreLabel={t.seeMore}
                      seeLessLabel={t.seeLess}
                    />
                  </div>
                )}

                {/* 5. Author Attribution */}
                <div className="pt-2 border-t border-zinc-100 dark:border-white/10 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-black border border-zinc-300 dark:border-white/20 shrink-0">
                      <img
                        src={authorPhoto}
                        alt={post.authorName || post.authorUsername || 'Author'}
                        className={`w-full h-full object-cover ${(post.authorIsAliMedia || /ali\s*media/i.test(post.authorName || '')) ? 'team-logo-theme-aware' : ''}`}
                      />
                    </div>
                    <span className="truncate flex items-center gap-1">
                      {(post.authorIsAliMedia || /ali\s*media/i.test(post.authorName || '')) ? (
                        <>
                          <span className="font-semibold text-[#062E22] dark:text-emerald-300">Ali Media</span>
                          <VerifiedBadge size={18} />
                        </>
                      ) : (
                        post.authorUsername || post.authorName
                      )}
                    </span>
                  </div>
                </div>

                {/* 6. Comments */}
                <PostComments
                  postId={postId}
                  language={language}
                  onNotify={onShowNotification}
                  forceOpen={focusPostId === postId}
                  highlightCommentId={focusPostId === postId ? (focusCommentId || undefined) : undefined}
                  onFocusHandled={onFocusHandled}
                  isAdmin={isAdminUser || isSuperAdmin}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MAIN ELEPHANT REGISTRY FEED                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {elephants.map((elephant, index) => {
          const elephantId = elephant.id || `el-${index}`;
          const isTusker = elephant.type === 'tusker';
          const effectiveUid = profile?.uid || user?.uid || getEffectiveUid();
          const engagement = elephant.id ? elephantLikesMap[elephant.id] : undefined;
          const isLiked = userLiked[elephantId] !== undefined
            ? userLiked[elephantId]
            : (engagement?.likedBy?.includes(effectiveUid) || false);
          const currentLikes =
            likes[elephantId] !== undefined
              ? likes[elephantId]
              : engagement?.likesCount ?? elephant.likesCount ?? 0;
          const isSaved = !!savedPosts[elephantId];
          const following = elephant.id ? isFollowing(elephant.id) : false;
          const isExpanded = !!expandedCaptions[elephantId];
          const descriptionText = elephant.description || '';
          const bilingualName = formatBilingualElephantName(elephant, language);

          const profileAvatar = getElephantProfilePhoto(elephant);
          const postImage =
            (elephant.photos?.find((p) => typeof p === 'string' && p.trim().length > 0)) ||
            profileAvatar;

          return (
            <div
              key={elephantId}
              className="bg-white dark:bg-black rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200 dark:border-white/10 transition-all space-y-3"
            >
              {/* 1. Header: Elephant Profile Avatar + Name (Click to Profile) + Corner Follow Button */}
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                  title={language === 'si' ? `${bilingualName} ගේ Profile එක බලන්න` : `View ${bilingualName} Profile`}
                >
                  <div className="relative w-10 h-10 rounded-full p-0.5 bg-[#062E22] ring-2 ring-emerald-600/70 shrink-0 group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full overflow-hidden bg-black">
                      <img
                        src={profileAvatar}
                        alt={elephant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-[#062E22] dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {bilingualName}
                      </h3>
                      {elephant.verified && (
                        <span title={t.verifiedBadge} className="shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#062E22] dark:text-emerald-400 fill-emerald-600/20" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#062E22] dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
                    </p>
                  </div>
                </div>

                {/* Corner Follow Button */}
                {elephant.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollowElephant(elephant.id!);
                      onShowNotification?.(
                        following
                          ? `${bilingualName} Follow ලැයිස්තුවෙන් ඉවත් විය`
                          : `${bilingualName} සාර්ථකව Follow කරන ලදී! ⭐`
                      );
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                      following
                        ? 'bg-white text-black border border-zinc-300 dark:border-white/30 hover:bg-zinc-100'
                        : 'bg-[#062E22] hover:bg-emerald-900 text-white'
                    }`}
                  >
                    {following ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t.following}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t.follow}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 2. Photo View with Double Tap/Click to Like + Glowing Elephant Heart */}
              <div
                onDoubleClick={(e) => handlePostDoubleClick(e, elephantId, engagement?.likesCount || 0, false)}
                onTouchEnd={(e) => handleTouchEndImage(e, elephantId, engagement?.likesCount || 0, false)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black cursor-pointer shadow-inner group select-none"
              >
                <img
                  src={postImage}
                  alt={elephant.name}
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300 pointer-events-none"
                />

                {/* Animated Glowing Elephant Heart on Double Click */}
                <ElephantHeartPop
                  show={!!heartAnims[elephantId]?.show}
                  position={heartAnims[elephantId]?.pos}
                />

                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#062E22] text-white shadow-xs">
                    {isTusker ? t.tusker : t.elephant}
                  </span>
                </div>

                {/* Fullscreen Expand Button */}
                {onSelectPhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPhoto(postImage);
                    }}
                    className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md active:scale-95 border border-white/20 opacity-80 hover:opacity-100"
                    title={language === 'si' ? 'සම්පූර්ණ ප්‍රමාණයෙන් බලන්න' : 'View Fullscreen'}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 3. Action Buttons: INSTAGRAM SIZE LIKE, SHARE, SAVE */}
              <div className="flex items-center justify-between pt-1 px-1">
                <div className="flex items-center gap-4">
                  {/* LIKE BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(elephantId, engagement?.likesCount || 0, false);
                    }}
                    className="flex items-center gap-2 transition-transform active:scale-125 cursor-pointer text-black dark:text-white"
                    title="Like"
                  >
                    <Heart
                      className={`w-7 h-7 transition-all ${
                        isLiked ? 'fill-red-600 text-red-600' : 'stroke-[1.8] hover:text-[#062E22] dark:hover:text-emerald-400'
                      }`}
                    />
                    <span className="text-sm font-bold tabular-nums">{currentLikes}</span>
                  </button>

                  {/* SHARE BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleShare(elephantId, bilingualName, elephant.description)}
                    className="transition-transform active:scale-125 cursor-pointer text-black dark:text-white hover:text-[#062E22] dark:hover:text-emerald-400"
                    title={t.sharePost}
                  >
                    <Share2 className="w-6.5 h-6.5 stroke-[1.8]" />
                  </button>
                </div>

                {/* SAVE / BOOKMARK BUTTON */}
                <button
                  type="button"
                  onClick={() => handleBookmark(elephantId, bilingualName)}
                  className="transition-transform active:scale-125 cursor-pointer text-black dark:text-white hover:text-[#062E22] dark:hover:text-emerald-400"
                  title={t.save}
                >
                  <Bookmark
                    className={`w-6.5 h-6.5 ${
                      isSaved ? 'fill-black dark:fill-white text-black dark:text-white' : 'stroke-[1.8]'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Description with "See more" — follows UI language */}
              {descriptionText && (
                <div className="text-xs text-zinc-800 dark:text-zinc-200 px-1 leading-relaxed">
                  <span
                    onClick={() => onSelectElephant(elephant)}
                    className="font-bold text-[#062E22] dark:text-white mr-1.5 cursor-pointer hover:underline"
                  >
                    {bilingualName}
                  </span>
                  <LocalizedBody
                    text={descriptionText}
                    language={language}
                    expanded={isExpanded}
                    limit={120}
                    onToggle={() => toggleCaption(elephantId)}
                    seeMoreLabel={t.seeMore}
                    seeLessLabel={t.seeLess}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* Delete confirmation — bottom bar (edit navigates to dedicated EditPostScreen) */}
      {deletePostTarget && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-1.5rem)] max-w-md animate-fadeIn">
          <div className="rounded-2xl bg-[#062E22] dark:bg-zinc-900 text-white shadow-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-snug">
                {language === 'si' ? 'මෙම පෝස්ට් මකන්නද?' : 'Delete this post?'}
              </p>
              <p className="text-[10px] text-white/70 mt-0.5 truncate">
                {deletePostTarget.caption || deletePostTarget.elephantName || 'Post'}
              </p>
            </div>
            <button
              type="button"
              disabled={postActionBusy}
              onClick={() => { setDeletePostTarget(null); setPostMenuId(null); }}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/15 hover:bg-white/25"
            >
              {language === 'si' ? 'අවලංගු' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={postActionBusy}
              onClick={async () => {
                if (!deletePostTarget?.id) return;
                if (!user?.uid || user.isAnonymous) {
                  onShowNotification?.(language === 'si' ? 'පිවිසීම අවශ්‍යයි' : 'Sign in required');
                  return;
                }
                setPostActionBusy(true);
                try {
                  await deleteElephantPost(deletePostTarget.id);
                  setDeletePostTarget(null);
                  setPostMenuId(null);
                  onShowNotification?.(
                    language === 'si' ? 'පෝස්ට් මකා දමන ලදී' : 'Post deleted'
                  );
                } catch (err: any) {
                  console.error('Delete post failed', err);
                  onShowNotification?.(err?.message || 'Delete failed');
                } finally {
                  setPostActionBusy(false);
                }
              }}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50"
            >
              {postActionBusy ? '…' : (language === 'si' ? 'මකන්න' : 'Delete')}
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. FULLSCREEN STORY VIEWER MODAL                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeStoryViewer !== null && (
        <StoryViewerModal
          storyGroups={activeStoryViewer.groups}
          initialGroupIndex={activeStoryViewer.initialIndex}
          language={language}
          onClose={() => {
            setActiveStoryViewer(null);
            refreshViewedState();
          }}
          onSelectElephant={(el) => {
            setActiveStoryViewer(null);
            refreshViewedState();
            onSelectElephant(el);
          }}
          onShowNotification={showNotificationFallback}
          onMarkStoryViewed={handleMarkStoryViewed}
        />
      )}

    </div>
  );

  function showNotificationFallback(msg: string) {
    if (onShowNotification) onShowNotification(msg);
  }
};
