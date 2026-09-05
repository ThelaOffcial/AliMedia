/**
 * Shared client-side rate limits for engagement actions (likes, follows, etc.).
 * Complements RTDB rules; true hard limits need Cloud Functions.
 */

export type RateLimitResult = { ok: true } | { ok: false; waitSec: number };

type Bucket = {
  key: string;
  max: number;
  windowMs: number;
};

const buckets: Record<string, Bucket> = {
  like: { key: 'alimedia_rate_like', max: 40, windowMs: 60_000 },
  follow: { key: 'alimedia_rate_follow', max: 20, windowMs: 60_000 },
  bookmark: { key: 'alimedia_rate_bookmark', max: 30, windowMs: 60_000 },
};

function readTimes(storageKey: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const times: number[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(times) ? times.filter((t) => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

function writeTimes(storageKey: string, times: number[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(times));
  } catch {
    /* quota / private mode */
  }
}

/** Check + record one action. Returns waitSec when blocked. */
export function checkActionRateLimit(
  kind: keyof typeof buckets
): RateLimitResult {
  const bucket = buckets[kind];
  if (!bucket) return { ok: true };
  const now = Date.now();
  let times = readTimes(bucket.key).filter((t) => now - t < bucket.windowMs);
  if (times.length >= bucket.max) {
    const waitSec = Math.max(1, Math.ceil((bucket.windowMs - (now - times[0])) / 1000));
    return { ok: false, waitSec };
  }
  times.push(now);
  writeTimes(bucket.key, times);
  return { ok: true };
}

/** Assert helper — throws Error with a clear message when over limit. */
export function assertActionRateLimit(kind: keyof typeof buckets): void {
  const r = checkActionRateLimit(kind);
  if (r.ok === false) {
    throw new Error(`Too many actions. Try again in ${r.waitSec}s.`);
  }
}

export const ENGAGEMENT_RATE_LIMITS = {
  like: buckets.like,
  follow: buckets.follow,
  bookmark: buckets.bookmark,
};
