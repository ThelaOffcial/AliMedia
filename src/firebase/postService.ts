import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
} from 'firebase/database';
import { db } from './config';
import { assertActionRateLimit } from '../utils/rateLimit';
import { getAuth } from 'firebase/auth';
import { ElephantPost } from '../types/elephant';
import { sanitizeForFirestore } from './elephantService';
import { isSuperAdminPostEmail } from '../utils/aliMediaTeam';

const POSTS_PATH = 'elephant_posts';
const ELEPHANTS_PATH = 'elephants';
const POST_LIKES_PATH = 'post_likes';
const CACHE_POSTS_KEY = 'alimedia_cached_posts';

/**
 * Normalize likedBy from any Firebase shape into unique UID strings.
 * Supports: string[], {0:uid,1:uid}, {uid:true}, mixed.
 */
export function normalizeLikedBy(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return Array.from(
      new Set(val.filter((v): v is string => typeof v === 'string' && v.length > 0 && !v.startsWith('_')))
    );
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const uids: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      // Map form: { [uid]: true }
      if (v === true && typeof k === 'string' && k.length > 5) {
        uids.push(k);
        continue;
      }
      // Array-like object: { "0": "uid", "1": "uid" }
      if (typeof v === 'string' && v.length > 0) uids.push(v);
    }
    return Array.from(new Set(uids));
  }
  return [];
}

/** Store as { [uid]: true } so Firebase never drops empty arrays / renumbers indexes. */
function likedByToMap(uids: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const uid of uids) {
    if (uid) map[uid] = true;
  }
  // Keep at least one key so hasChildren('likedBy') validation passes when empty
  if (Object.keys(map).length === 0) {
    map._empty = true;
  }
  return map;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize any Firebase / JS timestamp to milliseconds.
 * Handles: number (ms or sec), Date, ISO string, {seconds}, Firestore Timestamp.
 * Returns 0 if unknown (do NOT default to Date.now — that caused "Just now" forever).
 */
export function toTimestampMs(createdAt: any): number {
  if (createdAt == null || createdAt === '') return 0;

  if (typeof createdAt?.toMillis === 'function') {
    const n = createdAt.toMillis();
    return typeof n === 'number' && n > 0 ? n : 0;
  }
  if (typeof createdAt?.toDate === 'function') {
    const d = createdAt.toDate();
    const n = d instanceof Date ? d.getTime() : 0;
    return n > 0 ? n : 0;
  }
  if (createdAt instanceof Date) {
    const n = createdAt.getTime();
    return isNaN(n) ? 0 : n;
  }
  if (typeof createdAt === 'number' && isFinite(createdAt)) {
    // Unix seconds vs milliseconds
    if (createdAt > 0 && createdAt < 1e12) return Math.floor(createdAt * 1000);
    return Math.floor(createdAt);
  }
  if (typeof createdAt === 'string') {
    const trimmed = createdAt.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (n > 0 && n < 1e12) return Math.floor(n * 1000);
      return Math.floor(n);
    }
    const parsed = Date.parse(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof createdAt === 'object') {
    if (typeof createdAt.seconds === 'number') {
      const extra = typeof createdAt.nanoseconds === 'number' ? createdAt.nanoseconds / 1e6 : 0;
      return Math.floor(createdAt.seconds * 1000 + extra);
    }
    if (typeof createdAt._seconds === 'number') {
      return Math.floor(createdAt._seconds * 1000);
    }
  }
  return 0;
}

/**
 * Check if a timestamp is within 24 hours
 */
export function isWithin24Hours(createdAt: any): boolean {
  const timeMs = toTimestampMs(createdAt);
  if (!timeMs) return false; // missing time → treat as expired for stories
  return Date.now() - timeMs < TWENTY_FOUR_HOURS_MS;
}

/**
 * True when a post/comment was meaningfully edited after creation.
 * Uses a small threshold to ignore the sub-second gap between the two
 * Date.now() calls made at creation time (createdAt vs updatedAt).
 */
export function wasEdited(createdAt: any, updatedAt: any): boolean {
  const created = toTimestampMs(createdAt);
  const updated = toTimestampMs(updatedAt);
  if (!created || !updated) return false;
  return updated - created > 2000;
}

/**
 * Format relative time from the original upload timestamp.
 */
export function formatRelativeTime(createdAt: any, language: 'si' | 'en' = 'si'): string {
  const timeMs = toTimestampMs(createdAt);
  if (!timeMs) return language === 'si' ? '—' : '—';

  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));

  if (diffSec < 45) {
    return language === 'si' ? 'දැන්' : 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return language === 'si' ? `මිනිත්තු ${diffMin}කට පෙර` : `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return language === 'si' ? `පැය ${diffHr}කට පෙර` : `${diffHr}h ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) {
    return language === 'si' ? `දින ${diffDays}කට පෙර` : `${diffDays}d ago`;
  }
  // Older: show calendar date from original upload time
  try {
    return new Date(timeMs).toLocaleDateString(language === 'si' ? 'si-LK' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return language === 'si' ? `දින ${diffDays}කට පෙර` : `${diffDays}d ago`;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
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
      const isOfflineErr = err?.code === 'unavailable' || /offline/i.test(err?.message || '');
      if (!isOfflineErr || i === attempts - 1) {
        throw err;
      }
      await delay(delayMs * (i + 1));
    }
  }
  throw lastError;
}

function toTimeMs(createdAt: any): number {
  return toTimestampMs(createdAt);
}

async function purgeExpiredStoryOnlyPosts(posts: ElephantPost[]) {
  try {
    for (const p of posts) {
      // Story-only posts auto-delete after 24 hours from upload time
      if (p.isStoryOnly && p.id && !isWithin24Hours(p.createdAt)) {
        deleteElephantPost(p.id).catch((e) =>
          console.warn('Failed to purge expired story', p.id, e)
        );
      }
    }
  } catch (err) {
    // Non-blocking cleanup
  }
}

/**
 * Scan all posts and delete expired story-only items (24h).
 * Safe to call from App on interval / realtime.
 */
export async function purgeExpiredStories(): Promise<number> {
  try {
    const snapshot = await get(ref(db, POSTS_PATH));
    if (!snapshot.exists()) return 0;
    const val = snapshot.val() || {};
    let removed = 0;
    const tasks: Promise<void>[] = [];
    for (const [id, data] of Object.entries(val) as [string, any][]) {
      if (!data?.isStoryOnly) continue;
      if (isWithin24Hours(data.createdAt)) continue;
      removed += 1;
      tasks.push(
        deleteElephantPost(id).catch((e) => {
          console.warn('purgeExpiredStories failed', id, e);
        })
      );
    }
    await Promise.all(tasks);
    return removed;
  } catch (err) {
    console.warn('purgeExpiredStories error', err);
    return 0;
  }
}

/**
 * Add a new user-submitted photo/post or story for an elephant
 */
export async function addElephantPost(
  postData: Omit<ElephantPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const newRef = push(ref(db, POSTS_PATH));
    const id = newRef.key!;
    const cleanPayload = sanitizeForFirestore({
      ...postData,
      likesCount: postData.likesCount || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await set(newRef, cleanPayload);

    // Also link the photo into the Elephant profile's photo gallery if not story only
    if (postData.elephantId && postData.photoUrl && !postData.isStoryOnly) {
      try {
        const elephantSnap = await get(ref(db, `${ELEPHANTS_PATH}/${postData.elephantId}`));
        if (elephantSnap.exists()) {
          const data = elephantSnap.val() || {};
          const photos: string[] = Array.isArray(data.photos) ? data.photos : [];
          if (!photos.includes(postData.photoUrl)) {
            await update(ref(db, `${ELEPHANTS_PATH}/${postData.elephantId}`), {
              photos: [...photos, postData.photoUrl],
              updatedAt: Date.now(),
            });
          }
        }
      } catch (err) {
        console.warn('Could not append photo to elephant record:', err);
      }
    }

    return id;
  } catch (error) {
    console.error('Error adding elephant post to Realtime Database:', error);
    throw error;
  }
}

/**
 * Fetch all community posts for the global feed & stories
 */
export async function getAllElephantPosts(): Promise<ElephantPost[]> {
  try {
    const fetchPromise = (async () => {
      const snapshot = await get(ref(db, POSTS_PATH));
      if (!snapshot.exists()) {
        return [];
      }
      const val = snapshot.val() || {};
      const posts: ElephantPost[] = Object.entries(val).map(([id, data]: [string, any]) => ({
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
        likesCount: data.likesCount || 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        isStory: data.isStory !== undefined ? data.isStory : true,
        isStoryOnly: !!data.isStoryOnly,
        aspectRatio: data.aspectRatio || undefined,
        isReshare: !!data.isReshare,
        originalPostId: data.originalPostId || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }));

      purgeExpiredStoryOnlyPosts(posts);

      const validPosts = posts.filter((p) => {
        if (p.isStoryOnly) {
          return isWithin24Hours(p.createdAt);
        }
        return true;
      });

      validPosts.sort((a, b) => toTimeMs(b.createdAt) - toTimeMs(a.createdAt));
      return validPosts;
    })();

    const posts = await withTimeout(fetchPromise, 15000, null as ElephantPost[] | null);

    if (posts !== null) {
      try {
        localStorage.setItem(CACHE_POSTS_KEY, JSON.stringify(posts));
      } catch (e) {}
      return posts;
    }

    try {
      const cached = localStorage.getItem(CACHE_POSTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: any) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
        }
      }
    } catch (e) {}

    return [];
  } catch (error) {
    console.warn('Error fetching all elephant posts:', error);
    try {
      const cached = localStorage.getItem(CACHE_POSTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: any) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
        }
      }
    } catch (e) {}
    return [];
  }
}

/**
 * Fetch community posts specific to an elephant
 */
export async function getPostsForElephant(elephantId: string): Promise<ElephantPost[]> {
  try {
    const snapshot = await get(ref(db, POSTS_PATH));
    if (!snapshot.exists()) {
      return [];
    }
    const val = snapshot.val() || {};
    const posts: ElephantPost[] = [];
    for (const [id, data] of Object.entries(val) as [string, any][]) {
      if (data?.elephantId !== elephantId) continue;
      posts.push({
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
        likesCount: data.likesCount || 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        isStory: data.isStory !== undefined ? data.isStory : true,
        isStoryOnly: !!data.isStoryOnly,
        aspectRatio: data.aspectRatio || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    }
    return posts.filter((p) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
  } catch (error) {
    console.warn(`Error fetching posts for elephant ${elephantId}:`, error);
    return [];
  }
}

/**
 * Update post caption. Only the author (or admin) may edit.
 * Uses the signed-in Firebase user — do not trust client-only flags alone.
 */
export async function updateElephantPost(
  postId: string,
  fields: { caption?: string },
  _opts?: { editorUid?: string | null; isAdmin?: boolean }
): Promise<void> {
  if (!postId) throw new Error('Missing postId');

  const auth = getAuth();
  const current = auth.currentUser;
  if (!current || current.isAnonymous) {
    throw new Error('Sign in required to edit a post');
  }
  const uid = current.uid;

  const postRef = ref(db, `${POSTS_PATH}/${postId}`);
  const snap = await get(postRef);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.val() || {};

  const authorUid = typeof data.authorUid === 'string' ? data.authorUid : '';
  const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl : '';

  if (!photoUrl) throw new Error('Post photo is missing; cannot edit');

  // Ownership: author UID, /admins allowlist, or designated super-admin email
  const isOwner = !!authorUid && authorUid === uid;
  const isSuperAdmin = isSuperAdminPostEmail(current.email);
  let isAdmin = false;
  try {
    const adminSnap = await get(ref(db, `admins/${uid}`));
    isAdmin = adminSnap.exists();
  } catch {
    isAdmin = false;
  }

  if (!isOwner && !isAdmin && !isSuperAdmin) {
    throw new Error('Only the author or an admin can edit this post');
  }

  const caption =
    typeof fields.caption === 'string'
      ? fields.caption.slice(0, 2000)
      : (typeof data.caption === 'string' ? data.caption : '');

  // Partial update; RTDB merges so existing fields remain for .validate
  const payload: Record<string, unknown> = {
    caption,
    updatedAt: Date.now(),
    // Echo required identity fields so validators always see them on the written patch
    authorUid: authorUid || uid,
    photoUrl,
  };

  try {
    await update(postRef, payload);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[updateElephantPost] failed', { postId, uid, authorUid, isOwner, isAdmin, msg });
    if (/permission|PERMISSION|denied/i.test(msg)) {
      throw new Error(
        'Permission denied. Sign in as the post author (or admin), and publish the latest database.rules.json.'
      );
    }
    throw err;
  }
}

/**
 * Delete a community post or expired story.
 */
export async function deleteElephantPost(postId: string): Promise<void> {
  try {
    const auth = getAuth();
    const current = auth.currentUser;
    if (!current || current.isAnonymous) {
      throw new Error('Sign in required to delete a post');
    }
    const uid = current.uid;

    const postRef = ref(db, `${POSTS_PATH}/${postId}`);
    const ownershipSnap = await get(postRef);
    if (!ownershipSnap.exists()) {
      throw new Error('Post not found');
    }
    const existing = ownershipSnap.val() || {};
    const authorUid = typeof existing.authorUid === 'string' ? existing.authorUid : '';
    const isOwner = !!authorUid && authorUid === uid;
    const isSuperAdmin = isSuperAdminPostEmail(current.email);
    let isAdmin = false;
    try {
      const adminSnap = await get(ref(db, `admins/${uid}`));
      isAdmin = adminSnap.exists();
    } catch {
      isAdmin = false;
    }
    if (!isOwner && !isAdmin && !isSuperAdmin) {
      throw new Error('Only the author or an admin can delete this post');
    }

    try {
      const snap = ownershipSnap;
      if (snap.exists()) {
        const data = snap.val();
        if (data.elephantId && data.photoUrl && !data.isStoryOnly) {
          const elephantRef = ref(db, `${ELEPHANTS_PATH}/${data.elephantId}`);
          const elephantSnap = await withRetry(() => get(elephantRef));
          if (elephantSnap.exists()) {
            const elephantData = elephantSnap.val() || {};
            const photos: string[] = Array.isArray(elephantData.photos)
              ? elephantData.photos.filter((p: string) => p !== data.photoUrl)
              : [];
            const cloudinaryPhotos = Array.isArray(elephantData.cloudinaryPhotos)
              ? elephantData.cloudinaryPhotos.filter((cp: any) => cp?.url !== data.photoUrl)
              : undefined;
            const updatePayload: Record<string, any> = {
              photos,
              updatedAt: Date.now(),
            };
            if (cloudinaryPhotos) {
              updatePayload.cloudinaryPhotos = cloudinaryPhotos;
            }
            await withRetry(() => update(elephantRef, updatePayload));
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('Could not clean up elephant gallery photo for deleted post:', cleanupErr);
    }

    await withRetry(() => remove(postRef));
    // Clean up likes for this post
    try {
      await remove(ref(db, `${POST_LIKES_PATH}/${postId}`));
    } catch (likesErr) {
      console.warn('Could not remove post likes:', likesErr);
    }
  } catch (error: any) {
    console.error('Error deleting elephant post:', error);
    const msg = error?.message || String(error);
    if (/permission|PERMISSION/i.test(msg)) {
      throw new Error('Permission denied. Only the post author or an admin can delete.');
    }
    throw error;
  }
}

/**
 * Toggle like on a community post/story.
 * Stored under post_likes/{postId}. Count = number of unique UIDs.
 */
export async function toggleLikeElephantPost(
  postId: string,
  userUid: string,
  forceLikeOnly: boolean = false
): Promise<{ isLiked: boolean; newCount: number }> {
  if (!postId || !userUid) {
    throw new Error('Missing postId or userUid');
  }
  assertActionRateLimit('like');

  const likeRef = ref(db, `${POST_LIKES_PATH}/${postId}`);
  const snap = await get(likeRef);
  const data = snap.exists() ? snap.val() || {} : {};

  // Prefer dedicated post_likes; fall back to legacy fields on the post itself once
  let likedBy = normalizeLikedBy(data.likedBy);
  if (likedBy.length === 0 && !snap.exists()) {
    try {
      const postSnap = await get(ref(db, `${POSTS_PATH}/${postId}`));
      if (postSnap.exists()) {
        const postData = postSnap.val() || {};
        likedBy = normalizeLikedBy(postData.likedBy);
      }
    } catch {
      /* ignore legacy read errors */
    }
  }

  likedBy = Array.from(new Set(likedBy));
  const isCurrentlyLiked = likedBy.includes(userUid);

  const writeLikes = async (uids: string[]) => {
    const unique = Array.from(new Set(uids));
    const newCount = unique.length;
    await set(likeRef, {
      likesCount: newCount,
      likedBy: likedByToMap(unique),
      updatedAt: Date.now(),
    });
    return newCount;
  };

  if (forceLikeOnly) {
    if (!isCurrentlyLiked) {
      const newCount = await writeLikes([...likedBy, userUid]);
      return { isLiked: true, newCount };
    }
    return { isLiked: true, newCount: likedBy.length };
  }

  if (isCurrentlyLiked) {
    const newCount = await writeLikes(likedBy.filter((uid) => uid !== userUid));
    return { isLiked: false, newCount };
  }

  const newCount = await writeLikes([...likedBy, userUid]);
  return { isLiked: true, newCount };
}

/** Real-time map of all post likes: postId → { likesCount, likedBy } */
export function subscribeToPostLikes(
  onUpdate: (map: Record<string, { likesCount: number; likedBy: string[] }>) => void
): () => void {
  const likesRef = ref(db, POST_LIKES_PATH);
  return onValue(
    likesRef,
    (snap) => {
      const map: Record<string, { likesCount: number; likedBy: string[] }> = {};
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          const likedBy = Array.from(new Set(normalizeLikedBy(data?.likedBy)));
          map[id] = {
            likesCount: likedBy.length,
            likedBy,
          };
        }
      }
      onUpdate(map);
    },
    () => onUpdate({})
  );
}
