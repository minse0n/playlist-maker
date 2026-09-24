import { getDb } from "@/lib/cache/db";
import { buildCacheKey } from "@/lib/scoring/normalize";
import { CACHE_TTL_DAYS } from "@/lib/constants";
import type { ParsedTrack, YoutubeCandidate } from "@/lib/types";

interface CacheRow {
  cache_key: string;
  candidates_json: string;
  fetched_at: number;
}

// Cached candidates are stored unscored (raw YouTube results): scoring depends on the
// audio/MV preference toggle, which can change between runs without costing any quota,
// so scoring always happens live against whatever is cached.
export interface CacheLookupResult {
  candidates: YoutubeCandidate[];
  stale: boolean;
  matchedKey: string;
}

function candidateKeys(track: ParsedTrack): string[] {
  // Only artist spellings vary between runs. The title is anchored to the user's own line
  // (see anchorTitleToRawLine), so alternate titles must not be used for lookup: an entry cached
  // under an LLM-translated/wrong title would otherwise shadow the correct search.
  const artists = [track.artist, ...track.altArtists].filter(Boolean);
  return artists.map((a) => buildCacheKey(a, track.title, track.hints));
}

export function primaryCacheKey(track: ParsedTrack): string {
  return buildCacheKey(track.artist, track.title, track.hints);
}

export function lookupCache(track: ParsedTrack): CacheLookupResult | undefined {
  const db = getDb();
  const stmt = db.prepare<[string], CacheRow>(
    "SELECT cache_key, candidates_json, fetched_at FROM search_cache WHERE cache_key = ?",
  );

  const primary = primaryCacheKey(track);
  const keys = [primary, ...candidateKeys(track).filter((k) => k !== primary)];

  for (const key of keys) {
    const row = stmt.get(key);
    if (!row) continue;

    const candidates = JSON.parse(row.candidates_json) as YoutubeCandidate[];
    const ageDays = (Date.now() - row.fetched_at) / (1000 * 60 * 60 * 24);
    const stale = ageDays > CACHE_TTL_DAYS;

    if (key !== primary) {
      writeCache(track, candidates);
    }

    return { candidates, stale, matchedKey: key };
  }

  return undefined;
}

export function writeCache(track: ParsedTrack, candidates: YoutubeCandidate[]): void {
  const db = getDb();
  const key = primaryCacheKey(track);
  db.prepare(
    `INSERT INTO search_cache (cache_key, artist, title, hints_json, candidates_json, fetched_at)
     VALUES (@key, @artist, @title, @hintsJson, @candidatesJson, @fetchedAt)
     ON CONFLICT(cache_key) DO UPDATE SET
       artist = excluded.artist,
       title = excluded.title,
       hints_json = excluded.hints_json,
       candidates_json = excluded.candidates_json,
       fetched_at = excluded.fetched_at`,
  ).run({
    key,
    artist: track.artist,
    title: track.title,
    hintsJson: JSON.stringify(track.hints),
    candidatesJson: JSON.stringify(candidates),
    fetchedAt: Date.now(),
  });
}

export function invalidateCache(track: ParsedTrack): void {
  const db = getDb();
  db.prepare("DELETE FROM search_cache WHERE cache_key = ?").run(primaryCacheKey(track));
}
