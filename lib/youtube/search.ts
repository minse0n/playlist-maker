import { getYoutubeApiKeyClient } from "@/lib/youtube/client";
import { parseIso8601Duration } from "@/lib/youtube/durationParse";
import { lookupCache, primaryCacheKey, writeCache } from "@/lib/cache/searchCache";
import { chargeQuota } from "@/lib/cache/quota";
import { classifyApiError, withBackoff } from "@/lib/retry";
import { classifyScored, scoreCandidates } from "@/lib/scoring/score";
import { SEARCH_MAX_RESULTS, VIDEOS_LIST_BATCH_SIZE, YOUTUBE_QUOTA } from "@/lib/constants";
import type { MatchPreference, ParsedTrack, SearchProgressEvent, YoutubeCandidate } from "@/lib/types";

const GROUP_SIZE = Math.floor(VIDEOS_LIST_BATCH_SIZE / SEARCH_MAX_RESULTS); // unique keys per videos.list call

interface TrackGroup {
  key: string;
  representative: ParsedTrack;
  tracks: ParsedTrack[];
}

/** Groups tracks that share a cache key (e.g. duplicate lines, or lines that parsed to the
 * same artist/title/hints) so the network is only hit once per unique song. */
function groupByCacheKey(tracks: ParsedTrack[]): TrackGroup[] {
  const groups = new Map<string, TrackGroup>();
  for (const track of tracks) {
    const key = primaryCacheKey(track);
    const existing = groups.get(key);
    if (existing) {
      existing.tracks.push(track);
    } else {
      groups.set(key, { key, representative: track, tracks: [track] });
    }
  }
  return [...groups.values()];
}

// Hints for a specific non-studio variant: appending "Topic" would steer away from what was asked.
const VARIANT_HINTS_AGAINST_TOPIC = /live|concert|mv|remix|cover|acoustic/i;

function buildQuery(track: ParsedTrack, fallback: boolean): string {
  const base = `${track.artist} ${track.title}`.trim();
  const wantsTopic = fallback && !track.hints.some((h) => VARIANT_HINTS_AGAINST_TOPIC.test(h));
  // "<artist> <title> Topic" surfaces the artist's auto-generated official-audio uploads,
  // which the plain query often misses for Korean/Japanese titles.
  return wantsTopic ? `${base} Topic` : base;
}

async function searchVideoIds(track: ParsedTrack, fallback = false): Promise<string[]> {
  const youtube = getYoutubeApiKeyClient();
  const res = await withBackoff(() =>
    youtube.search.list({
      part: ["snippet"],
      q: buildQuery(track, fallback),
      type: ["video"],
      videoCategoryId: "10",
      maxResults: SEARCH_MAX_RESULTS,
    }),
  );
  chargeQuota(YOUTUBE_QUOTA.SEARCH_LIST);
  return (res.data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
}

async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, YoutubeCandidate>> {
  const map = new Map<string, YoutubeCandidate>();
  if (videoIds.length === 0) return map;

  const youtube = getYoutubeApiKeyClient();
  for (let i = 0; i < videoIds.length; i += VIDEOS_LIST_BATCH_SIZE) {
    const chunk = videoIds.slice(i, i + VIDEOS_LIST_BATCH_SIZE);
    const res = await withBackoff(() =>
      youtube.videos.list({
        part: ["snippet", "contentDetails"],
        id: chunk,
        maxResults: chunk.length,
      }),
    );
    chargeQuota(YOUTUBE_QUOTA.VIDEOS_LIST);
    for (const item of res.data.items ?? []) {
      if (!item.id) continue;
      map.set(item.id, {
        videoId: item.id,
        title: item.snippet?.title ?? "",
        channelId: item.snippet?.channelId ?? "",
        channelTitle: item.snippet?.channelTitle ?? "",
        durationSeconds: parseIso8601Duration(item.contentDetails?.duration ?? "PT0S"),
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        descriptionSnippet: (item.snippet?.description ?? "").slice(0, 300),
      });
    }
  }
  return map;
}

function scoredResultFor(
  track: ParsedTrack,
  candidates: YoutubeCandidate[],
  preference: MatchPreference,
) {
  const scored = scoreCandidates(track, candidates, preference);
  return { scored, classification: classifyScored(scored) };
}

export interface ResolveOptions {
  forceRefresh?: Set<number>; // lineIndexes to bypass cache for
}

export async function* resolveSearch(
  tracks: ParsedTrack[],
  preference: MatchPreference,
  options: ResolveOptions = {},
): AsyncGenerator<SearchProgressEvent> {
  const forceRefresh = options.forceRefresh ?? new Set<number>();
  const uncached: ParsedTrack[] = [];

  for (const track of tracks) {
    const cached = forceRefresh.has(track.lineIndex) ? undefined : lookupCache(track);
    if (cached) {
      const { scored } = scoredResultFor(track, cached.candidates, preference);
      yield { type: "track_result", lineIndex: track.lineIndex, candidates: scored, cacheHit: true, stale: cached.stale };
    } else {
      uncached.push(track);
    }
  }

  const pendingGroups = groupByCacheKey(uncached);

  for (let i = 0; i < pendingGroups.length; i += GROUP_SIZE) {
    const batch = pendingGroups.slice(i, i + GROUP_SIZE);
    const idsByKey = new Map<string, string[]>();
    let quotaExceeded = false;

    for (const group of batch) {
      try {
        const ids = await searchVideoIds(group.representative);
        idsByKey.set(group.key, ids);
      } catch (err) {
        if (classifyApiError(err) === "quota_exceeded") {
          quotaExceeded = true;
          break;
        }
        for (const track of group.tracks) {
          yield {
            type: "track_error",
            lineIndex: track.lineIndex,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    if (quotaExceeded) {
      const processedKeys = new Set(idsByKey.keys());
      const remainingLineIndexes = pendingGroups
        .slice(i)
        .filter((g) => !processedKeys.has(g.key))
        .flatMap((g) => g.tracks.map((t) => t.lineIndex));
      yield { type: "quota_exceeded", remainingLineIndexes };
      return;
    }

    const allIds = [...idsByKey.values()].flat();
    let detailsMap: Map<string, YoutubeCandidate>;
    try {
      detailsMap = await fetchVideoDetails(allIds);
    } catch (err) {
      if (classifyApiError(err) === "quota_exceeded") {
        const remainingLineIndexes = batch.flatMap((g) => g.tracks.map((t) => t.lineIndex));
        yield { type: "quota_exceeded", remainingLineIndexes };
        return;
      }
      for (const group of batch) {
        for (const track of group.tracks) {
          yield { type: "track_error", lineIndex: track.lineIndex, error: err instanceof Error ? err.message : String(err) };
        }
      }
      continue;
    }

    for (const group of batch) {
      const ids = idsByKey.get(group.key);
      if (!ids) continue; // errored above
      let candidates = ids.map((id) => detailsMap.get(id)).filter((c): c is YoutubeCandidate => Boolean(c));

      // Not confident after the first search: try once more with the Topic-oriented query and
      // merge the results, so the correct official upload can appear in the alternatives too.
      const firstPass = scoredResultFor(group.representative, candidates, preference);
      if (firstPass.classification.status !== "matched") {
        try {
          const extraIds = (await searchVideoIds(group.representative, true)).filter((id) => !ids.includes(id));
          const extraDetails = await fetchVideoDetails(extraIds);
          const extra = extraIds.map((id) => extraDetails.get(id)).filter((c): c is YoutubeCandidate => Boolean(c));
          candidates = [...candidates, ...extra];
        } catch (err) {
          if (classifyApiError(err) === "quota_exceeded") {
            yield { type: "quota_exceeded", remainingLineIndexes: [] };
          }
          // Any other failure: keep the first-pass candidates rather than failing the track.
        }
      }

      // Cache once under the representative track's key; every track sharing this
      // key (duplicate lines, or lines that parsed to the same song) reuses it.
      writeCache(group.representative, candidates);
      for (const track of group.tracks) {
        const { scored } = scoredResultFor(track, candidates, preference);
        yield { type: "track_result", lineIndex: track.lineIndex, candidates: scored, cacheHit: false, stale: false };
      }
    }
  }

  yield { type: "done" };
}
