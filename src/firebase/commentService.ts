import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  limitToLast,
  endBefore,
} from 'firebase/database';
import { db } from './config';
import { moderateCommentText } from '../utils/commentModeration';
import {
  sanitizeCommentText,
  parseMentions,
  checkCommentRateLimit,
  COMMENT_LIMITS,
} from '../utils/commentSecurity';
import { resolveUsername } from './userService';
import { resolveAuthorIdentity, isAliMediaTeamEmail } from '../utils/aliMediaTeam';
import { getAuth } from 'firebase/auth';

const COMMENTS_PATH = 'post_comments';
const MODERATION_PATH = 'moderation_queue';
const USER_NOTIFS_PATH = 'user_notifications';

export type CommentStatus = 'visible' | 'pending' | 'removed';

export interface PostComment {
  id: string;
  postId: string;
  text: string;
  displayText: string;
  authorUid: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  /** Official Ali Media team comment — shows verified badge, name locked */
  authorIsAliMedia?: boolean;
  createdAt: number;
  status: CommentStatus;
  flagged?: boolean;
  flagReason?: string;
  matchedTerms?: string[];
  /** Resolved mention handles (without @) */
  mentions?: string[];
  /** uid list for mentioned users */
  mentionUids?: string[];
  /** Parent comment id for nested replies (Facebook-style threads) */
  parentId?: string | null;
  /** Display name of the user being replied to */
  replyToName?: string;
  /** Username of the user being replied to */
  replyToUsername?: string;
  /** Set when the author has edited this comment after posting */
  editedAt?: number;
}

export interface ModerationItem {
  id: string;
  /** 'comment' = auto-flagged; 'user_report' = user reported a comment; 'post_report' = user reported a post */
  type: 'comment' | 'user_report' | 'post_report';
  commentId: string;
  postId: string;
  text: string;
  authorUid: string;
  authorName: string;
  flagReason?: string;
  matchedTerms?: string[];
  /** UID of the user who submitted a manual report */
  reportedBy?: string;
  /** Human-readable reason the user selected when reporting */
  reportReason?: string;
  /** Optional photo URL for post reports (admin preview) */
  photoUrl?: string;
  createdAt: number;
  status: 'open' | 'approved' | 'removed';
  reviewedAt?: number;
  reviewedBy?: string;
}

/** Reasons a user can give when manually reporting a comment */
export type ReportReason = 'harassment' | 'spam' | 'wrong_id' | 'off_topic' | 'other';

function mapComment(id: string, data: any): PostComment {
  return {
    id,
    postId: data.postId || '',
    text: data.text || '',
    displayText: data.displayText || data.text || '',
    authorUid: data.authorUid || '',
    authorName: data.authorName || 'User',
    authorUsername: data.authorUsername || '',
    authorPhotoURL: data.authorPhotoURL || '',
    authorIsAliMedia: !!data.authorIsAliMedia,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    status: data.status || 'visible',
    flagged: !!data.flagged,
    flagReason: data.flagReason,
    matchedTerms: Array.isArray(data.matchedTerms) ? data.matchedTerms : [],
    mentions: Array.isArray(data.mentions) ? data.mentions : [],
    mentionUids: Array.isArray(data.mentionUids) ? data.mentionUids : [],
    parentId: data.parentId || null,
    replyToName: data.replyToName || '',
    replyToUsername: data.replyToUsername || '',
    editedAt: typeof data.editedAt === 'number' ? data.editedAt : undefined,
  };
}

/**
 * Add a comment with sanitization, moderation, @mentions, and rate limiting.
 */
export async function addPostComment(input: {
  postId: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  authorIsAliMedia?: boolean;
  parentId?: string | null;
  replyToName?: string;
  replyToUsername?: string;
  /** UID of the comment author being replied to — receives a notification */
  replyToAuthorUid?: string | null;
}): Promise<{ comment: PostComment; flagged: boolean }> {
  const auth = getAuth();
  const current = auth.currentUser;
  if (!current || current.isAnonymous) {
    throw new Error('Sign in required to comment');
  }
  if (input.authorUid !== current.uid) {
    throw new Error('Security: author does not match signed-in user');
  }

  // Official Ali Media team: force verified identity (cannot be imitated)
  const identity = resolveAuthorIdentity({
    email: current.email,
    displayName: input.authorName,
    username: input.authorUsername,
    photoURL: input.authorPhotoURL,
  });
  const forcedName = identity.authorName;
  const forcedUsername = identity.authorUsername;
  const forcedPhoto = identity.authorPhotoURL || '';
  const isTeam = identity.authorIsAliMedia;

  const rate = checkCommentRateLimit();
  if (!rate.ok) {
    throw new Error(
      `Too many comments. Wait ${rate.waitSec || 60}s before trying again.`
    );
  }

  const postId = (input.postId || '').trim();
  if (!postId || postId.length > 128) throw new Error('Invalid post');

  const clean = sanitizeCommentText(input.text);
  if (!clean) throw new Error('Comment is empty');
  if (clean.length > COMMENT_LIMITS.maxLen) {
    throw new Error(`Comment is too long (max ${COMMENT_LIMITS.maxLen} characters)`);
  }

  const mod = moderateCommentText(clean);
  if (mod.reason === 'empty') throw new Error('Comment is empty');

  // Resolve @mentions (max 5)
  const mentionRefs = parseMentions(clean);
  const mentionHandles: string[] = [];
  const mentionUids: string[] = [];
  for (const m of mentionRefs) {
    const entry = await resolveUsername(m.handle);
    if (entry?.uid && entry.uid !== input.authorUid) {
      mentionHandles.push(m.handle);
      if (!mentionUids.includes(entry.uid)) mentionUids.push(entry.uid);
    }
  }

  const commentsRef = ref(db, `${COMMENTS_PATH}/${postId}`);
  const newRef = push(commentsRef);
  const id = newRef.key!;
  if (!id) throw new Error('Could not create comment id');
  const now = Date.now();

  const status: CommentStatus = mod.flagged ? 'pending' : 'visible';
  const displayText = mod.flagged ? mod.sanitized : clean;

  const payload = {
    postId,
    text: clean,
    displayText,
    authorUid: current.uid,
    authorName: forcedName.slice(0, 80),
    authorUsername: forcedUsername.slice(0, 40),
    authorPhotoURL: forcedPhoto.slice(0, 2000),
    authorIsAliMedia: isTeam,
    createdAt: now,
    status,
    flagged: !!mod.flagged,
    flagReason: mod.reason || null,
    matchedTerms: mod.matchedTerms.length ? mod.matchedTerms.slice(0, 20) : null,
    mentions: mentionHandles.length ? mentionHandles : null,
    mentionUids: mentionUids.length ? mentionUids : null,
    parentId: input.parentId || null,
    replyToName: (input.replyToName || '').slice(0, 80) || null,
    replyToUsername: (input.replyToUsername || '').slice(0, 40) || null,
  };

  await set(newRef, payload);

  if (mod.flagged) {
    const qRef = push(ref(db, MODERATION_PATH));
    await set(qRef, {
      type: 'comment',
      commentId: id,
      postId,
      text: clean,
      authorUid: current.uid,
      authorName: payload.authorName,
      flagReason: mod.reason || 'policy',
      matchedTerms: mod.matchedTerms.slice(0, 20),
      createdAt: now,
      status: 'open',
    });
  }

  // In-app notifications (replies + @mentions) for clean, visible comments
  if (!mod.flagged) {
    const alreadyNotified = new Set<string>();

    // Reply → notify the parent comment author
    const replyUid = (input.replyToAuthorUid || '').trim();
    if (
      input.parentId &&
      replyUid &&
      replyUid !== current.uid &&
      replyUid.length > 5
    ) {
      try {
        const nRef = push(ref(db, `${USER_NOTIFS_PATH}/${replyUid}`));
        await set(nRef, {
          type: 'reply',
          postId,
          commentId: id,
          parentId: input.parentId,
          fromUid: current.uid,
          fromName: payload.authorName,
          text: `${payload.authorName} replied: ${clean.slice(0, 120)}`,
          createdAt: now,
          read: false,
        });
        alreadyNotified.add(replyUid);
      } catch (e) {
        console.warn('Reply notify failed', replyUid, e);
      }
    }

    // @mention notifications (skip users already notified by reply)
    if (mentionUids.length > 0) {
      await Promise.all(
        mentionUids.map(async (uid) => {
          if (!uid || uid === current.uid || alreadyNotified.has(uid)) return;
          try {
            const nRef = push(ref(db, `${USER_NOTIFS_PATH}/${uid}`));
            await set(nRef, {
              type: 'mention',
              postId,
              commentId: id,
              fromUid: current.uid,
              fromName: payload.authorName,
              text: `${payload.authorName} mentioned you: ${clean.slice(0, 120)}`,
              createdAt: now,
              read: false,
            });
          } catch (e) {
            console.warn('Mention notify failed', uid, e);
          }
        })
      );
    }
  }

  return {
    comment: mapComment(id, payload),
    flagged: mod.flagged,
  };
}

/**
 * Edit the text of your own comment. Re-runs the same sanitize + moderation
 * pipeline as posting a new comment, so an edit can't be used to slip
 * something past the profanity filter that a fresh comment couldn't. The
 * author identity, post, timestamp, and parent thread are immutable (also
 * enforced by database.rules.json) — only text/displayText/moderation
 * fields and `editedAt` change.
 *
 * Does not re-send reply/mention notifications on edit, to avoid spamming
 * people every time someone tweaks a typo.
 */
export async function updateComment(
  postId: string,
  commentId: string,
  newText: string
): Promise<{ comment: PostComment; flagged: boolean }> {
  const auth = getAuth();
  const current = auth.currentUser;
  if (!current || current.isAnonymous) {
    throw new Error('Sign in required to edit a comment');
  }

  const pid = (postId || '').trim();
  const cid = (commentId || '').trim();
  if (!pid || !cid) throw new Error('Invalid comment');

  const commentRef = ref(db, `${COMMENTS_PATH}/${pid}/${cid}`);
  const snap = await get(commentRef);
  if (!snap.exists()) throw new Error('Comment no longer exists');
  const existing = snap.val();
  if (existing.authorUid !== current.uid) {
    throw new Error('You can only edit your own comment');
  }

  const clean = sanitizeCommentText(newText);
  if (!clean) throw new Error('Comment is empty');
  if (clean.length > COMMENT_LIMITS.maxLen) {
    throw new Error(`Comment is too long (max ${COMMENT_LIMITS.maxLen} characters)`);
  }

  const mod = moderateCommentText(clean);
  if (mod.reason === 'empty') throw new Error('Comment is empty');

  const mentionRefs = parseMentions(clean);
  const mentionHandles: string[] = [];
  const mentionUids: string[] = [];
  for (const m of mentionRefs) {
    const entry = await resolveUsername(m.handle);
    if (entry?.uid && entry.uid !== current.uid) {
      mentionHandles.push(m.handle);
      if (!mentionUids.includes(entry.uid)) mentionUids.push(entry.uid);
    }
  }

  const now = Date.now();
  const status: CommentStatus = mod.flagged ? 'pending' : 'visible';
  const displayText = mod.flagged ? mod.sanitized : clean;

  const patch = {
    text: clean,
    displayText,
    status,
    flagged: !!mod.flagged,
    flagReason: mod.reason || null,
    matchedTerms: mod.matchedTerms.length ? mod.matchedTerms.slice(0, 20) : null,
    mentions: mentionHandles.length ? mentionHandles : null,
    mentionUids: mentionUids.length ? mentionUids : null,
    editedAt: now,
  };

  await update(commentRef, patch);

  if (mod.flagged) {
    const qRef = push(ref(db, MODERATION_PATH));
    await set(qRef, {
      type: 'comment',
      commentId: cid,
      postId: pid,
      text: clean,
      authorUid: current.uid,
      authorName: existing.authorName || 'User',
      flagReason: mod.reason || 'policy',
      matchedTerms: mod.matchedTerms.slice(0, 20),
      createdAt: now,
      status: 'open',
    });
  }

  return {
    comment: mapComment(cid, { ...existing, ...patch }),
    flagged: mod.flagged,
  };
}

/**
 * Live subscription to only the most recent `limit` comments (default 20, was a
 * flat 80 before). Keeps the realtime listener's payload small even on popular
 * posts — older history is fetched on demand via fetchOlderPostComments below,
 * as a one-shot read rather than an additional live listener.
 */
export function subscribeToRecentPostComments(
  postId: string,
  limit: number,
  onUpdate: (comments: PostComment[]) => void
): () => void {
  const commentsRef = ref(db, `${COMMENTS_PATH}/${postId}`);
  const q = query(commentsRef, orderByChild('createdAt'), limitToLast(limit));

  return onValue(
    q,
    (snap) => {
      const list: PostComment[] = [];
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          const c = mapComment(id, data);
          if (c.status === 'visible') list.push(c);
        }
      }
      list.sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

/**
 * One-shot (non-live) fetch of a page of comments strictly older than the given
 * cursor, for "load earlier comments" on scroll. Uses (createdAt, id) as a
 * compound cursor so same-millisecond comments aren't skipped or duplicated.
 * `hasMore` is based on the raw page size (before filtering hidden/pending
 * comments) so pagination doesn't stop early just because a page happened to
 * contain removed comments.
 */
export async function fetchOlderPostComments(
  postId: string,
  beforeCreatedAt: number,
  beforeId: string,
  pageSize = 20
): Promise<{ comments: PostComment[]; hasMore: boolean }> {
  const commentsRef = ref(db, `${COMMENTS_PATH}/${postId}`);
  const q = query(
    commentsRef,
    orderByChild('createdAt'),
    endBefore(beforeCreatedAt, beforeId),
    limitToLast(pageSize)
  );

  const snap = await get(q);
  const list: PostComment[] = [];
  let rawCount = 0;
  if (snap.exists()) {
    const val = snap.val() || {};
    for (const [id, data] of Object.entries(val) as [string, any][]) {
      rawCount += 1;
      const c = mapComment(id, data);
      if (c.status === 'visible') list.push(c);
    }
  }
  list.sort((a, b) => a.createdAt - b.createdAt);
  return { comments: list, hasMore: rawCount >= pageSize };
}



export function subscribeToModerationQueue(
  onUpdate: (items: ModerationItem[]) => void
): () => void {
  const qRef = ref(db, MODERATION_PATH);
  return onValue(
    qRef,
    (snap) => {
      const list: ModerationItem[] = [];
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          const t = data.type;
            const type: ModerationItem['type'] =
              t === 'user_report' ? 'user_report' : t === 'post_report' ? 'post_report' : 'comment';
            list.push({
            id,
            type,
            commentId: data.commentId || '',
            postId: data.postId || '',
            text: data.text || '',
            authorUid: data.authorUid || '',
            authorName: data.authorName || 'User',
            flagReason: data.flagReason,
            matchedTerms: Array.isArray(data.matchedTerms) ? data.matchedTerms : [],
            reportedBy: data.reportedBy || undefined,
            reportReason: data.reportReason || undefined,
            photoUrl: data.photoUrl || undefined,
            createdAt: data.createdAt || 0,
            status: data.status || 'open',
            reviewedAt: data.reviewedAt,
            reviewedBy: data.reviewedBy,
          });
        }
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

export async function approveModerationItem(
  item: ModerationItem,
  adminUid: string
): Promise<void> {
  // For auto-flagged comments, restore visibility and original text (displayText was
  // set to the redacted "•••" version at flag-time; we need to undo that here).
  // For user_report items the comment was already visible — only close the queue
  // entry; no comment mutation needed.
  // Auto-flagged comments need visibility restored. User/post reports stay as-is until remove.
  if (item.type === 'comment' && item.commentId && item.postId) {
    await update(ref(db, `${COMMENTS_PATH}/${item.postId}/${item.commentId}`), {
      status: 'visible',
      flagged: false,
      displayText: item.text,
      reviewedAt: Date.now(),
    });
  }
  await update(ref(db, `${MODERATION_PATH}/${item.id}`), {
    status: 'approved',
    reviewedAt: Date.now(),
    reviewedBy: adminUid,
  });
}

export async function removeModerationItem(
  item: ModerationItem,
  adminUid: string
): Promise<void> {
  if (item.type === 'post_report') {
    // Admin chose to remove the reported post
    if (item.postId) {
      await remove(ref(db, `elephant_posts/${item.postId}`));
    }
  } else if (item.commentId && item.postId) {
    await update(ref(db, `${COMMENTS_PATH}/${item.postId}/${item.commentId}`), {
      status: 'removed',
      reviewedAt: Date.now(),
    });
  }
  await update(ref(db, `${MODERATION_PATH}/${item.id}`), {
    status: 'removed',
    reviewedAt: Date.now(),
    reviewedBy: adminUid,
  });
}

/**
 * Delete a single comment/reply node.
 * Note: comments are stored as a flat list under post_comments/$postId,
 * each with its own `parentId`. Deleting a parent does NOT cascade to its
 * replies (they remain as separate, still-visible entries) — the UI
 * (PostComments) promotes orphaned replies to top-level so they never
 * silently disappear.
 */
export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await remove(ref(db, `${COMMENTS_PATH}/${postId}/${commentId}`));
}

/**
 * Submit a manual report for a comment that slipped past the profanity filter.
 * Writes a `user_report` entry to `moderation_queue` so admins see it alongside
 * auto-flagged content. The comment itself stays `visible` — the admin decides
 * whether to remove it.
 *
 * NOTE: Firebase rules must allow authenticated users to push to
 * `moderation_queue`. If reports are silently dropped, verify that rule.
 */
export async function reportComment(input: {
  postId: string;
  commentId: string;
  commentText: string;
  commentAuthorUid: string;
  commentAuthorName: string;
  reportedByUid: string;
  reason: ReportReason;
}): Promise<void> {
  const auth = getAuth();
  const current = auth.currentUser;
  if (!current || current.isAnonymous) throw new Error('Sign in required to report');
  if (current.uid !== input.reportedByUid) throw new Error('Security: reporter mismatch');
  if (current.uid === input.commentAuthorUid) throw new Error('Cannot report your own comment');

  const qRef = push(ref(db, MODERATION_PATH));
  await set(qRef, {
    type: 'user_report',
    commentId: input.commentId,
    postId: input.postId,
    text: input.commentText.slice(0, 1000),
    authorUid: input.commentAuthorUid,
    authorName: input.commentAuthorName.slice(0, 80),
    reportedBy: input.reportedByUid,
    reportReason: input.reason,
    flagReason: `user_report:${input.reason}`,
    matchedTerms: null,
    createdAt: Date.now(),
    status: 'open',
  });
}

/**
 * Submit a manual report for a post. Anyone signed in (not the post author) can
 * report. Writes a `post_report` entry to `moderation_queue` for admin review.
 * The post stays visible until an admin removes it.
 */
export async function reportPost(input: {
  postId: string;
  postCaption?: string;
  postAuthorUid: string;
  postAuthorName: string;
  photoUrl?: string;
  reportedByUid: string;
  reason: ReportReason;
}): Promise<void> {
  const auth = getAuth();
  const current = auth.currentUser;
  if (!current || current.isAnonymous) throw new Error('Sign in required to report');
  if (current.uid !== input.reportedByUid) throw new Error('Security: reporter mismatch');
  if (current.uid === input.postAuthorUid) throw new Error('Cannot report your own post');

  const qRef = push(ref(db, MODERATION_PATH));
  await set(qRef, {
    type: 'post_report',
    commentId: '',
    postId: input.postId,
    text: (input.postCaption || '').slice(0, 1000) || '(no caption)',
    authorUid: input.postAuthorUid,
    authorName: (input.postAuthorName || 'User').slice(0, 80),
    photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 2500) : null,
    reportedBy: input.reportedByUid,
    reportReason: input.reason,
    flagReason: `post_report:${input.reason}`,
    matchedTerms: null,
    createdAt: Date.now(),
    status: 'open',
  });
}

/** Live mention notifications for signed-in user */
export interface UserNotification {
  id: string;
  type: 'reply' | 'mention' | string;
  text: string;
  postId: string;
  commentId?: string;
  parentId?: string;
  fromUid?: string;
  fromName?: string;
  createdAt: number;
  read: boolean;
}

/** Live reply / mention notifications for signed-in user */
export function subscribeToUserNotifications(
  uid: string,
  onUpdate: (items: UserNotification[]) => void
): () => void {
  if (!uid) return () => {};
  const nRef = ref(db, `${USER_NOTIFS_PATH}/${uid}`);
  const q = query(nRef, orderByChild('createdAt'), limitToLast(50));
  return onValue(
    q,
    (snap) => {
      const list: UserNotification[] = [];
      if (snap.exists()) {
        for (const [id, d] of Object.entries(snap.val() || {}) as [string, any][]) {
          list.push({
            id,
            type: d.type || 'mention',
            text: d.text || '',
            postId: d.postId || '',
            commentId: d.commentId || '',
            parentId: d.parentId || '',
            fromUid: d.fromUid || '',
            fromName: d.fromName || '',
            createdAt: d.createdAt || 0,
            read: !!d.read,
          });
        }
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    () => onUpdate([])
  );
}

/** Mark one notification as read */
export async function markUserNotificationRead(
  uid: string,
  notificationId: string
): Promise<void> {
  if (!uid || !notificationId) return;
  await update(ref(db, `${USER_NOTIFS_PATH}/${uid}/${notificationId}`), {
    read: true,
  });
}

/** Mark all notifications as read */
export async function markAllUserNotificationsRead(uid: string): Promise<void> {
  if (!uid) return;
  const snap = await get(ref(db, `${USER_NOTIFS_PATH}/${uid}`));
  if (!snap.exists()) return;
  const updates: Record<string, boolean> = {};
  for (const id of Object.keys(snap.val() || {})) {
    updates[`${USER_NOTIFS_PATH}/${uid}/${id}/read`] = true;
  }
  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}
