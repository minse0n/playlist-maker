import { normalizeText } from "@/lib/scoring/normalize";
import type { ParsedTrack } from "@/lib/types";

const HINT_RULES: Array<{ hint: string; pattern: RegExp }> = [
  { hint: "instrumental", pattern: /\binst(?:rumental)?\b|\bmr\b|인스트/i },
  { hint: "live", pattern: /\blive\b|라이브|콘서트/i },
  { hint: "acoustic", pattern: /\bacoustic\b|어쿠스틱/i },
  { hint: "remix", pattern: /\bremix\b|\brmx\b|리믹스/i },
  { hint: "mv", pattern: /\bmv\b|m\/v|뮤비|뮤직\s?비디오/i },
  { hint: "cover", pattern: /\bcover\b|커버/i },
];

const NEGATION = "\\s*(?:말고|빼고|제외|아닌)";

/** Hint keywords the user literally wrote in the line, skipping negated ones ("라이브 말고"). */
export function extractHints(rawLine: string): string[] {
  return HINT_RULES.filter(({ pattern }) => {
    if (!pattern.test(rawLine)) return false;
    const negated = new RegExp(`(?:${pattern.source})${NEGATION}`, "i").test(rawLine);
    return !negated;
  }).map((r) => r.hint);
}

const HINT_GROUP = /\s*[(\[（][^)\]）]*(?:inst|live|acoustic|remix|mv|ver|라이브|어쿠스틱|리믹스)[^)\]）]*[)\]）]/gi;
const BARE_HINT_WORDS = /\binst(?:rumental)?\b\.?|\blive\b|\bacoustic\b|\bremix\b|라이브|어쿠스틱|리믹스|원곡|말고/gi;
const EDGE_SEPARATORS = /^[\s/\-–—|·,]+|[\s/\-–—|·,]+$/g;

/**
 * LLMs sometimes translate or "correct" the title (e.g. Japanese -> Korean), which makes both the
 * YouTube query and title scoring miss the real track. When the LLM's title does not appear in the
 * user's own line, rebuild it from the line (line minus artist minus hint words) and keep the
 * LLM's version as an alternate.
 */
export function anchorTitleToRawLine(track: ParsedTrack): ParsedTrack {
  const normRaw = normalizeText(track.rawLine);
  if (normRaw.includes(normalizeText(track.title))) return track;

  const artistForms = [track.artist, ...track.altArtists].filter(Boolean);
  const artistForm = artistForms.find((a) => normRaw.includes(normalizeText(a)));
  if (!artistForm) return track;

  const remainder = track.rawLine
    .replace(new RegExp(artistForm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
    .replace(HINT_GROUP, " ")
    .replace(BARE_HINT_WORDS, " ")
    .replace(/\s+/g, " ")
    .replace(EDGE_SEPARATORS, "")
    .trim();

  if (!remainder) return track;
  return { ...track, title: remainder, altTitles: [track.title, ...track.altTitles.filter((t) => t !== track.title)] };
}

export function postprocessParsedTrack(track: ParsedTrack): ParsedTrack {
  const anchored = anchorTitleToRawLine(track);
  const hints = [...new Set([...anchored.hints.map((h) => h.trim().toLowerCase()), ...extractHints(anchored.rawLine)])].filter(Boolean);
  return { ...anchored, hints };
}
