/**
 * Normalizes text for matching/cache-key purposes: NFKC (so full-width, romanized
 * and combining-mark variants of Korean/Japanese/English collapse together),
 * lowercased, punctuation stripped, whitespace collapsed.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?'"()[\]{}\-_/\\~*·・、。！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHints(hints: string[]): string[] {
  return [...new Set(hints.map((h) => normalizeText(h)).filter(Boolean))].sort();
}

export function buildCacheKey(artist: string, title: string, hints: string[]): string {
  return [normalizeText(artist), normalizeText(title), normalizeHints(hints).join(",")].join("|");
}

export function containsNormalized(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}
