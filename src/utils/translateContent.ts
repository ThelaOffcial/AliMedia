import { ref, get, set } from 'firebase/database';
import { db } from '../firebase/config';
import type { Language } from './translations';

/** Sinhala Unicode block */
const SINHALA_RE = /[\u0D80-\u0DFF]/;
/** Latin letters */
const LATIN_RE = /[A-Za-z]/;

const cache = new Map<string, string>();
const CACHE_PREFIX = 'alimedia_tr_';
const SHARED_CACHE_PATH = 'translations_cache';

/** Short hash of `target|text`, used both as a localStorage key suffix and the shared RTDB key. */
function hashOf(text: string, target: Language): string {
  let h = 0;
  const s = `${target}|${text}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${h}_${text.length}`;
}

function cacheKey(text: string, target: Language): string {
  return `${CACHE_PREFIX}${target}_${hashOf(text, target)}`;
}

function readLocalCache(text: string, target: Language): string | null {
  const mem = cache.get(`${target}|${text}`);
  if (mem) return mem;
  try {
    const v = localStorage.getItem(cacheKey(text, target));
    if (v) {
      cache.set(`${target}|${text}`, v);
      return v;
    }
  } catch {}
  return null;
}

function writeLocalCache(text: string, target: Language, translated: string) {
  cache.set(`${target}|${text}`, translated);
  try {
    localStorage.setItem(cacheKey(text, target), translated);
  } catch {}
}

/**
 * Shared cache in Realtime Database (translations_cache/{target}/{hash}) — the
 * first viewer to need a given caption/comment translated pays the API call;
 * every other viewer (any device, any session) reads the cached result instead
 * of re-hitting the unofficial Google Translate endpoint.
 */
async function readSharedCache(text: string, target: Language): Promise<string | null> {
  try {
    const snap = await get(ref(db, `${SHARED_CACHE_PATH}/${target}/${hashOf(text, target)}`));
    if (snap.exists()) {
      const val = snap.val();
      if (val && typeof val.translated === 'string') return val.translated;
    }
  } catch {
    // Offline, rules issue, etc — just fall through to the API path.
  }
  return null;
}

/** Fire-and-forget: don't block the UI on writing the shared cache back. */
function writeSharedCache(text: string, target: Language, translated: string): void {
  set(ref(db, `${SHARED_CACHE_PATH}/${target}/${hashOf(text, target)}`), {
    translated,
    updatedAt: Date.now(),
  }).catch(() => {});
}

export function isPrimarilySinhala(text: string): boolean {
  if (!text || !text.trim()) return false;
  const sin = (text.match(SINHALA_RE) || []).length;
  const lat = (text.match(LATIN_RE) || []).length;
  if (sin === 0) return false;
  // More Sinhala chars than Latin, or solid Sinhala presence
  return sin >= lat || sin >= 3;
}

export function isPrimarilyEnglish(text: string): boolean {
  if (!text || !text.trim()) return false;
  const sin = (text.match(SINHALA_RE) || []).length;
  const lat = (text.match(LATIN_RE) || []).length;
  if (lat === 0) return false;
  return lat > sin;
}

/**
 * Decide whether translation is needed for the target UI language.
 * - si: keep text that is already Sinhala; translate English → Sinhala
 * - en: keep text that is already English; translate Sinhala → English
 */
export function needsTranslation(text: string, target: Language): boolean {
  const t = (text || '').trim();
  if (!t || t.length < 2) return false;
  if (target === 'si') return !isPrimarilySinhala(t) && isPrimarilyEnglish(t);
  return !isPrimarilyEnglish(t) && isPrimarilySinhala(t);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Single network attempt, with a timeout so a hung request can't stall translation forever. */
async function fetchTranslationOnce(text: string, target: Language, timeoutMs = 6000): Promise<string> {
  const tl = target === 'si' ? 'si' : 'en';
  const sl = 'auto';
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`translate HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    // Response shape: [[["translated","original",...],...], ...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const parts = data[0]
        .filter((row: unknown) => Array.isArray(row) && typeof row[0] === 'string')
        .map((row: string[]) => row[0]);
      const joined = parts.join('');
      if (joined.trim()) return joined;
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retries transient failures (network errors, timeouts, 429 rate-limits, 5xx)
 * with exponential backoff + jitter. Does not retry on other 4xx responses,
 * since those won't succeed on a second attempt.
 */
async function fetchTranslationWithRetry(
  text: string,
  target: Language,
  maxAttempts = 3
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchTranslationOnce(text, target);
    } catch (err: any) {
      lastErr = err;
      const status = err?.status as number | undefined;
      const retryable = status === undefined || status === 429 || status >= 500;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!retryable || isLastAttempt) break;
      const backoff = 300 * 2 ** attempt + Math.random() * 200;
      await sleep(backoff);
    }
  }
  throw lastErr;
}

export interface TranslationResult {
  /** Translated text, or the original text if translation failed after retries. */
  text: string;
  /** True if translation was needed but every attempt failed — `text` is the untranslated original. */
  failed: boolean;
}

/**
 * Translate text to the target UI language if needed.
 * Prefer existing bilingual fields before calling this.
 * Checks memory -> localStorage -> shared RTDB cache -> API (with retry/backoff),
 * in that order, and writes results back to both local and shared caches.
 */
export async function translateToLanguage(
  text: string,
  target: Language
): Promise<TranslationResult> {
  const raw = text ?? '';
  if (!raw.trim()) return { text: raw, failed: false };
  if (!needsTranslation(raw, target)) return { text: raw, failed: false };

  const cached = readLocalCache(raw, target);
  if (cached) return { text: cached, failed: false };

  const shared = await readSharedCache(raw, target);
  if (shared) {
    writeLocalCache(raw, target, shared);
    return { text: shared, failed: false };
  }

  try {
    const MAX = 450;
    if (raw.length <= MAX) {
      const out = await fetchTranslationWithRetry(raw, target);
      writeLocalCache(raw, target, out);
      writeSharedCache(raw, target, out);
      return { text: out, failed: false };
    }

    // Split into paragraphs first so line breaks are never lost, then
    // chunk long paragraphs on sentence-ish boundaries to stay under URL limits.
    const paragraphs = raw.split('\n');
    const translatedParagraphs: string[] = [];
    let anyChunkFailed = false;

    const translateChunk = async (chunk: string): Promise<string> => {
      if (!needsTranslation(chunk, target)) return chunk;
      const localHit = readLocalCache(chunk, target);
      if (localHit) return localHit;
      const sharedHit = await readSharedCache(chunk, target);
      if (sharedHit) {
        writeLocalCache(chunk, target, sharedHit);
        return sharedHit;
      }
      try {
        const out = await fetchTranslationWithRetry(chunk, target);
        writeLocalCache(chunk, target, out);
        writeSharedCache(chunk, target, out);
        return out;
      } catch (err) {
        anyChunkFailed = true;
        console.warn('[translate] chunk failed, showing original:', err);
        return chunk;
      }
    };

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        translatedParagraphs.push(paragraph);
        continue;
      }
      if (paragraph.length <= MAX) {
        translatedParagraphs.push(await translateChunk(paragraph));
        continue;
      }

      const chunks: string[] = [];
      let buf = '';
      for (const part of paragraph.split(/(?<=[.!?])\s+/)) {
        if ((buf + ' ' + part).length > MAX && buf) {
          chunks.push(buf);
          buf = part;
        } else {
          buf = buf ? `${buf} ${part}` : part;
        }
      }
      if (buf) chunks.push(buf);

      const translatedParts: string[] = [];
      for (const chunk of chunks) {
        translatedParts.push(await translateChunk(chunk));
      }
      translatedParagraphs.push(translatedParts.join(' '));
    }

    const full = translatedParagraphs.join('\n');
    if (!anyChunkFailed) {
      writeLocalCache(raw, target, full);
      writeSharedCache(raw, target, full);
    }
    return { text: full, failed: anyChunkFailed };
  } catch (err) {
    console.warn('[translate] failed after retries, showing original:', err);
    return { text: raw, failed: true };
  }
}

/** Clear in-memory translation cache (localStorage kept). */
export function clearTranslationMemoryCache() {
  cache.clear();
}
