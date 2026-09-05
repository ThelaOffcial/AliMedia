/**
 * Comment text security: sanitize, parse @mentions, rate-limit helpers.
 */

const MENTION_RE = /@([a-zA-Z0-9._]{2,32})/g;
const MAX_MENTIONS = 5;
const MAX_COMMENT_LEN = 500;

/** Strip HTML / script / control chars — comments are plain text only */
export function sanitizeCommentText(raw: string): string {
  let s = (raw || '').toString();
  // Remove tags
  s = s.replace(/<[^>]*>/g, '');
  // Encode residual angle brackets
  s = s.replace(/</g, '').replace(/>/g, '');
  // Null bytes & most control chars (keep \n \t)
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  // Collapse weird unicode separators
  s = s.replace(/[\u2028\u2029]/g, ' ');
  // Trim & hard length
  s = s.trim().slice(0, MAX_COMMENT_LEN);
  return s;
}

export type MentionRef = {
  handle: string; // without @
  raw: string; // with @
};

/** Unique @handles in order of appearance (max MAX_MENTIONS) */
export function parseMentions(text: string): MentionRef[] {
  const out: MentionRef[] = [];
  const seen = new Set<string>();
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const handle = m[1].toLowerCase();
    if (seen.has(handle)) continue;
    seen.add(handle);
    out.push({ handle, raw: `@${m[1]}` });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

/** Client-side rate limit: max N comments per window per browser */
const RATE_KEY = 'alimedia_comment_rate';
const RATE_MAX = 8;
const RATE_WINDOW_MS = 60_000;

export function checkCommentRateLimit(): { ok: boolean; waitSec?: number } {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(RATE_KEY);
    let times: number[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(times)) times = [];
    times = times.filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX) {
      const waitSec = Math.ceil((RATE_WINDOW_MS - (now - times[0])) / 1000);
      return { ok: false, waitSec };
    }
    times.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(times));
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export const COMMENT_LIMITS = {
  maxLen: MAX_COMMENT_LEN,
  maxMentions: MAX_MENTIONS,
  rateMax: RATE_MAX,
  rateWindowMs: RATE_WINDOW_MS,
};
