import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  child,
  serverTimestamp,
} from 'firebase/database';
import { db, auth } from './config';
import { assertActionRateLimit } from '../utils/rateLimit';
import { Elephant, CulturalEvent } from '../types/elephant';
import { resolveAge } from '../utils/ageCalculator';

const ELEPHANTS_PATH = 'elephants';
const EVENTS_PATH = 'cultural_events';
const POSTS_PATH = 'elephant_posts';
const USERS_PATH = 'users';
const ELEPHANT_LIKES_PATH = 'elephant_likes';
const EVENT_LIKES_PATH = 'event_likes';

const CACHE_ELEPHANTS_KEY = 'alimedia_cached_elephants';
const CACHE_EVENTS_KEY = 'alimedia_cached_events';

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

function withTimeoutReject<T>(
  promise: Promise<T>,
  timeoutMs = 15000,
  errorMsg = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isOfflineErr =
        err?.code === 'unavailable' || /offline/i.test(err?.message || '');
      if (!isOfflineErr || i === attempts - 1) {
        throw err;
      }
      await delay(delayMs * (i + 1));
    }
  }
  throw lastError;
}

/** Strip undefined so RTDB does not reject the write */
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (obj instanceof Date) {
    return obj.getTime();
  }
  if (Array.isArray(obj)) {
    return obj.filter((item) => item !== undefined).map(sanitizeForFirestore);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

function mapElephant(id: string, data: any): Elephant {
  const rawPhotos: string[] = Array.isArray(data.photos) ? data.photos : [];
  const rawCloudinary: { url: string; publicId: string }[] = Array.isArray(data.cloudinaryPhotos)
    ? data.cloudinaryPhotos
    : [];

  const finalPhotos =
    rawPhotos.length > 0
      ? rawPhotos
      : rawCloudinary.map((cp) => (typeof cp === 'string' ? cp : cp?.url)).filter(Boolean);

  const finalCloudinary =
    rawCloudinary.length > 0
      ? rawCloudinary
      : finalPhotos.map((p) => ({ url: p, publicId: '' }));

  return {
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
    peraheraParticipation: Array.isArray(data.peraheraParticipation)
      ? data.peraheraParticipation
      : [],
    photos: finalPhotos,
    profilePhoto: typeof data.profilePhoto === 'string' ? data.profilePhoto.trim() : '',
    cloudinaryPhotos: finalCloudinary,
    sources: Array.isArray(data.sources) ? data.sources : [],
    verified: data.verified !== undefined ? Boolean(data.verified) : true,
    status: data.status || 'living',
    isFeatured: Boolean(data.isFeatured),
    isLive: Boolean(data.isLive),
    liveStreamUrl: data.liveStreamUrl || '',
    customBadge: data.customBadge || '',
    followerCount: data.followerCount || 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Fetch all elephants from Realtime Database with robust fallback.
 */
export async function getElephants(): Promise<Elephant[]> {
  try {
    const fetchPromise = (async () => {
      const snapshot = await get(ref(db, ELEPHANTS_PATH));
      if (!snapshot.exists()) {
        return [];
      }
      const val = snapshot.val() || {};
      const list: Elephant[] = Object.entries(val).map(([id, data]) =>
        mapElephant(id, data as any)
      );
      return list;
    })();

    const list = await withTimeout(fetchPromise, 10000, null as Elephant[] | null);

    if (list !== null) {
      try {
        localStorage.setItem(CACHE_ELEPHANTS_KEY, JSON.stringify(list));
      } catch (e) {}
      return list;
    }

    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}

    return [];
  } catch (error) {
    console.warn('Error fetching elephants from Realtime Database:', error);
    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }
}

/**
 * Get single elephant profile by ID
 */
export async function getElephantById(id: string): Promise<Elephant | null> {
  try {
    const snapshot = await withRetry(() => get(ref(db, `${ELEPHANTS_PATH}/${id}`)));
    if (!snapshot.exists()) {
      return null;
    }
    return mapElephant(id, snapshot.val());
  } catch (error) {
    console.error(`Error fetching elephant with id ${id}:`, error);
    throw error;
  }
}

/**
 * Add a new elephant record into Realtime Database
 */
export async function addElephant(
  elephantData: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    console.log('[RTDB] [1] Starting addElephant write...');
    console.log('[RTDB] [2] Authenticated user UID:', auth.currentUser?.uid || 'no-auth-user');

    const newRef = push(ref(db, ELEPHANTS_PATH));
    const id = newRef.key!;

    console.log('[RTDB] [3] Generated ID:', id);

    const payload = sanitizeForFirestore({
      ...elephantData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[RTDB] [4] Writing payload to path:', `${ELEPHANTS_PATH}/${id}`);

    await withTimeoutReject(
      set(newRef, payload),
      30000,
      'Realtime Database write timed out (30s limit). Please check your internet connection and try again.'
    );

    console.log('[RTDB] [5] Write confirmed SUCCESS for ID:', id);
    return id;
  } catch (error: any) {
    console.error('[RTDB] Fatal error writing elephant:', error);
    throw error;
  }
}

/**
 * Update an existing elephant in Realtime Database
 */
export async function updateElephant(id: string, elephantData: Partial<Elephant>): Promise<void> {
  try {
    console.log('[RTDB] [1] Starting updateElephant for ID:', id);
    const { id: _, ...rest } = elephantData;

    const payload = sanitizeForFirestore({
      ...rest,
      updatedAt: Date.now(),
    });

    await withTimeoutReject(
      update(ref(db, `${ELEPHANTS_PATH}/${id}`), payload),
      30000,
      'Realtime Database update timed out (30s limit). Please check your internet connection.'
    );

    console.log('[RTDB] [2] Update confirmed SUCCESS for ID:', id);
  } catch (error: any) {
    console.error(`[RTDB] Error updating elephant ${id}:`, error);
    throw error;
  }
}

export async function toggleElephantVerification(id: string, verified: boolean): Promise<void> {
  await updateElephant(id, { verified });
}

export async function toggleElephantFeatured(id: string, isFeatured: boolean): Promise<void> {
  await updateElephant(id, { isFeatured });
}

export async function toggleElephantLive(id: string, isLive: boolean): Promise<void> {
  await updateElephant(id, { isLive });
}

export async function deleteElephant(id: string): Promise<void> {
  try {
    await remove(ref(db, `${ELEPHANTS_PATH}/${id}`));
  } catch (error) {
    console.error(`Error deleting elephant ${id}:`, error);
    throw error;
  }
}

/**
 * Permanently delete an elephant and cascade-delete connected data.
 */
export async function deleteElephantCascade(
  elephantId: string,
  knownName?: string,
  knownSinhalaName?: string
): Promise<{
  deletedElephantName: string;
  postsDeleted: number;
  usersUpdated: number;
  eventsUpdated: number;
}> {
  try {
    let elephantName = knownName || '';
    let elephantSinhalaName = knownSinhalaName || '';
    if (!elephantName) {
      try {
        const snap = await withRetry(() => get(ref(db, `${ELEPHANTS_PATH}/${elephantId}`)));
        if (snap.exists()) {
          const data = snap.val();
          elephantName = data?.name || '';
          elephantSinhalaName = data?.sinhalaName || '';
        }
      } catch (lookupErr) {
        console.warn(`Could not read elephant ${elephantId} before delete:`, lookupErr);
      }
    }

    // 1. Cascade delete posts for this elephant
    let postsDeletedCount = 0;
    try {
      const postsSnap = await get(ref(db, POSTS_PATH));
      if (postsSnap.exists()) {
        const posts = postsSnap.val() || {};
        const deletions: Promise<void>[] = [];
        for (const [postId, postData] of Object.entries(posts) as [string, any][]) {
          const matchesId = postData?.elephantId === elephantId;
          const matchesName =
            elephantName &&
            typeof postData?.elephantName === 'string' &&
            postData.elephantName === elephantName;
          if (matchesId || matchesName) {
            deletions.push(remove(ref(db, `${POSTS_PATH}/${postId}`)));
            postsDeletedCount++;
          }
        }
        await Promise.all(deletions);
      }
    } catch (postErr) {
      console.warn('Could not clean up some elephant posts:', postErr);
    }

    // 2. Clean up user followedElephants arrays
    let usersUpdatedCount = 0;
    try {
      const usersSnap = await get(ref(db, USERS_PATH));
      if (usersSnap.exists()) {
        const users = usersSnap.val() || {};
        const updates: Promise<void>[] = [];
        for (const [uid, userData] of Object.entries(users) as [string, any][]) {
          const followed: string[] = Array.isArray(userData?.followedElephants)
            ? userData.followedElephants
            : [];
          if (followed.includes(elephantId)) {
            usersUpdatedCount++;
            const next = followed.filter((id) => id !== elephantId);
            updates.push(
              update(ref(db, `${USERS_PATH}/${uid}`), {
                followedElephants: next,
                updatedAt: Date.now(),
              })
            );
          }
        }
        await Promise.all(updates);
      }
    } catch (userErr) {
      console.warn('Could not clean up user follows:', userErr);
    }

    // 3. Clean up cultural events participation lists
    let eventsUpdatedCount = 0;
    try {
      const eventsSnap = await get(ref(db, EVENTS_PATH));
      if (eventsSnap.exists()) {
        const events = eventsSnap.val() || {};
        const updates: Promise<void>[] = [];
        for (const [eventId, evData] of Object.entries(events) as [string, any][]) {
          const participating: string[] = Array.isArray(evData?.participatingElephants)
            ? evData.participatingElephants
            : [];
          // Exact match only (by ID or exact name) — substring matching here
          // previously caused deleting one elephant to also strip participation
          // entries for a different elephant whose name contained this one's
          // name as a substring (e.g. "Raja" vs "Raja Tusker").
          const isExactMatch = (p: string) =>
            p === elephantId ||
            (!!elephantName && p.toLowerCase() === elephantName.toLowerCase()) ||
            (!!elephantSinhalaName && p === elephantSinhalaName);

          const hasReference = participating.some(isExactMatch);
          if (hasReference) {
            eventsUpdatedCount++;
            const filtered = participating.filter((p) => !isExactMatch(p));
            updates.push(
              update(ref(db, `${EVENTS_PATH}/${eventId}`), {
                participatingElephants: filtered,
                updatedAt: Date.now(),
              })
            );
          }
        }
        await Promise.all(updates);
      }
    } catch (eventErr) {
      console.warn('Could not clean up cultural events references:', eventErr);
    }

    // 4. Delete the main elephant record
    await withRetry(() => remove(ref(db, `${ELEPHANTS_PATH}/${elephantId}`)));

    return {
      deletedElephantName: elephantName || elephantId,
      postsDeleted: postsDeletedCount,
      usersUpdated: usersUpdatedCount,
      eventsUpdated: eventsUpdatedCount,
    };
  } catch (error) {
    console.error(`Error executing cascade delete for elephant ${elephantId}:`, error);
    throw error;
  }
}

// -------------------------------------------------------------
// Cultural Events Service
// -------------------------------------------------------------

export async function getCulturalEvents(): Promise<CulturalEvent[]> {
  try {
    const fetchPromise = (async () => {
      const snapshot = await get(ref(db, EVENTS_PATH));
      if (!snapshot.exists()) {
        return [];
      }
      const val = snapshot.val() || {};
      const events: CulturalEvent[] = Object.entries(val).map(([id, data]: [string, any]) => ({
        id,
        title: data.title || '',
        sinhalaTitle: data.sinhalaTitle || '',
        description: data.description || '',
        location: data.location || '',
        date: data.date || '',
        type: data.type || 'perahera',
        participatingElephants: Array.isArray(data.participatingElephants)
          ? data.participatingElephants
          : [],
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        coverImage: data.coverImage || '',
        isLive: !!data.isLive,
        liveStreamUrl: data.liveStreamUrl || '',
        likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }));
      return events;
    })();

    const events = await withTimeout(fetchPromise, 10000, null as CulturalEvent[] | null);

    if (events !== null) {
      try {
        localStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(events));
      } catch (e) {}
      return events;
    }

    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}

    return [];
  } catch (error) {
    console.warn('Error fetching cultural events:', error);
    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }
}

export async function addCulturalEvent(
  eventData: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const newRef = push(ref(db, EVENTS_PATH));
    const id = newRef.key!;
    const payload = sanitizeForFirestore({
      ...eventData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await set(newRef, payload);
    return id;
  } catch (error) {
    console.error('Error adding cultural event:', error);
    throw error;
  }
}

export async function updateCulturalEvent(
  id: string,
  eventData: Partial<CulturalEvent>
): Promise<void> {
  try {
    const { id: _, ...rest } = eventData;
    const payload = sanitizeForFirestore({
      ...rest,
      updatedAt: Date.now(),
    });
    await update(ref(db, `${EVENTS_PATH}/${id}`), payload);
  } catch (error) {
    console.error(`Error updating cultural event ${id}:`, error);
    throw error;
  }
}

export async function deleteCulturalEvent(id: string): Promise<void> {
  await remove(ref(db, `${EVENTS_PATH}/${id}`));
}

/**
 * Toggle like on an elephant profile. Stored under elephant_likes/ so non-admins can write.
 */
/**
 * Normalize any likedBy shape (array, {uid:true} map, array-like object) into
 * a unique array of UID strings.
 */
function normalizeLikedByShape(raw: unknown): string[] {
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
  return Array.from(new Set(likedBy));
}

/**
 * Store likedBy as { [uid]: true } so RTDB never silently drops an empty
 * array on write (which would fail the `.validate` hasChildren check on
 * unlike-to-zero). A sentinel `_empty` key is kept when there are no likes.
 */
function likedByArrayToMap(uids: string[]): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const u of uids) if (u) m[u] = true;
  if (Object.keys(m).length === 0) m._empty = true;
  return m;
}

export async function toggleLikeElephant(
  elephantId: string,
  userUid: string,
  forceLikeOnly: boolean = false
): Promise<{ isLiked: boolean; newCount: number }> {
  assertActionRateLimit('like');
  try {
    const likeRef = ref(db, `${ELEPHANT_LIKES_PATH}/${elephantId}`);
    const snap = await get(likeRef);
    const data = snap.exists() ? snap.val() || {} : {};
    let likedBy: string[] = normalizeLikedByShape(data.likedBy);
    const isCurrentlyLiked = likedBy.includes(userUid);

    const toMap = likedByArrayToMap;

    if (forceLikeOnly) {
      if (!isCurrentlyLiked) {
        const newLikedBy = [...likedBy, userUid];
        const newCount = newLikedBy.length;
        await set(likeRef, { likesCount: newCount, likedBy: toMap(newLikedBy), updatedAt: Date.now() });
        return { isLiked: true, newCount };
      }
      return { isLiked: true, newCount: likedBy.length };
    }

    if (isCurrentlyLiked) {
      const newLikedBy = likedBy.filter((uid) => uid !== userUid);
      const newCount = newLikedBy.length;
      await set(likeRef, { likesCount: newCount, likedBy: toMap(newLikedBy), updatedAt: Date.now() });
      return { isLiked: false, newCount };
    }

    const newLikedBy = [...likedBy, userUid];
    const newCount = newLikedBy.length;
    await set(likeRef, { likesCount: newCount, likedBy: toMap(newLikedBy), updatedAt: Date.now() });
    return { isLiked: true, newCount };
  } catch (error) {
    console.warn(`Error toggling like for elephant ${elephantId}:`, error);
    throw error;
  }
}

/** Fetch engagement map for all elephants (likesCount + likedBy). */
export async function getElephantLikesMap(): Promise<
  Record<string, { likesCount: number; likedBy: string[] }>
> {
  try {
    const snap = await get(ref(db, ELEPHANT_LIKES_PATH));
    if (!snap.exists()) return {};
    const val = snap.val() || {};
    const out: Record<string, { likesCount: number; likedBy: string[] }> = {};
    for (const [id, data] of Object.entries(val) as [string, any][]) {
      const likedBy = normalizeLikedByShape(data?.likedBy);
      out[id] = {
        likesCount: typeof data?.likesCount === 'number' ? data.likesCount : likedBy.length,
        likedBy,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Toggle like on a live Perahara / ceremony session.
 * Stored under event_likes/ so non-admins can write.
 */
export async function toggleCulturalEventLike(
  eventId: string,
  userUid: string,
  forceLikeOnly: boolean = false
): Promise<{ isLiked: boolean; newCount: number }> {
  assertActionRateLimit('like');
  try {
    const likeRef = ref(db, `${EVENT_LIKES_PATH}/${eventId}`);
    const snap = await get(likeRef);
    const data = snap.exists() ? snap.val() || {} : {};
    const likedBy: string[] = normalizeLikedByShape(data.likedBy);
    const currentLikes: number = typeof data.likesCount === 'number' ? data.likesCount : likedBy.length;
    const isCurrentlyLiked = likedBy.includes(userUid);

    if (forceLikeOnly) {
      if (!isCurrentlyLiked) {
        const newLikedBy = [...likedBy, userUid];
        const newCount = newLikedBy.length;
        await set(likeRef, { likesCount: newCount, likedBy: likedByArrayToMap(newLikedBy), updatedAt: Date.now() });
        return { isLiked: true, newCount };
      }
      return { isLiked: true, newCount: currentLikes };
    }

    if (isCurrentlyLiked) {
      const newLikedBy = likedBy.filter((uid) => uid !== userUid);
      const newCount = newLikedBy.length;
      await set(likeRef, { likesCount: newCount, likedBy: likedByArrayToMap(newLikedBy), updatedAt: Date.now() });
      return { isLiked: false, newCount };
    }

    const newLikedBy = [...likedBy, userUid];
    const newCount = newLikedBy.length;
    await set(likeRef, { likesCount: newCount, likedBy: likedByArrayToMap(newLikedBy), updatedAt: Date.now() });
    return { isLiked: true, newCount };
  } catch (error) {
    console.warn(`Error toggling like for event ${eventId}:`, error);
    throw error;
  }
}
