/**
 * Tashkeel Mechanical Invariant Engine (T-B)
 * Pure string processing unit - zero DOM dependency.
 * Guarantees zero text loss, letter additions, or unintended mutations.
 */

// Arabic Diacritics Range (Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun + variants)
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

// Arabic Tatweel / Kashida
const TATWEEL_REGEX = /\u0640/g;

// Arabic & Common Punctuation Marks
// [، ؛ . ؟ ! : " « » ( ) … - – — ? ! ' " [ ] { } / \ *]
const PUNCTUATION_REGEX = /[،؛.؟!:"«»()…\-–—?!'"[\]{}/\\*]/g;

// White space collapse
const MULTI_SPACE_REGEX = /\s+/g;

/**
 * 1. stripForCompare(s)
 * Removes diacritics, tatweel, and punctuation, then collapses whitespace.
 */
export function stripForCompare(s: string): string {
  if (!s) return "";
  return s
    .replace(DIACRITICS_REGEX, "")
    .replace(TATWEEL_REGEX, "")
    .replace(PUNCTUATION_REGEX, " ")
    .replace(MULTI_SPACE_REGEX, " ")
    .trim();
}

/**
 * 2. hamzaFold(s)
 * Unifies the Hamza family {ا, أ, إ, آ, ؤ, ئ, ء} to a single representation ('ا').
 * CRITICAL CONSTRAINT: MUST NOT touch ة/ه or ى/ي.
 */
export function hamzaFold(s: string): string {
  if (!s) return "";
  return s.replace(/[أإآؤئء]/g, "ا");
}

/**
 * 3. invariantHolds(original, vocalized)
 * Mathematically verifies that the vocalized output matches the original text character-for-character,
 * permitting only valid diacritics, punctuation changes (« », commas, etc.), and hamza corrections within the family.
 * Returns false if ANY word or character outside the hamza family was added, deleted, or substituted.
 */
export function invariantHolds(original: string, vocalized: string): boolean {
  if (!original && !vocalized) return true;
  if (!original || !vocalized) return false;

  const normalizedOrig = hamzaFold(stripForCompare(original));
  const normalizedVoc = hamzaFold(stripForCompare(vocalized));

  return normalizedOrig === normalizedVoc;
}

/**
 * 4. diacriticDensity(s)
 * Calculates the density of diacritical marks in the given string.
 * Ratio = (count of diacritics) / (count of Arabic letters).
 * Threshold = 0.10 (10%). If density >= 0.10, the block is considered already sufficiently vocalized and can be skipped.
 */
export function diacriticDensity(s: string): number {
  if (!s) return 0;
  const diacriticsMatches = s.match(/[\u064B-\u0652]/g);
  const diacriticsCount = diacriticsMatches ? diacriticsMatches.length : 0;

  const arabicLettersMatches = s.match(/[\u0621-\u064A]/g);
  const letterCount = arabicLettersMatches ? arabicLettersMatches.length : 0;

  if (letterCount === 0) return 0;
  return diacriticsCount / letterCount;
}

export const VOCALIZATION_DENSITY_THRESHOLD = 0.10;

/**
 * Checks if a block of text is already sufficiently vocalized.
 */
export function isAlreadyVocalized(text: string): boolean {
  return diacriticDensity(text) >= VOCALIZATION_DENSITY_THRESHOLD;
}

/**
 * 5. parseNumberedBatch(text, expectedCount)
 * Parses batch response formatted as:
 * [1] text 1
 * [2] text 2
 * [3] text 3
 *
 * Enforces exact count matches: missing or surplus blocks cause a batch failure (returns null).
 */
export function parseNumberedBatch(text: string, expectedCount: number): string[] | null {
  if (!text || expectedCount <= 0) return null;

  const results: string[] = [];

  // Match [N] markers
  for (let i = 1; i <= expectedCount; i++) {
    const currentMarker = `[${i}]`;
    const nextMarker = `[${i + 1}]`;

    const startIdx = text.indexOf(currentMarker);
    if (startIdx === -1) {
      return null; // Missing marker i
    }

    const contentStart = startIdx + currentMarker.length;
    let contentEnd: number;

    if (i < expectedCount) {
      const nextIdx = text.indexOf(nextMarker, contentStart);
      if (nextIdx === -1) {
        return null; // Missing subsequent marker
      }
      contentEnd = nextIdx;
    } else {
      // For the last item, check if an unexpected [expectedCount + 1] exists
      const surplusMarker = `[${expectedCount + 1}]`;
      const surplusIdx = text.indexOf(surplusMarker, contentStart);
      if (surplusIdx !== -1) {
        return null; // Surplus marker detected
      }
      contentEnd = text.length;
    }

    const blockText = text.substring(contentStart, contentEnd).trim();
    results.push(blockText);
  }

  if (results.length !== expectedCount) {
    return null;
  }

  return results;
}
