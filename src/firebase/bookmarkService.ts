import { ref, get, set, remove, onValue, update } from 'firebase/database';
import { db } from './config';
import { assertActionRateLimit } from '../utils/rateLimit';
import { addElephantPost } from './postService';
import type { ElephantPost } from '../types/elephant';

const BOOKMARKS_PATH = 'user_bookmarks';

export type BookmarkEntry = {
  postId: string;
  savedAt: number;
  /** Snapshot so profile still works if original is deleted */
  photoUrl?: string;
  caption?: string;
  elephantId?: string;
  elephantName?: string;
  elephantSinhalaName?: string;
  originalAuthorName?: string;
  originalAuthorUsername?: string;
  aspectRatio?: string;
};

export async function toggleBookmarkPost(
  uid: string,
  post: Pick<ElephantPost, 'id' | 'photoUrl' | 'caption' | 'elephantId' | 'elephantName' | 'elephantSinhalaName' | 'authorName' | 'authorUsername' | 'aspectRatio'> & { id?: string },
  currentlySaved: boolean
): Promise<boolean> {
  if (!uid || !post.id) throw new Error('Missing user or post');
  assertActionRateLimit('bookmark');
  const path = `${BOOKMARKS_PATH}/${uid}/${post.id}`;
  if (currentlySaved) {
    await remove(ref(db, path));
    return false;
  }
  const entry: BookmarkEntry = {
    postId: post.id,
    savedAt: Date.now(),
    photoUrl: post.photoUrl,
    caption: (post.caption || '').slice(0, 500),
    elephantId: post.elephantId,
    elephantName: post.elephantName,
    elephantSinhalaName: post.elephantSinhalaName,
    originalAuthorName: post.authorName,
    originalAuthorUsername: post.authorUsername,
    aspectRatio: post.aspectRatio,
  };
  await set(ref(db, path), entry);
  return true;
}

export function subscribeToUserBookmarks(
  uid: string,
  onUpdate: (map: Record<string, BookmarkEntry>) => void
): () => void {
  if (!uid) return () => onUpdate({});
  return onValue(
    ref(db, `${BOOKMARKS_PATH}/${uid}`),
    (snap) => {
      const map: Record<string, BookmarkEntry> = {};
      if (snap.exists()) {
        const val = snap.val() || {};
        for (const [id, data] of Object.entries(val) as [string, any][]) {
          map[id] = {
            postId: data.postId || id,
            savedAt: data.savedAt || 0,
            photoUrl: data.photoUrl,
            caption: data.caption,
            elephantId: data.elephantId,
            elephantName: data.elephantName,
            elephantSinhalaName: data.elephantSinhalaName,
            originalAuthorName: data.originalAuthorName,
            originalAuthorUsername: data.originalAuthorUsername,
            aspectRatio: data.aspectRatio,
          };
        }
      }
      onUpdate(map);
    },
    () => onUpdate({})
  );
}

/**
 * Reshare a post to the current user's account (appears in community feed under them).
 */
export async function resharePostToAccount(
  original: ElephantPost | BookmarkEntry & { id?: string },
  user: {
    uid: string;
    displayName: string;
    username?: string;
    photoURL?: string;
  }
): Promise<string> {
  if (!user.uid) throw new Error('Sign in required');
  const photoUrl =
    'photoUrl' in original ? original.photoUrl : (original as unknown as ElephantPost).photoUrl;
  if (!photoUrl || !String(photoUrl).startsWith('https://')) {
    throw new Error('This post cannot be reshared (missing image URL)');
  }

  const elephantId =
    ('elephantId' in original && original.elephantId) || '';
  const elephantName =
    ('elephantName' in original && original.elephantName) || 'Elephant';
  const originalAuthor =
    ('originalAuthorName' in original && original.originalAuthorName) ||
    ('authorName' in original && (original as unknown as ElephantPost).authorName) ||
    'someone';
  const captionBase =
    ('caption' in original && original.caption) || '';
  const caption = captionBase
    ? `${captionBase}\n\n↻ Reshared from ${originalAuthor}`
    : `↻ Reshared from ${originalAuthor}`;

  const originalId =
    ('postId' in original && original.postId) ||
    ('id' in original && original.id) ||
    '';

  return addElephantPost({
    elephantId: elephantId || 'reshare',
    elephantName: String(elephantName),
    elephantSinhalaName:
      ('elephantSinhalaName' in original && original.elephantSinhalaName) || '',
    photoUrl: String(photoUrl),
    caption: caption.slice(0, 500),
    authorUid: user.uid,
    authorName: user.displayName || 'User',
    authorUsername: user.username || '@user',
    authorPhotoURL: user.photoURL || '',
    likesCount: 0,
    likedBy: [],
    isStory: false,
    isStoryOnly: false,
    aspectRatio: (original as any).aspectRatio,
    // extra fields stored via sanitize - add to type as optional
    ...(originalId
      ? ({ originalPostId: originalId, isReshare: true } as any)
      : ({ isReshare: true } as any)),
  });
}
