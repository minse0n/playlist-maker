import { getYoutubeOAuthClient } from "@/lib/youtube/client";
import { chargeQuota } from "@/lib/cache/quota";
import { classifyApiError, withBackoff } from "@/lib/retry";
import { YOUTUBE_QUOTA } from "@/lib/constants";
import type { CreatePlaylistProgressEvent, CreatePlaylistRequest } from "@/lib/types";

export function playlistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

async function fetchExistingVideoIds(
  youtube: ReturnType<typeof getYoutubeOAuthClient>,
  playlistId: string,
): Promise<Set<string>> {
  const existing = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await withBackoff(() =>
      youtube.playlistItems.list({
        part: ["contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken,
      }),
    );
    chargeQuota(YOUTUBE_QUOTA.PLAYLISTITEMS_LIST);
    for (const item of res.data.items ?? []) {
      if (item.contentDetails?.videoId) existing.add(item.contentDetails.videoId);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return existing;
}

export async function* runCreatePlaylist(
  tokens: { accessToken: string; refreshToken?: string },
  request: CreatePlaylistRequest,
): AsyncGenerator<CreatePlaylistProgressEvent> {
  const youtube = getYoutubeOAuthClient(tokens);

  let playlistId = request.playlistId;
  let alreadyPresent = new Set<string>();

  try {
    if (request.mode === "create") {
      const res = await withBackoff(() =>
        youtube.playlists.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: { title: request.title, description: request.description },
            status: { privacyStatus: request.privacy },
          },
        }),
      );
      chargeQuota(YOUTUBE_QUOTA.PLAYLISTS_INSERT);
      playlistId = res.data.id ?? undefined;
      if (!playlistId) throw new Error("YouTube did not return a playlist id");
      yield { type: "playlist_created", playlistId, url: playlistUrl(playlistId) };
    } else {
      if (!playlistId) throw new Error("playlistId is required when resuming (mode=append)");
      alreadyPresent = await fetchExistingVideoIds(youtube, playlistId);
      yield { type: "playlist_created", playlistId, url: playlistUrl(playlistId) };
    }
  } catch (err) {
    if (classifyApiError(err) === "auth_error") {
      yield { type: "auth_error", message: err instanceof Error ? err.message : String(err) };
      return;
    }
    throw err;
  }

  const total = request.videoIds.length;
  const failedVideoIds: string[] = [];
  let addedCount = 0;

  for (let index = 0; index < total; index++) {
    const videoId = request.videoIds[index];

    if (alreadyPresent.has(videoId)) {
      yield { type: "item_skipped_existing", videoId, index, total };
      addedCount++;
      continue;
    }

    try {
      await withBackoff(() =>
        youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
          },
        }),
      );
      chargeQuota(YOUTUBE_QUOTA.PLAYLISTITEMS_INSERT);
      addedCount++;
      yield { type: "item_added", videoId, index, total };
    } catch (err) {
      const cls = classifyApiError(err);
      if (cls === "quota_exceeded") {
        yield { type: "quota_exceeded", addedCount };
        return;
      }
      if (cls === "auth_error") {
        yield { type: "auth_error", message: err instanceof Error ? err.message : String(err) };
        return;
      }
      failedVideoIds.push(videoId);
      yield { type: "item_failed", videoId, index, error: err instanceof Error ? err.message : String(err) };
    }
  }

  yield { type: "done", addedCount, failedVideoIds };
}
