import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Elephant, CulturalEvent, ElephantPost } from './types/elephant';
import {
  getElephants,
  addElephant,
  updateElephant,
  deleteElephant,
  deleteElephantCascade,
  toggleElephantVerification,
  toggleElephantFeatured,
  toggleElephantLive,
  getCulturalEvents,
  addCulturalEvent,
  updateCulturalEvent,
  deleteCulturalEvent,
} from './firebase/elephantService';
import { getAllElephantPosts, purgeExpiredStories, isWithin24Hours } from './firebase/postService';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { DiscoverFeed } from './components/DiscoverFeed';
import { PhotoLightbox } from './components/PhotoLightbox';

// Route-level code-splitting: these screens/modals are not needed for the initial
// paint (default tab is 'home' -> DiscoverFeed above), so each becomes its own
// chunk that only downloads when the user actually navigates to it. Named exports
// are re-wrapped as a default export, which is what React.lazy requires.
const ElephantDirectory = lazy(() =>
  import('./components/ElephantDirectory').then((m) => ({ default: m.ElephantDirectory }))
);
const ElephantProfileScreen = lazy(() =>
  import('./components/ElephantProfileScreen').then((m) => ({ default: m.ElephantProfileScreen }))
);
const UserProfileScreen = lazy(() =>
  import('./components/UserProfileScreen').then((m) => ({ default: m.UserProfileScreen }))
);
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);
const ResetPasswordScreen = lazy(() =>
  import('./components/ResetPasswordScreen').then((m) => ({ default: m.ResetPasswordScreen }))
);
const CreatePostModal = lazy(() =>
  import('./components/CreatePostModal').then((m) => ({ default: m.CreatePostModal }))
);
const EditPostScreen = lazy(() =>
  import('./components/EditPostScreen').then((m) => ({ default: m.EditPostScreen }))
);
const DeletePostScreen = lazy(() =>
  import('./components/DeletePostScreen').then((m) => ({ default: m.DeletePostScreen }))
);
const SharedProfileGate = lazy(() =>
  import('./components/SharedProfileGate').then((m) => ({ default: m.SharedProfileGate }))
);
import { Language, translations } from './utils/translations';
import { resolveAge } from './utils/ageCalculator';
import { TranslatedText } from './components/TranslatedText';
import { CheckCircle2, Calendar, MapPin, Crown, Radio, MessageCircle, AtSign } from 'lucide-react';
import {
  subscribeToUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  type UserNotification,
} from './firebase/commentService';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase/config';
import { startPresenceHeartbeat } from './firebase/presenceService';
import { useAuth } from './firebase/authContext';
import { OfflineBanner } from './components/OfflineBanner';

// Shared fallback while a lazy-loaded screen/modal chunk is downloading.
const ScreenFallback = () => (
  <div className="flex flex-col items-center justify-center py-24 space-y-3">
    <div className="w-10 h-10 border-3 border-emerald-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

const getNotificationTypeLabel = (type: string, lang: 'si' | 'en') => {
  const labels: Record<string, { si: string; en: string }> = {
    perahera: { si: 'පෙරහැර මංගල්‍ය', en: 'Perahera' },
    ceremony: { si: 'සංස්කෘතික උත්සව', en: 'Ceremony' },
    conservation: { si: 'සංරක්ෂණ තොරතුරු', en: 'Conservation' },
    general: { si: 'පොදු නිවේදනයක්', en: 'General' },
    update: { si: 'යාවත්කාලීන කිරීමක්', en: 'Platform Update' },
    alert: { si: 'හදිසි නිවේදනයක්', en: 'Urgent Alert' },
    news: { si: 'පුවත් හා වාර්තා', en: 'Latest News' },
    other: { si: 'වෙනත් නිවේදනයක්', en: 'Notice' },
  };
  return labels[type]?.[lang] || labels['other'][lang];
};

const getNotificationTypeStyles = (type: string) => {
  const styles: Record<string, string> = {
    perahera: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300/40',
    ceremony: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border-indigo-300/40',
    conservation: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300/40',
    general: 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-300 border-zinc-300/40',
    update: 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border-blue-300/40',
    alert: 'bg-red-100 dark:bg-red-950/60 text-red-900 dark:text-red-300 border-red-300/40 animate-pulse',
    news: 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-300/40',
    other: 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-300 border-zinc-300/40',
  };
  return styles[type] || styles['other'];
};

export default function App() {
  // Real database data only. LocalStorage is used purely as an offline cache of the
  // last real Realtime Database snapshot - it is never seeded with placeholder/demo data.
  const [elephants, setElephants] = useState<Elephant[]>(() => {
    try {
      const cached = localStorage.getItem('alimedia_cached_elephants');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [events, setEvents] = useState<CulturalEvent[]>(() => {
    try {
      const cached = localStorage.getItem('alimedia_cached_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [posts, setPosts] = useState<ElephantPost[]>(() => {
    try {
      const cached = localStorage.getItem('alimedia_cached_posts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'home' | 'elephant' | 'notifications' | 'profile' | 'messages'
  // 'messages' = replies/mentions only (not shown on Notices). Opened from Profile → Settings.
  const [currentTab, setCurrentTab] = useState<'home' | 'elephant' | 'notifications' | 'profile' | 'messages'>('home');
  const [selectedElephant, setSelectedElephant] = useState<Elephant | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false);
  const [createPostElephantId, setCreatePostElephantId] = useState<string | undefined>(undefined);
  const [isCreatePostStoryOnly, setIsCreatePostStoryOnly] = useState<boolean>(false);
  /** When set, main content shows the dedicated Edit Post screen instead of the feed. */
  const [editingPost, setEditingPost] = useState<ElephantPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<ElephantPost | null>(null);
  /** Post + comment to scroll to & highlight when arriving from a notification */
  const [commentFocus, setCommentFocus] = useState<{ postId: string; commentId?: string } | null>(null);
  /** Cultural notices only (Megaphone tab) — personal messages never affect this. */
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);
  const [userNotifs, setUserNotifs] = useState<UserNotification[]>([]);
  const [hasUnreadUserNotifs, setHasUnreadUserNotifs] = useState(false);
  const knownUserNotifIdsRef = useRef<Set<string> | null>(null);
  const [lastViewedNotifications, setLastViewedNotifications] = useState<number>(() => {
    try {
      const s = localStorage.getItem('alimedia_last_viewed_notifications');
      return s ? parseInt(s, 10) : 0;
    } catch {
      return 0;
    }
  });
  /** Notification cards with description expanded (Read more) */
  const [expandedNotifIds, setExpandedNotifIds] = useState<Set<string>>(new Set());

  const toggleNotifExpanded = (id: string) => {
    setExpandedNotifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-select English language by default, with localStorage persistence
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('alimedia_lang');
      if (saved === 'en' || saved === 'si') return saved;
    } catch {}
    return 'en'; // Default auto-selected language is English
  });

  const [notification, setNotification] = useState<string | null>(null);
  // Tracks which "clear" timer is the current/latest one, so an older
  // toast's timeout can't wipe out a newer toast that replaced it before
  // the old timer fired.
  const notificationTokenRef = useRef(0);
  const showToast = useCallback((msg: string, durationMs: number = 3500) => {
    const token = ++notificationTokenRef.current;
    setNotification(msg);
    setTimeout(() => {
      if (notificationTokenRef.current === token) {
        setNotification(null);
      }
    }, durationMs);
  }, []);

  // Light / Dark Mode State: Defaults to Light mode (false), persists in localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alimedia_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return false; // Default to Light mode
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('alimedia_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('alimedia_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = (e?: React.MouseEvent) => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      // Find origin near top-right toggle or click position
      const x = e?.clientX ?? (window.innerWidth - 45);
      const y = e?.clientY ?? 45;
      
      // Calculate max radius to cover screen down to bottom-left
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const isGoingDark = !darkMode;

      const transition = (document as any).startViewTransition(() => {
        setDarkMode(isGoingDark);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius * 1.05}px at ${x}px ${y}px)`
            ],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.25, 1, 0.4, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      }).catch(() => {
        // Fallback safely if animation fails
      });
    } else {
      setDarkMode((prev) => !prev);
    }
  };

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next: Language = prev === 'si' ? 'en' : 'si';
      try {
        localStorage.setItem('alimedia_lang', next);
      } catch {}
      return next;
    });
  };

  const showNotification = (msg: string) => {
    showToast(msg, 3500);
  };

  const { user, profile } = useAuth();

  // Foreground FCM push messages (tab open + focused). Background/closed-tab
  // notifications are shown by the service worker (public/firebase-messaging-sw.js) instead.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    import('./firebase/messaging').then(({ subscribeToForegroundPush }) => {
      subscribeToForegroundPush((title, body) => {
        showNotification(body ? `${title}: ${body}` : title);
      }).then((fn) => {
        if (cancelled) fn();
        else unsub = fn;
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Personal reply / mention notifications — separate from Notices page.
  // New items also fire a browser Notification when permission is granted.
  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setUserNotifs([]);
      setHasUnreadUserNotifs(false);
      knownUserNotifIdsRef.current = null;
      return;
    }
    const unsub = subscribeToUserNotifications(user.uid, (items) => {
      setUserNotifs(items);
      setHasUnreadUserNotifs(items.some((n) => !n.read));

      const known = knownUserNotifIdsRef.current;
      if (known === null) {
        knownUserNotifIdsRef.current = new Set(items.map((n) => n.id));
        return;
      }
      const fresh = items.filter((n) => n.id && !known.has(n.id));
      for (const n of fresh) {
        known.add(n.id);
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const title =
              n.type === 'reply'
                ? 'AliMedia · Reply'
                : n.type === 'mention'
                  ? 'AliMedia · Mention'
                  : 'AliMedia · Message';
            new Notification(title, {
              body: n.text || (n.fromName ? `${n.fromName}` : 'New activity'),
              icon: '/icons/icon-192.png',
              tag: `msg-${n.id}`,
            });
          }
        } catch {
          /* ignore */
        }
      }
    });
    return () => unsub();
  }, [user?.uid, user?.isAnonymous]);

  // Start tracking presence in real-time. Depends on user?.uid too so the
  // heartbeat (re)starts once anonymous/real Firebase Auth resolves —
  // presence writes are now keyed to auth.uid (see presenceService.ts).
  useEffect(() => {
    const unsub = startPresenceHeartbeat(profile?.displayName, profile?.email || 'Guest');
    return unsub;
  }, [profile?.displayName, profile?.email, user?.uid]);

  // Real-time listener for elephants registry
  useEffect(() => {
    const elephantsRef = ref(db, 'elephants');
    const unsub = onValue(elephantsRef, (snap) => {
      const list: Elephant[] = [];
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          const rawPhotos: string[] = Array.isArray(data.photos) ? data.photos : [];
          const rawCloudinary: { url: string; publicId: string }[] = Array.isArray(data.cloudinaryPhotos)
            ? data.cloudinaryPhotos
            : [];
          
          const finalPhotos = rawPhotos.length > 0
            ? rawPhotos
            : rawCloudinary.map((cp) => (typeof cp === 'string' ? cp : cp?.url)).filter(Boolean);

          const finalCloudinary = rawCloudinary.length > 0
            ? rawCloudinary
            : finalPhotos.map((p) => ({ url: p, publicId: '' }));

          list.push({
            id,
            name: data.name || 'Unnamed Elephant',
            sinhalaName: data.sinhalaName || '',
            otherNames: Array.isArray(data.otherNames) ? data.otherNames : [],
            gender: data.gender || 'male',
            type: data.type || 'elephant',
            dateOfBirth: data.dateOfBirth || '',
            age: resolveAge(data.dateOfBirth, data.age, { status: data.status || 'living', dateOfDeath: data.dateOfDeath || '' }),
            dateOfDeath: data.dateOfDeath || '',
            location: data.location || '',
            organization: data.organization || '',
            mahout: data.mahout || '',
            tusks: data.tusks || '',
            physicalCharacteristics: data.physicalCharacteristics || '',
            description: data.description || '',
            peraheraParticipation: Array.isArray(data.peraheraParticipation) ? data.peraheraParticipation : [],
            photos: finalPhotos,
            profilePhoto: typeof data.profilePhoto === 'string' ? data.profilePhoto.trim() : '',
            cloudinaryPhotos: finalCloudinary,
            sources: Array.isArray(data.sources) ? data.sources : [],
            verified: !!data.verified,
            status: data.status || 'living',
            isFeatured: !!data.isFeatured,
            isLive: !!data.isLive,
            liveStreamUrl: data.liveStreamUrl || '',
            customBadge: data.customBadge || '',
            followerCount: data.followerCount || 0,
          });
        }
      }
      // Always mirror exactly what's in Realtime Database, including an empty registry -
      // never keep showing stale/cached elephants once the database changes.
      setElephants(list);
      try {
        localStorage.setItem('alimedia_cached_elephants', JSON.stringify(list));
      } catch {}
    }, (err) => {
      console.warn('Real-time elephants subscription notice:', err);
    });
    return unsub;
  }, []);

  // Real-time listener for community posts
  useEffect(() => {
    const postsRef = ref(db, 'elephant_posts');
    const unsub = onValue(postsRef, (snap) => {
      const list: ElephantPost[] = [];
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          list.push({
            id,
            elephantId: data.elephantId,
            elephantName: data.elephantName || '',
            elephantSinhalaName: data.elephantSinhalaName || '',
            photoUrl: data.photoUrl,
            caption: data.caption || '',
            authorUid: data.authorUid || '',
            authorName: data.authorName || 'Anonymous',
            authorUsername: data.authorUsername || '@user',
            authorPhotoURL: data.authorPhotoURL || '',
            authorIsAliMedia: !!data.authorIsAliMedia,
            likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
            likesCount:
              typeof data.likesCount === 'number'
                ? data.likesCount
                : Array.isArray(data.likedBy)
                  ? data.likedBy.length
                  : 0,
            isStory: data.isStory !== undefined ? data.isStory : true,
            isStoryOnly: !!data.isStoryOnly,
            aspectRatio: data.aspectRatio || undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        }
      }
      // Hide expired story-only posts in UI; purge will delete them from DB
      const visible = list.filter((p) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
      // Sort by createdAt descending
      visible.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.parse(a.createdAt as string) || 0));
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.parse(b.createdAt as string) || 0));
        return timeB - timeA;
      });
      setPosts(visible);
      try {
        localStorage.setItem('alimedia_cached_posts', JSON.stringify(visible));
      } catch {}
    }, (err) => {
      console.warn('Real-time posts subscription notice:', err);
    });
    // Auto-delete story-only posts older than 24 hours
    purgeExpiredStories().catch(() => {});
    const purgeTimer = window.setInterval(() => {
      purgeExpiredStories().catch(() => {});
    }, 5 * 60 * 1000);
    return () => {
      unsub();
      window.clearInterval(purgeTimer);
    };
  }, []);

  // Track known event IDs so we can toast + browser-notify on brand-new admin pushes
  const knownEventIdsRef = useRef<Set<string> | null>(null);
  const knownLiveIdsRef = useRef<Set<string>>(new Set());
  const eventsBootstrapDoneRef = useRef(false);

  // Real-time listener for cultural events and notifications
  useEffect(() => {
    const eventsRef = ref(db, 'cultural_events');
    const unsub = onValue(eventsRef, (snap) => {
      const list: CulturalEvent[] = [];
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          list.push({
            id,
            title: data.title || '',
            sinhalaTitle: data.sinhalaTitle || '',
            description: data.description || '',
            location: data.location || '',
            date: data.date || '',
            type: data.type || 'perahera',
            participatingElephants: Array.isArray(data.participatingElephants) ? data.participatingElephants : [],
            isActive: data.isActive !== undefined ? data.isActive : true,
            coverImage: data.coverImage || '',
            isLive: !!data.isLive,
            liveStreamUrl: data.liveStreamUrl || '',
            likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
            likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        }
      }

      // Sort by createdAt / updatedAt descending
      list.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.parse(a.createdAt) || 0));
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.parse(b.createdAt) || 0));
        return timeB - timeA;
      });

      // Detect newly published notices / live sessions after first snapshot
      if (eventsBootstrapDoneRef.current && knownEventIdsRef.current) {
        const prev = knownEventIdsRef.current;
        const prevLive = knownLiveIdsRef.current;
        const newcomers = list.filter((ev) => ev.id && !prev.has(ev.id));
        newcomers.forEach((ev) => {
          const title = language === 'si' && ev.sinhalaTitle ? ev.sinhalaTitle : ev.title;
          const isLiveEv = !!ev.isLive;
          const toastMsg = isLiveEv
            ? (language === 'si' ? `🔴 LIVE: ${title}` : `🔴 LIVE now: ${title}`)
            : (language === 'si' ? `📢 නව නිවේදනය: ${title}` : `📢 New notice: ${title}`);
          showToast(toastMsg, 4500);

          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(isLiveEv ? 'AliMedia · LIVE' : 'AliMedia · Notice', {
                body: title,
                icon: '/favicon.ico',
                tag: ev.id || title,
              });
            }
          } catch {}
        });
        // Existing event flipped to LIVE → toast + pin
        list.forEach((ev) => {
          if (!ev.id || !ev.isLive) return;
          if (prev.has(ev.id) && !prevLive.has(ev.id)) {
            const title = language === 'si' && ev.sinhalaTitle ? ev.sinhalaTitle : ev.title;
            const toastMsg = language === 'si' ? `🔴 LIVE ආරම්භ විය: ${title}` : `🔴 Live started: ${title}`;
            showToast(toastMsg, 4500);
            try {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('AliMedia · LIVE', {
                  body: title,
                  icon: '/favicon.ico',
                  tag: `live-${ev.id}`,
                });
              }
            } catch {}
          }
        });
      }

      knownEventIdsRef.current = new Set(list.map((e) => e.id!).filter(Boolean));
      knownLiveIdsRef.current = new Set(
        list.filter((e) => e.id && e.isLive).map((e) => e.id!)
      );
      eventsBootstrapDoneRef.current = true;

      setEvents(list);
      try {
        localStorage.setItem('alimedia_cached_events', JSON.stringify(list));
      } catch {}

      // Calculate if there are unread notifications (new notices since last visit)
      const lastViewedStr = localStorage.getItem('alimedia_last_viewed_notifications');
      const lastViewed = lastViewedStr ? parseInt(lastViewedStr, 10) : 0;
      setLastViewedNotifications(lastViewed);

      const hasUnread = list.some((ev) => {
        const evTime =
          typeof ev.createdAt === 'number'
            ? ev.createdAt
            : ev.createdAt?.toMillis?.() ||
              (ev.createdAt?.seconds ? ev.createdAt.seconds * 1000 : Date.parse(String(ev.createdAt)) || 0);
        return evTime > lastViewed;
      });

      setHasNewNotifications(hasUnread);
    }, (err) => {
      console.warn('Real-time events subscription notice:', err);
    });
    return unsub;
  }, [language]);

  // Mark cultural Notices as read when Notices tab is selected
  useEffect(() => {
    if (currentTab === 'notifications') {
      const now = Date.now();
      localStorage.setItem('alimedia_last_viewed_notifications', now.toString());
      setLastViewedNotifications(now);
      setHasNewNotifications(false);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      } catch {}
    }
  }, [currentTab]);

  // Mark personal message notifications as read only on the Messages page
  useEffect(() => {
    if (currentTab === 'messages' && user?.uid && !user.isAnonymous) {
      markAllUserNotificationsRead(user.uid).catch(() => {});
      setHasUnreadUserNotifs(false);
    }
  }, [currentTab, user?.uid, user?.isAnonymous]);

  // Handle URL hash changes or routing
  // Shared cards use #e/{id} — opening that link requires Google sign-in to view full profile
  useEffect(() => {
    const handleHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const hash = raw.toLowerCase();
      if (hash === 'elephant' || hash === 'elephants') {
        setCurrentTab('elephant');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'home') {
        setCurrentTab('home');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'profile') {
        setCurrentTab('profile');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'admin') {
        setIsAdminOpen(true);
      } else if (hash === 'notifications') {
        setCurrentTab('notifications');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'messages') {
        setCurrentTab('messages');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash && elephants.length > 0) {
        // Support #e/{id}, #e/{name}, or legacy #{id}
        let key = raw;
        if (hash.startsWith('e/')) {
          key = decodeURIComponent(raw.slice(2));
        }
        const keyLower = key.toLowerCase();
        const found = elephants.find(
          (e) =>
            e.id === key ||
            e.id?.toLowerCase() === keyLower ||
            e.name.toLowerCase() === keyLower
        );
        if (found) {
          setSelectedElephant(found);
          setIsAdminOpen(false);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [elephants]);

  const handleSelectElephant = (elephant: Elephant) => {
    setSelectedElephant(elephant);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (elephant.id) {
      // Deep-link format used by shared registry cards
      window.location.hash = `e/${elephant.id}`;
    }
  };

  const isSignedInMember = !!(profile && user && !user.isAnonymous);

  const handleBackToDirectory = () => {
    setSelectedElephant(null);
    if (window.location.hash) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  };

  const handleTabChange = (tab: 'home' | 'elephant' | 'notifications' | 'profile' | 'messages') => {
    setSelectedElephant(null);
    setIsAdminOpen(false);
    setEditingPost(null);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'elephant') {
      window.location.hash = 'elephant';
    } else if (tab === 'home') {
      window.location.hash = 'home';
    } else if (tab === 'profile') {
      window.location.hash = 'profile';
    } else if (tab === 'notifications') {
      window.location.hash = 'notifications';
    } else if (tab === 'messages') {
      window.location.hash = 'messages';
    }
  };

  const handleOpenEditPost = (post: ElephantPost) => {
    setEditingPost(post);
    setSelectedElephant(null);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseEditPost = () => {
    setEditingPost(null);
  };

  const handleOpenDeletePost = (post: ElephantPost) => {
    setDeletingPost(post);
    setSelectedElephant(null);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseDeletePost = () => {
    setDeletingPost(null);
  };

  /** User tapped a reply/mention notification — jump to that post & highlight the comment */
  const handleOpenUserNotification = (n: UserNotification) => {
    if (user?.uid && !n.read) {
      markUserNotificationRead(user.uid, n.id).catch(() => {});
    }
    if (!n.postId) return;
    setEditingPost(null);
    setDeletingPost(null);
    setSelectedElephant(null);
    setIsAdminOpen(false);
    setCommentFocus({ postId: n.postId, commentId: n.commentId });
    setCurrentTab('home');
    window.location.hash = 'home';
  };

  // Open Create Post Modal
  const handleOpenCreatePost = (elephantId?: string, isStoryOnly: boolean = false) => {
    setCreatePostElephantId(elephantId);
    setIsCreatePostStoryOnly(isStoryOnly);
    setIsCreatePostOpen(true);
  };

  const handlePostSuccess = async (newPost: ElephantPost, updatedElephantId?: string) => {
    setIsCreatePostOpen(false);
    showNotification(
      newPost.isStoryOnly
        ? (language === 'si' ? 'Story එක සාර්ථකව පළ කෙරිණි!' : 'Story published successfully!')
        : (language === 'si' ? 'ඡායාරූපය සාර්ථකව පළ කෙරිණි!' : 'Post published successfully!')
    );

    // Optimistically insert post immediately so it instantly appears in stories tray & feed
    setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
    
    // Refresh posts & elephants in background
    try {
      const [freshPosts, freshElephants] = await Promise.all([
        getAllElephantPosts(),
        getElephants()
      ]);
      setPosts(freshPosts);
      setElephants(freshElephants);

      if (updatedElephantId) {
        const refreshedElephant = freshElephants.find((e) => e.id === updatedElephantId);
        if (refreshedElephant && selectedElephant?.id === updatedElephantId) {
          setSelectedElephant(refreshedElephant);
        }
      }
    } catch {
      // Retain optimistic update
    }
  };

  // -------------------------------------------------------------
  // Elephant CRUD Handlers (Admin)
  // -------------------------------------------------------------

  const handleSaveElephant = async (
    elephantData: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
    skipRefresh?: boolean
  ) => {
    if (elephantData && elephantData.name === '__REFRESH__') {
      const fresh = await getElephants();
      setElephants(fresh);
      return;
    }

    try {
      if (id) {
        // Save to Realtime Database first
        await updateElephant(id, elephantData);

        // Update local state on success
        const updatedObj: Elephant = {
          ...elephantData,
          id,
          updatedAt: new Date(),
        };

        setElephants((prev) =>
          prev.map((el) => (el.id === id ? updatedObj : el))
        );

        if (selectedElephant && selectedElephant.id === id) {
          setSelectedElephant(updatedObj);
        }

        if (!skipRefresh) {
          showNotification(`${elephantData.name} යාවත්කාලීන කෙරිණි!`);
        }
      } else {
        // Save to Realtime Database first
        const realId = await addElephant(elephantData);

        // Update local state on success
        const newElephant: Elephant = {
          ...elephantData,
          id: realId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setElephants((prev) => [newElephant, ...prev]);

        if (!skipRefresh) {
          showNotification(`${elephantData.name} ලියාපදිංචි කෙරිණි!`);
        }
      }

      if (!skipRefresh) {
        // Background cache sync
        getElephants().then((fresh) => {
          if (fresh && fresh.length > 0) {
            setElephants(fresh);
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to save elephant:', error);
      throw error; // Propagate error to caller (AdminPanel) so it can reset loading states and show useful messages
    }
  };

  const handleDeleteElephant = async (id: string, name?: string, sinhalaName?: string) => {
    const result = await deleteElephantCascade(id, name, sinhalaName);
    showNotification(
      language === 'si'
        ? `${result.deletedElephantName} සහ සම්බන්ධිත සියලු දත්ත (${result.postsDeleted} posts) සම්පූර්ණයෙන්ම ඉවත් කෙරිණි.`
        : `${result.deletedElephantName} and all connected data (${result.postsDeleted} posts) permanently removed.`
    );
    if (selectedElephant?.id === id) {
      setSelectedElephant(null);
    }
    const [freshElephants, freshPosts, freshEvents] = await Promise.all([
      getElephants(),
      getAllElephantPosts(),
      getCulturalEvents()
    ]);
    setElephants(freshElephants);
    setPosts(freshPosts);
    setEvents(freshEvents);
    return result;
  };

  const handleToggleVerification = async (id: string, verified: boolean) => {
    await toggleElephantVerification(id, verified);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, verified });
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    await toggleElephantFeatured(id, isFeatured);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, isFeatured });
    }
  };

  const handleToggleLive = async (id: string, isLive: boolean) => {
    await toggleElephantLive(id, isLive);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, isLive });
    }
  };

  // -------------------------------------------------------------
  // Cultural Events CRUD Handlers
  // -------------------------------------------------------------

  const handleSaveEvent = async (
    eventData: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    if (id) {
      await updateCulturalEvent(id, eventData);
      showNotification('පෙරහැර නිවේදනය යාවත්කාලීන විය!');
    } else {
      await addCulturalEvent(eventData);
      showNotification('නව පෙරහැර නිවේදනයක් පළ කෙරිණි!');
    }
    const freshEvents = await getCulturalEvents();
    setEvents(freshEvents);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteCulturalEvent(id);
    showNotification('නිවේදනය ඉවත් කරන ලදී.');
    const freshEvents = await getCulturalEvents();
    setEvents(freshEvents);
  };

  // Password reset links (from api/send-password-reset.js) land here with
  // ?mode=resetPassword&oobCode=... attached. Intercept before anything else
  // renders and show our own branded reset UI instead of the normal app.
  const resetParams = new URLSearchParams(window.location.search);
  if (resetParams.get('mode') === 'resetPassword' && resetParams.get('oobCode')) {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <ResetPasswordScreen oobCode={resetParams.get('oobCode') as string} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col font-sans antialiased selection:bg-emerald-900 transition-colors">
      <OfflineBanner language={language === 'si' ? 'si' : 'en'} />
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#062E22] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-white/15">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        language={language}
        onToggleLanguage={toggleLanguage}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        hasNewNotifications={hasNewNotifications}
        hasUnreadMessages={hasUnreadUserNotifs}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-emerald-900/80 dark:text-emerald-300">
              {language === 'si' ? 'හීලෑ අලි වාර්තා පූරණය වෙමින් පවතී...' : 'Loading verified elephant registry...'}
            </p>
          </div>
        ) : (
        <Suspense fallback={<ScreenFallback />}>
        {editingPost ? (
          <EditPostScreen
            post={editingPost}
            language={language}
            onBack={handleCloseEditPost}
            onShowNotification={showNotification}
            onSaved={(updated) => {
              setPosts((prev) =>
                prev.map((p) => (p.id && updated.id && p.id === updated.id ? { ...p, ...updated } : p))
              );
              setEditingPost(null);
            }}
          />
        ) : deletingPost ? (
          <DeletePostScreen
            post={deletingPost}
            language={language}
            onBack={handleCloseDeletePost}
            onShowNotification={showNotification}
            onDeleted={(deletedId) => {
              setPosts((prev) => prev.filter((p) => p.id !== deletedId));
              setDeletingPost(null);
            }}
          />
        ) : selectedElephant ? (
          /* Shared / profile view — full content requires Google sign-in */
          isSignedInMember ? (
            <ElephantProfileScreen
              elephant={selectedElephant}
              communityPosts={posts}
              language={language}
              onBack={handleBackToDirectory}
              onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
              onOpenCreatePost={(id) => handleOpenCreatePost(id)}
            />
          ) : (
            <SharedProfileGate
              elephant={selectedElephant}
              language={language}
              onBack={handleBackToDirectory}
            />
          )
        ) : currentTab === 'home' ? (
          /* SCREEN 1: /home Discover tab matching Instagram-style discover */
          <DiscoverFeed
            elephants={elephants}
            posts={posts}
            events={events}
            language={language}
            onSelectElephant={handleSelectElephant}
            onOpenCreatePost={(id, isStoryOnly) => handleOpenCreatePost(id, isStoryOnly)}
            onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
            onShowNotification={showNotification}
            onOpenDirectory={() => handleTabChange('elephant')}
            onEditPost={handleOpenEditPost}
            onDeletePost={handleOpenDeletePost}
            focusPostId={commentFocus?.postId || null}
            focusCommentId={commentFocus?.commentId || null}
            onFocusHandled={() => setCommentFocus(null)}
          />
        ) : currentTab === 'elephant' ? (
          /* /Elephant tab: Trending spotlight (Top 2 followed + Top 2 liked) + directory */
          <ElephantDirectory
            elephants={elephants}
            posts={posts}
            language={language}
            onSelectElephant={handleSelectElephant}
            onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
            onShowNotification={showNotification}
          />
        ) : currentTab === 'profile' ? (
          /* User Profile Screen with Google Sign-in and Followed Elephants */
          <UserProfileScreen
            elephants={elephants}
            posts={posts}
            language={language}
            onSelectElephant={handleSelectElephant}
            onOpenDirectory={() => handleTabChange('elephant')}
            onShowNotification={showNotification}
            onOpenMessages={() => handleTabChange('messages')}
            hasUnreadMessages={hasUnreadUserNotifs}
          />
        ) : currentTab === 'messages' ? (
          /* Messages page: replies & mentions only (not mixed into Notices) */
          <div className="space-y-4 py-3 pb-24 animate-fadeIn">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTabChange('profile')}
                className="text-xs font-bold text-[#062E22] dark:text-emerald-300 hover:underline cursor-pointer"
              >
                ← {language === 'si' ? 'Profile' : 'Profile'}
              </button>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#062E22] dark:text-emerald-200">
                {language === 'si' ? 'පණිවිඩ හා mentions' : 'Messages & mentions'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {language === 'si'
                  ? 'පිළිතුරු සහ @mentions — Notices පිටුවෙන් වෙන්ව. Browser දැනුම්දීම්ද ලැබේ.'
                  : 'Replies and @mentions — separate from Notices. Browser notifications are also sent.'}
              </p>
            </div>
            {!user?.uid || user.isAnonymous ? (
              <div className="text-center py-12 bg-white dark:bg-[#121F1B] rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-6">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {language === 'si'
                    ? 'පණිවිඩ බැලීමට පිවිසෙන්න.'
                    : 'Sign in to see your message notifications.'}
                </p>
              </div>
            ) : userNotifs.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#121F1B] rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-6">
                <MessageCircle className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {language === 'si'
                    ? 'පිළිතුරු හෝ @mention තවම නැත.'
                    : 'No replies or mentions yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {userNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-3.5 flex gap-3 items-start cursor-pointer transition-colors ${
                      n.read
                        ? 'bg-white dark:bg-black border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                    }`}
                    onClick={() => handleOpenUserNotification(n)}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        n.type === 'reply'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {n.type === 'reply' ? (
                        <MessageCircle className="w-4 h-4" />
                      ) : (
                        <AtSign className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                          {n.type === 'reply'
                            ? language === 'si'
                              ? 'පිළිතුර'
                              : 'Reply'
                            : language === 'si'
                              ? 'Mention'
                              : 'Mention'}
                        </span>
                        {!n.read && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white">
                            {language === 'si' ? 'නව' : 'New'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#062E22] dark:text-zinc-200 leading-relaxed break-words">
                        {n.text}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {n.fromName ? `${n.fromName} · ` : ''}
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString(
                              language === 'si' ? 'si-LK' : 'en-US',
                              { dateStyle: 'medium', timeStyle: 'short' }
                            )
                          : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentTab === 'notifications' ? (
          /* Notices tab: cultural events only — message notifs live on Messages page */
          <div className="space-y-4 py-3 pb-24 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-[#062E22] dark:text-emerald-200">
                  {language === 'si' ? 'නිවේදන, පුවත් සහ උත්සව' : 'Notices, News & Festivals'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {language === 'si' ? 'අලි ඇතුන් පිළිබඳ පුවත්, යාවත්කාලීන කිරීම් සහ පෙරහැර කාලසටහන' : 'Platform updates, news and cultural event calendars'}
                </p>
              </div>
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#121F1B] rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-6">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {language === 'si' ? 'තවමත් කිසිදු නිවේදනයක් පළ කර නොමැත.' : 'No announcements or notices available yet.'}
                  </p>
                </div>
              ) : (
                events.map((ev) => {
                  const evTime =
                    typeof ev.createdAt === 'number'
                      ? ev.createdAt
                      : (ev.createdAt as any)?.toMillis?.() ||
                        ((ev.createdAt as any)?.seconds ? (ev.createdAt as any).seconds * 1000 : Date.parse(String(ev.createdAt)) || 0);
                  const isUnread = evTime > lastViewedNotifications;
                  return (
                  <div
                    key={ev.id || ev.title}
                    className={`bg-white dark:bg-[#121F1B] rounded-3xl border shadow-2xs hover:shadow-sm transition-all overflow-hidden flex flex-col ${
                      isUnread
                        ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-300/50 dark:ring-emerald-600/40'
                        : 'border-zinc-200 dark:border-emerald-950/70'
                    }`}
                  >
                    {/* Cover image — compact height */}
                    {ev.coverImage && typeof ev.coverImage === 'string' && ev.coverImage.trim().length > 0 && (
                      <div className="w-full h-28 sm:h-32 bg-zinc-100 dark:bg-zinc-950 overflow-hidden relative border-b border-zinc-150 dark:border-zinc-800">
                        <img
                          src={ev.coverImage}
                          alt={ev.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-3.5 sm:p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TranslatedText
                              as="h4"
                              className="text-sm font-extrabold text-[#062E22] dark:text-emerald-100 leading-snug"
                              text={ev.title || ''}
                              language={language}
                              altText={ev.sinhalaTitle}
                              altLanguage="si"
                            />
                            {isUnread && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shrink-0">
                                {language === 'si' ? 'නව' : 'New'}
                              </span>
                            )}
                            {ev.isLive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white animate-pulse shrink-0">
                                <Radio className="w-2.5 h-2.5" />
                                LIVE
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${getNotificationTypeStyles(ev.type || 'other')}`}>
                          {getNotificationTypeLabel(ev.type || 'other', language)}
                        </span>
                      </div>

                      {(ev.location || ev.date) && (
                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate max-w-[55%]">
                              <MapPin className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{ev.location}</span>
                            </span>
                          )}
                          {ev.date && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Calendar className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                              <span>{ev.date}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {ev.isLive && ev.liveStreamUrl && (
                        <a
                          href={ev.liveStreamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          {language === 'si' ? 'සජීවී ප්‍රවාහය නරඹන්න' : 'Watch live stream'}
                        </a>
                      )}

                      {/* Short preview + Read more */}
                      {ev.description && ev.description.trim() && (() => {
                        const notifKey = ev.id || ev.title || '';
                        const isOpen = expandedNotifIds.has(notifKey);
                        const raw = ev.description.trim();
                        const isLong = raw.length > 100 || raw.split(/\n/).length > 2;
                        return (
                          <div className="space-y-1">
                            <TranslatedText
                              as="p"
                              className={`text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap ${
                                isOpen ? '' : 'line-clamp-2'
                              }`}
                              text={raw}
                              language={language}
                            />
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => toggleNotifExpanded(notifKey)}
                                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                {isOpen
                                  ? (language === 'si' ? 'අඩුවෙන් පෙන්වන්න' : 'Show less')
                                  : (language === 'si' ? 'තව කියවන්න' : 'Read more')}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {ev.participatingElephants && ev.participatingElephants.length > 0 && (
                        <div className="bg-[#FAF9F5] dark:bg-[#1A2C26] px-2.5 py-1.5 rounded-xl border border-zinc-200/80 dark:border-emerald-950/50 flex items-center gap-1.5 text-[11px] text-[#062E22] dark:text-emerald-100">
                          <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span className="font-bold shrink-0">
                            {language === 'si' ? 'සහභාගී:' : 'With:'}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-300 truncate">{ev.participatingElephants.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
        </Suspense>
        )}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab === 'messages' ? 'profile' : currentTab}
        onSelectTab={handleTabChange}
        onOpenAdd={() => handleOpenCreatePost()}
        hasNewNotifications={hasNewNotifications}
      />

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photoUrl={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}

      {/* Create Post / Photo Upload Modal for Elephants */}
      {isCreatePostOpen && (
        <Suspense fallback={null}>
        <CreatePostModal
          elephants={elephants}
          preselectedElephantId={createPostElephantId}
          isStoryOnlyInitial={isCreatePostStoryOnly}
          language={language}
          onClose={() => setIsCreatePostOpen(false)}
          onPostSuccess={handlePostSuccess}
        />
        </Suspense>
      )}

      {/* Admin Management Console Modal (Opened via Top Shield icon) */}
      {isAdminOpen && (
        <Suspense fallback={null}>
        <AdminPanel
          elephants={elephants}
          events={events}
          posts={posts}
          onSaveElephant={handleSaveElephant}
          onDeleteElephant={handleDeleteElephant}
          onToggleVerification={handleToggleVerification}
          onToggleFeatured={handleToggleFeatured}
          onToggleLive={handleToggleLive}
          onSaveEvent={handleSaveEvent}
          onDeleteEvent={handleDeleteEvent}
          onViewElephant={(el) => {
            setIsAdminOpen(false);
            handleSelectElephant(el);
          }}
          onClose={() => {
            setIsAdminOpen(false);
            if (window.location.hash === '#admin') {
              window.location.hash = currentTab === 'elephant' ? 'elephant' : currentTab === 'profile' ? 'profile' : 'home';
            }
          }}
          language={language}
        />
        </Suspense>
      )}
    </div>
  );
}
