import {
  ref,
  get,
  set,
  update,
  remove,
} from 'firebase/database';
import { db } from './config';
import { assertActionRateLimit } from '../utils/rateLimit';
import { isAliMediaTeamEmail, isReservedAliMediaName, isReservedAliMediaHandle, ALI_MEDIA_DISPLAY_NAME, ALI_MEDIA_USERNAME, ALI_MEDIA_LOGO_URL } from '../utils/aliMediaTeam';
import { UserProfile } from '../types/user';
import { deleteElephantPost } from './postService';

const USERS_PATH = 'users';
const USERNAMES_PATH = 'usernames';
const ELEPHANTS_PATH = 'elephants';
const ELEPHANT_POSTS_PATH = 'elephant_posts';

/** Normalize handle: no @, lowercase, safe chars only */
export function normalizeUsernameHandle(raw: string): string {
  return (raw || '')
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 32);
}

/** Public index: usernames/{handle} → { uid, displayName, photoURL } for @mentions */
async function registerUsernameIndex(
  uid: string,
  username: string,
  displayName: string,
  photoURL: string
): Promise<void> {
  const handle = normalizeUsernameHandle(username);
  if (!handle || handle.length < 2) return;
  try {
    await set(ref(db, `${USERNAMES_PATH}/${handle}`), {
      uid,
      displayName: displayName || 'User',
      photoURL: photoURL || '',
      username: `@${handle}`,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('Username index write failed:', e);
  }
}

export type UsernameIndexEntry = {
  handle: string;
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
};

/** Resolve @handle → user (public usernames path) */
export async function resolveUsername(handleRaw: string): Promise<UsernameIndexEntry | null> {
  const handle = normalizeUsernameHandle(handleRaw);
  if (!handle) return null;
  try {
    const snap = await get(ref(db, `${USERNAMES_PATH}/${handle}`));
    if (!snap.exists()) return null;
    const d = snap.val() || {};
    return {
      handle,
      uid: d.uid || '',
      displayName: d.displayName || 'User',
      photoURL: d.photoURL || '',
      username: d.username || `@${handle}`,
    };
  } catch {
    return null;
  }
}

/** Prefix search for @ autocomplete (loads index once; fine for modest user counts) */
export async function searchUsernames(prefixRaw: string, limit = 8): Promise<UsernameIndexEntry[]> {
  const prefix = normalizeUsernameHandle(prefixRaw);
  if (!prefix || prefix.length < 1) return [];
  try {
    const snap = await get(ref(db, USERNAMES_PATH));
    if (!snap.exists()) return [];
    const val = snap.val() || {};
    const out: UsernameIndexEntry[] = [];
    for (const [handle, d] of Object.entries(val) as [string, any][]) {
      if (!handle.startsWith(prefix)) continue;
      out.push({
        handle,
        uid: d?.uid || '',
        displayName: d?.displayName || 'User',
        photoURL: d?.photoURL || '',
        username: d?.username || `@${handle}`,
      });
      if (out.length >= limit) break;
    }
    return out.sort((a, b) => a.handle.localeCompare(b.handle));
  } catch {
    return [];
  }
}

/**
 * Get or initialize user profile in Realtime Database after Google Sign-in
 */
export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const userRef = ref(db, `${USERS_PATH}/${user.uid}`);
  const email = user.email || '';
  const emailHandle = email
    ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '')
    : 'user';
  const defaultUsername = `@${emailHandle}`;
  const isTeam = isAliMediaTeamEmail(email);

  try {
    const snap = await get(userRef);
    if (snap.exists()) {
      const data = snap.val() || {};
      const updatedProfile: UserProfile = {
        uid: user.uid,
        email: email || data.email || '',
        displayName: isTeam ? ALI_MEDIA_DISPLAY_NAME : (user.displayName || data.displayName || 'Elephant Fan'),
        username: isTeam ? ALI_MEDIA_USERNAME : (data.username || defaultUsername),
        photoURL: isTeam
          ? ALI_MEDIA_LOGO_URL
          : (
              user.photoURL ||
              data.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
            ),
        bio: data.bio || 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
        followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
        suspended: !!data.suspended,
        createdAt: data.createdAt,
        updatedAt: Date.now(),
      };

      await update(userRef, {
        email: updatedProfile.email,
        displayName: updatedProfile.displayName,
        username: updatedProfile.username,
        photoURL: updatedProfile.photoURL,
        bio: updatedProfile.bio,
        followedElephants: updatedProfile.followedElephants,
        updatedAt: Date.now(),
      });
      await registerUsernameIndex(
        user.uid,
        updatedProfile.username,
        updatedProfile.displayName,
        updatedProfile.photoURL || ''
      );
      return updatedProfile;
    } else {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: email,
        displayName: isTeam ? ALI_MEDIA_DISPLAY_NAME : (user.displayName || 'Elephant Fan'),
        username: isTeam ? ALI_MEDIA_USERNAME : defaultUsername,
        photoURL: isTeam
          ? ALI_MEDIA_LOGO_URL
          : (
              user.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
            ),
        bio: 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
        followedElephants: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await set(userRef, newProfile);
      await registerUsernameIndex(
        user.uid,
        newProfile.username,
        newProfile.displayName,
        newProfile.photoURL || ''
      );
      return newProfile;
    }
  } catch (error) {
    console.warn('Error syncing user profile with Realtime Database:', error);
    return {
      uid: user.uid,
      email: email,
      displayName: user.displayName || 'Elephant Fan',
      username: defaultUsername,
      photoURL:
        user.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      bio: 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
      followedElephants: [],
    };
  }
}

/**
 * Fetch a user profile by UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await get(ref(db, `${USERS_PATH}/${uid}`));
    if (snap.exists()) {
      const data = snap.val() || {};
      return {
        uid: data.uid || uid,
        email: data.email,
        displayName: data.displayName,
        username: data.username,
        photoURL: data.photoURL,
        bio: data.bio,
        followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
        suspended: !!data.suspended,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Toggle following an elephant
 */
export async function toggleFollowElephantInDb(
  userId: string,
  elephantId: string,
  currentlyFollowing: boolean
): Promise<string[]> {
  assertActionRateLimit('follow');
  const userRef = ref(db, `${USERS_PATH}/${userId}`);
  const elephantRef = ref(db, `${ELEPHANTS_PATH}/${elephantId}`);

  try {
    const userSnap = await get(userRef);
    const followed: string[] = userSnap.exists()
      ? Array.isArray(userSnap.val()?.followedElephants)
        ? [...userSnap.val().followedElephants]
        : []
      : [];

    if (currentlyFollowing) {
      const next = followed.filter((id) => id !== elephantId);
      await update(userRef, {
        followedElephants: next,
        updatedAt: Date.now(),
      });
      try {
        const elSnap = await get(elephantRef);
        if (elSnap.exists()) {
          const count = typeof elSnap.val()?.followerCount === 'number' ? elSnap.val().followerCount : 0;
          await update(elephantRef, { followerCount: Math.max(0, count - 1) });
        }
      } catch (e) {
        // Ignore if elephant is read-only / missing
      }
    } else {
      if (!followed.includes(elephantId)) {
        followed.push(elephantId);
      }
      await update(userRef, {
        followedElephants: followed,
        updatedAt: Date.now(),
      });
      try {
        const elSnap = await get(elephantRef);
        if (elSnap.exists()) {
          const count = typeof elSnap.val()?.followerCount === 'number' ? elSnap.val().followerCount : 0;
          await update(elephantRef, { followerCount: count + 1 });
        }
      } catch (e) {
        // Ignore
      }
    }
  } catch (error) {
    console.warn('Error updating follow in Realtime Database:', error);
  }

  return [];
}

/**
 * Update user bio or username
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  const userRef = ref(db, `${USERS_PATH}/${userId}`);
  const snapExisting = await get(userRef);
  const existing = snapExisting.exists() ? snapExisting.val() || {} : {};
  const email = (data.email as string) || existing.email || '';
  const isTeam = isAliMediaTeamEmail(email);

  // Block impersonation of official Ali Media identity
  if (!isTeam) {
    if (data.displayName && isReservedAliMediaName(String(data.displayName))) {
      throw new Error('That display name is reserved for the official Ali Media team.');
    }
    if (data.username && isReservedAliMediaHandle(String(data.username))) {
      throw new Error('That username is reserved for the official Ali Media team.');
    }
  } else {
    // Team accounts always keep official branding + logo
    data = {
      ...data,
      displayName: ALI_MEDIA_DISPLAY_NAME,
      username: ALI_MEDIA_USERNAME,
      photoURL: ALI_MEDIA_LOGO_URL,
    };
  }

  await update(userRef, {
    ...data,
    updatedAt: Date.now(),
  });
  if (data.username || data.displayName || data.photoURL) {
    const snap = await get(userRef);
    const cur = snap.exists() ? snap.val() || {} : {};
    await registerUsernameIndex(
      userId,
      (data.username as string) || cur.username || '',
      (data.displayName as string) || cur.displayName || 'User',
      (data.photoURL as string) || cur.photoURL || ''
    );
  }
}

/**
 * Fetch every registered user profile (Admin use)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await get(ref(db, USERS_PATH));
    if (!snap.exists()) {
      return [];
    }
    const val = snap.val() || {};
    const users: UserProfile[] = Object.entries(val).map(([id, data]: [string, any]) => ({
      uid: data.uid || id,
      email: data.email || '',
      displayName: data.displayName || 'Elephant Fan',
      username: data.username || '@user',
      photoURL: data.photoURL || '',
      bio: data.bio || '',
      followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
      suspended: !!data.suspended,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }));
    users.sort((a: any, b: any) => {
      const aMs = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt?.toMillis?.() || 0;
      const bMs = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

/**
 * Permanently remove a user's profile (Admin use only).
 *
 * Cascades the same way deleting a single post does (see
 * `deleteElephantPost` in postService.ts): each of the user's posts has its
 * photo stripped from the elephant's gallery and its `post_likes` entry
 * removed, so nothing is left orphaned. Also removes the user's
 * `usernames/{handle}` index entry so @mentions stop resolving to a deleted
 * account.
 */
export async function deleteUserAccount(userId: string): Promise<{
  postsDeleted: number;
  elephantsUpdated: number;
}> {
  let postsDeleted = 0;
  let elephantsUpdated = 0;

  const userRef = ref(db, `${USERS_PATH}/${userId}`);
  const userSnap = await get(userRef);
  const userData = userSnap.exists() ? userSnap.val() || {} : {};
  const followedElephants: string[] = userData.followedElephants || [];

  // 1. Decrement followerCount on every elephant this user followed
  if (followedElephants.length > 0) {
    const updates = followedElephants.map(async (elephantId) => {
      try {
        const elephantRef = ref(db, `${ELEPHANTS_PATH}/${elephantId}`);
        const elSnap = await get(elephantRef);
        if (elSnap.exists()) {
          const count =
            typeof elSnap.val()?.followerCount === 'number' ? elSnap.val().followerCount : 0;
          await update(elephantRef, { followerCount: Math.max(0, count - 1) });
          elephantsUpdated++;
        }
      } catch (e) {
        // Elephant may no longer exist
      }
    });
    await Promise.all(updates);
  }

  // 2. Delete this user's community posts/stories — via deleteElephantPost
  //    so the elephant gallery photo and post_likes are cleaned up too,
  //    not just the post node itself.
  try {
    const postsSnap = await get(ref(db, ELEPHANT_POSTS_PATH));
    if (postsSnap.exists()) {
      const posts = postsSnap.val() || {};
      const postIds = Object.entries(posts)
        .filter(([, postData]: [string, any]) => postData?.authorUid === userId)
        .map(([postId]) => postId);

      const deletions = postIds.map(async (postId) => {
        try {
          await deleteElephantPost(postId);
          postsDeleted++;
        } catch (e) {
          // Fall back to a raw removal so the post doesn't survive the
          // account deletion even if the cascade cleanup step failed
          // (e.g. the calling admin session couldn't be re-verified).
          console.warn(`Falling back to raw delete for post ${postId}:`, e);
          try {
            await remove(ref(db, `${ELEPHANT_POSTS_PATH}/${postId}`));
            postsDeleted++;
          } catch (e2) {
            console.warn(`Could not delete post ${postId} during account deletion:`, e2);
          }
        }
      });
      await Promise.all(deletions);
    }
  } catch (e) {
    console.warn('Could not clean up user posts during account deletion:', e);
  }

  // 3. Remove the username index entry so @mentions stop resolving to a
  //    deleted account.
  try {
    const handle = normalizeUsernameHandle(userData.username || '');
    if (handle) {
      const handleSnap = await get(ref(db, `${USERNAMES_PATH}/${handle}`));
      if (handleSnap.exists() && handleSnap.val()?.uid === userId) {
        await remove(ref(db, `${USERNAMES_PATH}/${handle}`));
      }
    }
  } catch (e) {
    console.warn('Could not remove username index during account deletion:', e);
  }

  // 4. Remove personal activity data (bookmarks + in-app message notifications)
  try {
    await remove(ref(db, `user_bookmarks/${userId}`));
  } catch (e) {
    console.warn('Could not remove user bookmarks during account deletion:', e);
  }
  try {
    await remove(ref(db, `user_notifications/${userId}`));
  } catch (e) {
    console.warn('Could not remove user notifications during account deletion:', e);
  }

  // 5. Delete the user's profile (includes fcmTokens, blocked, followedElephants, etc.)
  await remove(userRef);

  return { postsDeleted, elephantsUpdated };
}


/**
 * Suspend or unsuspend a user (Admin only).
 * Suspended users keep their account but should not post or interact.
 */
export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const userRef = ref(db, `${USERS_PATH}/${userId}`);
  await update(userRef, {
    suspended: !!suspended,
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Block / mute
// Stored at users/{viewerUid}/blocked/{targetUid} so reads and writes are
// always scoped to the current user's own sub-tree — no extra rules needed
// beyond the standard "users/{uid} readable/writable by auth.uid === uid".
// ---------------------------------------------------------------------------

/**
 * Block targetUid from the perspective of viewerUid.
 * Their posts and comments will be hidden client-side for viewerUid only.
 */
export async function blockUser(viewerUid: string, targetUid: string): Promise<void> {
  if (!viewerUid || !targetUid || viewerUid === targetUid) return;
  await set(ref(db, `${USERS_PATH}/${viewerUid}/blocked/${targetUid}`), {
    blockedAt: Date.now(),
  });
}

/** Remove a block previously placed by viewerUid on targetUid. */
export async function unblockUser(viewerUid: string, targetUid: string): Promise<void> {
  if (!viewerUid || !targetUid) return;
  await remove(ref(db, `${USERS_PATH}/${viewerUid}/blocked/${targetUid}`));
}

/**
 * Return the list of UIDs that viewerUid has blocked.
 * One-shot read; fine to call once per comment-thread open.
 */
export async function getBlockedUsers(viewerUid: string): Promise<string[]> {
  if (!viewerUid) return [];
  try {
    const snap = await get(ref(db, `${USERS_PATH}/${viewerUid}/blocked`));
    if (!snap.exists()) return [];
    return Object.keys(snap.val() || {});
  } catch {
    return [];
  }
}
