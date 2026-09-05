/**
 * Official Ali Media team identities.
 * Only these accounts may post/comment as "Ali Media" with the verified badge.
 * Impersonation is blocked client-side and the display name is forced on write.
 */

export const ALI_MEDIA_TEAM_EMAILS = [
  'malakafernando21@gmail.com',
  'samithudinildewapriya@gmail.com',
] as const;

/**
 * Super-admin email: can edit/delete any community post (not only own).
 * Client UI gates on this email; RTDB writes still require the account's UID
 * under /admins/{uid} so security rules grant the override.
 */
export const SUPER_ADMIN_POST_EMAIL = 'samithudinildewapriya@gmail.com';

export function isSuperAdminPostEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_POST_EMAIL;
}

export const ALI_MEDIA_DISPLAY_NAME = 'Ali Media';
export const ALI_MEDIA_USERNAME = '@alimedia';
/** Official Ali Media logo used as team profile / post avatar */
export const ALI_MEDIA_LOGO_URL = '/icons/team-profile.png';

const emailSet = new Set(
  ALI_MEDIA_TEAM_EMAILS.map((e) => e.toLowerCase().trim())
);

export function isAliMediaTeamEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailSet.has(email.toLowerCase().trim());
}

/** Reserved names that non-team users cannot claim */
const RESERVED_DISPLAY = new Set([
  'ali media',
  'alimedia',
  'ali-media',
  'team alimedia',
  'team ali media',
]);

const RESERVED_HANDLES = new Set([
  'alimedia',
  'ali_media',
  'ali-media',
  'teamalimedia',
  'official_alimedia',
]);

export function isReservedAliMediaName(displayName: string): boolean {
  const n = (displayName || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return RESERVED_DISPLAY.has(n);
}

export function isReservedAliMediaHandle(username: string): boolean {
  const h = (username || '')
    .toLowerCase()
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-z0-9._-]/g, '');
  return RESERVED_HANDLES.has(h);
}

/**
 * Author fields for posts/comments. Team emails always appear as "Ali Media"
 * with verified flag so no one can imitate them.
 */
export function resolveAuthorIdentity(opts: {
  email?: string | null;
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
  fallbackName?: string;
}): {
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string;
  authorIsAliMedia: boolean;
} {
  if (isAliMediaTeamEmail(opts.email)) {
    return {
      authorName: ALI_MEDIA_DISPLAY_NAME,
      authorUsername: ALI_MEDIA_USERNAME,
      authorPhotoURL: ALI_MEDIA_LOGO_URL,
      authorIsAliMedia: true,
    };
  }
  return {
    authorName: (opts.displayName || opts.fallbackName || 'User').trim() || 'User',
    authorUsername: opts.username || '@user',
    authorPhotoURL: opts.photoURL || undefined,
    authorIsAliMedia: false,
  };
}
