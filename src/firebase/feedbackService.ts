import { ref, push, set, get, update, remove, onValue, query, orderByChild } from 'firebase/database';
import { db } from './config';
import { moderateCommentText } from '../utils/commentModeration';

const FEEDBACK_PATH = 'platform_feedback';
const FEEDBACK_LIKES_PATH = 'platform_feedback_likes';

export type FeedbackType = 'suggestion' | 'complaint';
export type FeedbackStatus = 'open' | 'reviewed';

export interface PlatformFeedback {
  id: string;
  type: FeedbackType;
  message: string;
  authorUid: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  createdAt: number;
  likesCount: number;
  likedBy: string[];
  status: FeedbackStatus;
}

function mapFeedback(id: string, data: any, likesData: any): PlatformFeedback {
  const likedBy: string[] = Array.isArray(likesData?.likedBy)
    ? likesData.likedBy
    : likesData?.likedBy
      ? Object.keys(likesData.likedBy)
      : [];
  return {
    id,
    type: data.type === 'complaint' ? 'complaint' : 'suggestion',
    message: data.message || '',
    authorUid: data.authorUid || '',
    authorName: data.authorName || 'Anonymous',
    authorUsername: data.authorUsername,
    authorPhotoURL: data.authorPhotoURL,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    likesCount: typeof likesData?.likesCount === 'number' ? likesData.likesCount : 0,
    likedBy,
    status: data.status === 'reviewed' ? 'reviewed' : 'open',
  };
}

export async function addPlatformFeedback(input: {
  type: FeedbackType;
  message: string;
  authorUid: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
}): Promise<string> {
  const trimmed = input.message.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Message is too long (max 2000 characters).');
  if (!input.authorUid) throw new Error('You must be signed in (even as a guest) to submit feedback.');

  // Reuse the same lightweight abuse filter used for post comments — this
  // is a public board, so basic moderation still applies.
  const moderation = moderateCommentText(trimmed);
  if (!moderation.allowed) {
    throw new Error('This message was blocked by our content filter. Please rephrase it.');
  }

  const feedbackRef = push(ref(db, FEEDBACK_PATH));
  const id = feedbackRef.key as string;

  await set(feedbackRef, {
    type: input.type,
    message: moderation.sanitized || trimmed,
    authorUid: input.authorUid,
    authorName: input.authorName,
    authorUsername: input.authorUsername || null,
    authorPhotoURL: input.authorPhotoURL || null,
    createdAt: Date.now(),
    status: 'open',
  });

  return id;
}

/**
 * Subscribes to both the feedback items and their likes (separate path,
 * same pattern as post_likes) and merges them on every change to either.
 */
export function subscribeToPlatformFeedback(
  callback: (items: PlatformFeedback[]) => void
): () => void {
  let latestFeedback: Record<string, any> = {};
  let latestLikes: Record<string, any> = {};

  const emit = () => {
    const items = Object.keys(latestFeedback).map((id) =>
      mapFeedback(id, latestFeedback[id], latestLikes[id])
    );
    items.sort((a, b) => b.createdAt - a.createdAt);
    callback(items);
  };

  const feedbackQuery = query(ref(db, FEEDBACK_PATH), orderByChild('createdAt'));
  const unsubFeedback = onValue(feedbackQuery, (snapshot) => {
    latestFeedback = snapshot.val() || {};
    emit();
  });

  const unsubLikes = onValue(ref(db, FEEDBACK_LIKES_PATH), (snapshot) => {
    latestLikes = snapshot.val() || {};
    emit();
  });

  return () => {
    unsubFeedback();
    unsubLikes();
  };
}

export async function toggleLikeFeedback(feedbackId: string, uid: string): Promise<void> {
  const likeRef = ref(db, `${FEEDBACK_LIKES_PATH}/${feedbackId}`);
  const snapshot = await get(likeRef);
  const data = snapshot.exists() ? snapshot.val() : {};
  const likedBy: string[] = Array.isArray(data.likedBy) ? data.likedBy : [];
  const alreadyLiked = likedBy.includes(uid);
  const nextLikedBy = alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];

  await set(likeRef, {
    likedBy: nextLikedBy,
    likesCount: nextLikedBy.length,
  });
}

/** Admin-only: mark a feedback item as reviewed/resolved. */
export async function markFeedbackReviewed(feedbackId: string): Promise<void> {
  await update(ref(db, `${FEEDBACK_PATH}/${feedbackId}`), { status: 'reviewed' });
}

/** Admin-only: remove a feedback item entirely (e.g. spam). */
export async function deletePlatformFeedback(feedbackId: string): Promise<void> {
  await remove(ref(db, `${FEEDBACK_PATH}/${feedbackId}`));
  await remove(ref(db, `${FEEDBACK_LIKES_PATH}/${feedbackId}`));
}
