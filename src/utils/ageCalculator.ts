/**
 * Elephant age calculation
 *
 * Living  → age from birth year/date to the current year/date (today)
 * Memorial (dead) → age from birth year/date to the death year/date only
 *                   (never advances after death)
 */

/** Extract a usable calendar date from year or YYYY-MM-DD (and similar). */
function parseFlexibleDate(rawInput: string): Date | null {
  const raw = (rawInput || '').trim();
  if (!raw) return null;

  // Bare year: "1965" or "1965?"
  const yearOnly = raw.match(/^(\d{4})\??$/);
  if (yearOnly) {
    const y = parseInt(yearOnly[1], 10);
    if (y >= 1800 && y <= 2100) {
      // Use mid-year so year-only → year-only difference is exact (endYear - birthYear)
      return new Date(y, 0, 1);
    }
    return null;
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 1800 && d.getFullYear() <= 2100) {
    return d;
  }
  return null;
}

/**
 * Whole years between birth and end.
 * If only years are known (Jan 1 both), result is deathYear - birthYear.
 */
export function calcAgeBetween(
  dateOfBirth: string,
  endDate?: string | null
): number | null {
  const birth = parseFlexibleDate(dateOfBirth);
  if (!birth) return null;

  let end: Date;
  if (endDate != null && String(endDate).trim() !== '') {
    const parsedEnd = parseFlexibleDate(String(endDate));
    if (!parsedEnd) return null; // memorial without a parseable death date → don't invent "today"
    end = parsedEnd;
  } else {
    end = new Date(); // living: until now
  }

  if (end.getTime() < birth.getTime()) return 0;

  let age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

/** Living age only (birth → today). */
export function calcAgeFromBirth(dateOfBirth: string): number | null {
  return calcAgeBetween(dateOfBirth, null);
}

/**
 * Display age for an elephant record.
 *
 * rules:
 * - status === 'memorial' (or has dateOfDeath): birth → death date/year
 * - otherwise (living): birth → today
 * - if calculation impossible, fall back to stored age
 */
export function resolveAge(
  dateOfBirth: string | undefined | null,
  storedAge: number | string | undefined | null,
  opts?: {
    status?: 'living' | 'memorial' | string | null;
    dateOfDeath?: string | null;
  }
): number | string {
  const status = (opts?.status || '').toString().toLowerCase().trim();
  const death = (opts?.dateOfDeath || '').toString().trim();
  const isDead = status === 'memorial' || death.length > 0;

  if (dateOfBirth) {
    if (isDead) {
      // Dead: ONLY birth → death. Never use today's date.
      if (death) {
        const atDeath = calcAgeBetween(String(dateOfBirth), death);
        if (atDeath !== null) return atDeath;
      }
      // Memorial but no usable death date → keep stored age (do not age to today)
      if (storedAge !== undefined && storedAge !== null && storedAge !== '') {
        return storedAge;
      }
      return '';
    }

    // Living: birth → now
    const living = calcAgeBetween(String(dateOfBirth), null);
    if (living !== null) return living;
  }

  if (storedAge !== undefined && storedAge !== null && storedAge !== '') {
    return storedAge;
  }
  return '';
}
