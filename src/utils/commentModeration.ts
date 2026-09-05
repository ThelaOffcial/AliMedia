/**
 * Comment moderation for AliMedia.
 * Blocks explicit EN + Singlish abuse, obfuscation (F@#k, f*ck, s3x), and links.
 * Flagged comments stay hidden until admin approves.
 */

export type ModerationResult = {
  allowed: boolean;
  flagged: boolean;
  reason?: string;
  matchedTerms: string[];
  sanitized: string;
};

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
};

/** Strip to letters only, apply leet. "F@#k" → "fak", "f*ck" → "fck", "s3x" → "sex" */
function lettersOnly(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase().normalize('NFKC')) {
    if (LEET_MAP[ch]) out += LEET_MAP[ch];
    else if (/[a-z\u0D80-\u0DFF]/.test(ch)) out += ch;
  }
  return out;
}

function looseSpaced(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase().normalize('NFKC')) {
    if (LEET_MAP[ch]) out += LEET_MAP[ch];
    else if (/[a-z\u0D80-\u0DFF]/.test(ch)) out += ch;
    else if (/\s/.test(ch)) out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Wraps a pattern so it can't match as a substring in the middle of an
 * unrelated word (the "Scunthorpe problem" — e.g. "sex" inside "Sussex",
 * "rape" inside "therapist", "cock" inside "cockpit"). Requires that no
 * letter (Latin or Sinhala) sits immediately before/after the match.
 * Falls back to the unbounded pattern if lookbehind isn't supported by the
 * runtime (very old engines).
 */
function withWordBoundary(pattern: string): RegExp {
  try {
    return new RegExp(
      `(?<![a-zA-Z\\u0D80-\\u0DFF])(?:${pattern})(?![a-zA-Z\\u0D80-\\u0DFF])`,
      'i'
    );
  } catch {
    return new RegExp(pattern, 'i');
  }
}

/** Collapse runs of 3+ identical letters to 1 (e.g. "ffffuuuck" → "fuck"),
 *  to catch spammy stretched-out obfuscation without also squashing normal
 *  double letters like "book" or "class". Used only for detection, never
 *  for the text that gets displayed. */
function collapseStretchedLetters(input: string): string {
  return input.replace(/([a-zA-Z\u0D80-\u0DFF])\1{2,}/g, '$1');
}

/**
 * Build flexible regex: letters may have junk between them.
 * fuck → /f[^a-z]*u?[^a-z]*c[^a-z]*k/i  (u optional for F@#k → f..k still caught via extra rules)
 * Result is boundary-anchored so it only matches whole words, not substrings
 * buried inside unrelated words.
 */
function flexibleWordRe(word: string, optionalVowels = true): RegExp {
  const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
  const parts: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (optionalVowels && vowels.has(c)) {
      parts.push(`${esc}?`);
    } else {
      parts.push(esc);
    }
    if (i < word.length - 1) parts.push('[^a-zA-Z\\u0D80-\\u0DFF]*');
  }
  return withWordBoundary(parts.join(''));
}

const EN_WORDS = [
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'shit',
  'bullshit',
  'asshole',
  'arsehole',
  'bitch',
  'bastard',
  'dick',
  'dickhead',
  'cock',
  'cocksucker',
  'pussy',
  'cunt',
  'whore',
  'slut',
  'porn',
  'porno',
  'xxx',
  'nude',
  'nudes',
  'onlyfans',
  'sex',
  'sexy',
  'sexual',
  'sperm',
  'semen',
  'penis',
  'vagina',
  'boobs',
  'tits',
  'blowjob',
  'handjob',
  'cumshot',
  'orgasm',
  'masturbate',
  'masturbation',
  'rape',
  'rapist',
  'molest',
  'pedophile',
  'paedophile',
  'childporn',
  'csam',
  'nazi',
  'murder',
  'behead',
];

const EN_PHRASES = [
  'kill you',
  'kill yourself',
  'go die',
  'hand job',
  'blow job',
  'send nudes',
  'sex tape',
];

const SINGLISH = [
  'ponnaya',
  'ponnayek',
  'ponnayek',
  'huththa',
  'huththo',
  'hutto',
  'huththige',
  'hukanna',
  'hukapan',
  'pako',
  'pakaya',
  'pakayek',
  'wesige',
  'wesi',
  'vesi',
  'ballige',
  'balli',
  'maranna',
  'maranawa',
];

const SI_SCRIPT_RE =
  /(හුත්තෝ|හුත්තා|පකයා|පකෝ|වේසි|වේසිගේ|බැල්ලි|පොන්නයා|පොන්නයෙක්|මරන්න|මරනවා|හුකන්න)/i;

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+(?:com|lk|net|org|info|xyz|me|io|app|dev|tk|ml|ga|cf)\b/i;

/** Pre-built flexible regexes for short high-risk words (catches F@#k, f*ck, sh1t, …) */
const FLEX_RES: { re: RegExp; label: string }[] = [
  'fuck',
  'shit',
  'dick',
  'cock',
  'cunt',
  'porn',
  'sex',
  'slut',
  'whore',
  'bitch',
  'pussy',
  'nude',
  'rape',
  'ponnaya',
  'huththa',
  'huththo',
  'pakaya',
  'hukanna',
].map((w) => ({ re: flexibleWordRe(w, true), label: w }));

/** Skeletons when vowels/consonants are dropped or replaced with symbols: F@#k, f**k, sh*t.
 *  Boundary-wrapped so e.g. the loose "sex" skeleton can't match inside "Sussex"/"unisex". */
const SKELETON_RES: { re: RegExp; label: string }[] = [
  { re: withWordBoundary('f[\\W_0-9@#$%*]*u?[\\W_0-9@#$%*]*c?[\\W_0-9@#$%*]*k'), label: 'fuck' },
  { re: withWordBoundary('s[\\W_0-9@#$%*]*h[\\W_0-9@#$%*]*i?[\\W_0-9@#$%*]*t'), label: 'shit' },
  { re: withWordBoundary('d[\\W_0-9@#$%*]*i?[\\W_0-9@#$%*]*c[\\W_0-9@#$%*]*k'), label: 'dick' },
  { re: withWordBoundary('c[\\W_0-9@#$%*]*u?[\\W_0-9@#$%*]*n[\\W_0-9@#$%*]*t'), label: 'cunt' },
  { re: withWordBoundary('s[\\W_0-9@#$%*]*e?[\\W_0-9@#$%*]*x'), label: 'sex' },
  { re: withWordBoundary('p[\\W_0-9@#$%*]*o+[\\W_0-9@#$%*]*r[\\W_0-9@#$%*]*n'), label: 'porn' },
  { re: withWordBoundary('p[\\W_0-9@#$%*]*o+[\\W_0-9@#$%*]*n+[\\W_0-9@#$%*]*a+[\\W_0-9@#$%*]*y+[\\W_0-9@#$%*]*a+'), label: 'ponnaya' },
  { re: withWordBoundary('h[\\W_0-9@#$%*]*u+[\\W_0-9@#$%*]*t+[\\W_0-9@#$%*]*h*[\\W_0-9@#$%*]*t+[\\W_0-9@#$%*]*h*[\\W_0-9@#$%*]*a+'), label: 'huththa' },
];

export function moderateCommentText(raw: string): ModerationResult {
  const text = (raw || '').trim();
  if (!text) {
    return { allowed: false, flagged: false, reason: 'empty', matchedTerms: [], sanitized: '' };
  }
  if (text.length > 500) {
    return {
      allowed: false,
      flagged: false,
      reason: 'too_long',
      matchedTerms: [],
      sanitized: text.slice(0, 500),
    };
  }

  const matched: string[] = [];
  let category: string | undefined;

  if (URL_RE.test(text)) {
    matched.push('http_link');
    category = 'link';
  }

  const compact = lettersOnly(text);
  const loose = looseSpaced(text);
  // Word-preserving (keeps spaces) variant used for whole-word checks, plus a
  // stretched-letter-collapsed version to catch spammy "fuuuuck" style
  // obfuscation without breaking word boundaries.
  const looseCollapsed = collapseStretchedLetters(loose);

  // Whole-word matches only — never a bare substring — so words like
  // "therapist" (contains "rape"), "Sussex"/"unisex" (contain "sex"), and
  // "cockpit"/"cocktail" (contain "cock") are not falsely flagged.
  for (const w of EN_WORDS) {
    const bounded = withWordBoundary(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, ''));
    if (bounded.test(loose) || bounded.test(looseCollapsed)) {
      matched.push(w);
      category = category || 'explicit';
    }
  }
  for (const w of SINGLISH) {
    const bounded = withWordBoundary(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (bounded.test(loose) || bounded.test(looseCollapsed)) {
      matched.push(w);
      category = category || 'abuse_si';
    }
  }
  for (const p of EN_PHRASES) {
    if (loose.includes(p) || compact.includes(p.replace(/\s/g, ''))) {
      matched.push(p);
      category = category || 'harassment';
    }
  }

  // Flexible obfuscation: F@#k, f*ck, f.u.c.k, P0nnaya, …
  for (const { re, label } of FLEX_RES) {
    if (re.test(text) || re.test(compact) || re.test(looseCollapsed)) {
      if (!matched.includes(label)) matched.push(label);
      category = category || 'obfuscated';
    }
  }
  for (const { re, label } of SKELETON_RES) {
    if (re.test(text) || re.test(looseCollapsed)) {
      if (!matched.includes(label)) matched.push(label);
      category = category || 'obfuscated';
    }
  }

  const si = text.match(SI_SCRIPT_RE);
  if (si) {
    matched.push(si[0]);
    category = category || 'abuse_si';
  }

  const unique = Array.from(new Set(matched));
  const flagged = unique.length > 0;

  let sanitized = text;
  if (flagged) {
    sanitized = sanitized.replace(URL_RE, '[link removed]');
    for (const term of unique) {
      if (term === 'http_link') continue;
      try {
        sanitized = sanitized.replace(new RegExp(escapeRegExp(term), 'gi'), '•••');
      } catch {
        /* ignore */
      }
    }
  }

  return {
    allowed: !flagged,
    flagged,
    reason: category,
    matchedTerms: unique,
    sanitized: flagged ? sanitized : text,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
