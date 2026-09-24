import { CONFIDENCE_BUCKETS, REQUIRED_WHEN_HINTED, SCORING, VARIANT_KEYWORDS } from "@/lib/constants";
import type { MatchPreference, ParsedTrack, ScoredCandidate, TrackHint, YoutubeCandidate } from "@/lib/types";
import { normalizeText } from "@/lib/scoring/normalize";

const OFFICIAL_CHANNEL_MARKERS = [
  "official",
  "music",
  "records",
  "entertainment",
  "ent.",
  "label",
  "공식",
];

function artistForms(track: ParsedTrack): string[] {
  return [track.artist, ...track.altArtists].filter(Boolean);
}

function titleForms(track: ParsedTrack): string[] {
  return [track.title, ...track.altTitles].filter(Boolean);
}

function anyFormIn(forms: string[], haystack: string): boolean {
  const normHaystack = normalizeText(haystack);
  return forms.some((f) => normHaystack.includes(normalizeText(f)));
}

// Auto-generated "<Artist> - Topic" channels are often named in English while the user typed
// the artist in Korean/Japanese, but their description lists "Title · Artist" in the user's
// script, so the description is checked as well as the channel name.
// A Topic upload whose title is exactly the requested title also counts: the channel name is
// often the artist's English name and the LLM does not always supply it as an alternate.
function isTopicChannel(
  channelTitle: string,
  description: string,
  videoTitle: string,
  artists: string[],
  titles: string[],
): boolean {
  if (!normalizeText(channelTitle).endsWith(" topic")) return false;
  if (anyFormIn(artists, `${channelTitle} ${description}`)) return true;
  const variants = titleVariants(videoTitle);
  return titles.some((t) => variants.includes(normalizeText(t)));
}

/** The video title itself, without parentheticals, and each parenthetical's inner text
 * ("Eye To Eye (바라본다면)" -> the whole title, "eye to eye", "바라본다면"). */
function titleVariants(videoTitle: string): string[] {
  const inners = [...videoTitle.matchAll(/[(\[（]([^)\]）]*)[)\]）]/g)].map((m) => m[1]);
  const stripped = videoTitle.replace(/[(\[（][^)\]）]*[)\]）]/g, " ");
  return [videoTitle, stripped, ...inners].map((v) => normalizeText(v)).filter(Boolean);
}

function isOfficialChannel(channelTitle: string, forms: string[]): boolean {
  const norm = normalizeText(channelTitle);
  if (!anyFormIn(forms, channelTitle)) return false;
  if (OFFICIAL_CHANNEL_MARKERS.some((m) => norm.includes(m))) return true;
  // Channel name is (close to) exactly the artist name, e.g. "IU" or "아이유".
  return forms.some((f) => normalizeText(f) === norm);
}

function hintMatchesKeyword(hints: TrackHint[], pattern: RegExp): boolean {
  return hints.some((h) => pattern.test(h));
}

export function scoreCandidate(
  track: ParsedTrack,
  candidate: YoutubeCandidate,
  preference: MatchPreference,
): ScoredCandidate {
  let score = 0;
  const reasons: string[] = [];

  const forms = artistForms(track);
  const titles = titleForms(track);
  const searchable = `${candidate.title} ${candidate.descriptionSnippet}`;

  const topic = isTopicChannel(candidate.channelTitle, candidate.descriptionSnippet, candidate.title, forms, titles);
  const official = isOfficialChannel(candidate.channelTitle, forms);

  if (topic) {
    const bonus = preference === "audio" ? 50 : 20;
    score += bonus;
    reasons.push(`artist Topic channel (+${bonus})`);
  }
  if (official) {
    const bonus = preference === "mv" ? 45 : 30;
    score += bonus;
    reasons.push(`official artist/label channel (+${bonus})`);
  }

  const hasArtist = anyFormIn(forms, candidate.title);
  const hasTitle = anyFormIn(titles, candidate.title);
  if (hasArtist) {
    score += 15;
    reasons.push("title contains artist (+15)");
  }
  if (hasTitle) {
    score += 20;
    reasons.push("title contains track title (+20)");
  }
  if (hasArtist && hasTitle) {
    score += 10;
    reasons.push("title contains both (+10)");
  }

  const duration = candidate.durationSeconds;
  const hintsAllowLong = hintMatchesKeyword(track.hints, /live|concert|mix|풀|앨범/i);
  if (duration < 60) {
    score -= 40;
    reasons.push("under 60s, likely teaser/short (-40)");
  } else if (duration <= 420) {
    score += 10;
    reasons.push("plausible song length (+10)");
  } else if (duration <= 600) {
    // neutral
  } else if (!hintsAllowLong) {
    score -= 25;
    reasons.push("over 10 minutes, no hint allows it (-25)");
  }

  for (const { pattern, label, penalty } of VARIANT_KEYWORDS) {
    if (penalty === 0) continue; // "official mv" entry is informational only, handled by preference tiebreak below
    const matched = pattern.test(searchable);
    if (!matched) continue;
    const hinted = hintMatchesKeyword(track.hints, pattern);
    if (hinted) {
      score += 15;
      reasons.push(`${label} matches user hint (+15)`);
    } else {
      score -= penalty;
      reasons.push(`${label} not requested (-${penalty})`);
    }
  }

  // A variant the user explicitly asked for (e.g. "Inst.") that this video lacks is a worse match
  // than a video that has it, even if the plain version looks more "official".
  for (const { pattern, label } of REQUIRED_WHEN_HINTED) {
    if (hintMatchesKeyword(track.hints, pattern) && !pattern.test(candidate.title)) {
      score -= 25;
      reasons.push(`user asked for ${label} but it is not present (-25)`);
    }
  }

  if (preference === "audio" && /official\s?audio|\(audio\)/i.test(candidate.title)) {
    score += 10;
    reasons.push("labelled official audio (+10)");
  }

  const looksLikeOfficialMv = /official\s?(music\s?)?video|\bmv\b/i.test(candidate.title);
  if (preference === "audio" && looksLikeOfficialMv && !topic) {
    score -= 5;
    reasons.push("official MV but audio preferred (-5)");
  }
  if (preference === "mv" && topic) {
    score -= 10;
    reasons.push("Topic audio but MV preferred (-10)");
  }

  return { ...candidate, score, reasons };
}

export function scoreCandidates(
  track: ParsedTrack,
  candidates: YoutubeCandidate[],
  preference: MatchPreference,
): ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(track, c, preference))
    .sort((a, b) => b.score - a.score);
}

export type Classification =
  | { status: "not_found" }
  | { status: "matched"; selectedVideoId: string }
  | { status: "needs_disambiguation" };

export function classifyScored(sorted: ScoredCandidate[]): Classification {
  if (sorted.length === 0) return { status: "not_found" };
  const [top1, top2] = sorted;
  const margin = top1.score - (top2?.score ?? -Infinity);
  if (top1.score >= SCORING.CONFIDENT_THRESHOLD && margin >= SCORING.CONFIDENT_MARGIN) {
    return { status: "matched", selectedVideoId: top1.videoId };
  }
  return { status: "needs_disambiguation" };
}

export function confidenceBucket(score: number | undefined): "high" | "medium" | "low" {
  if (score === undefined) return "low";
  if (score >= CONFIDENCE_BUCKETS.HIGH) return "high";
  if (score >= CONFIDENCE_BUCKETS.MEDIUM) return "medium";
  return "low";
}
