import { WATCH_VIDEOS_MAX_IDS } from "@/lib/constants";

/**
 * Builds one or more https://www.youtube.com/watch_videos?video_ids=... links.
 * This URL format is undocumented/best-effort and caps out at 50 video IDs per link,
 * so longer lists are split into multiple links.
 */
export function buildWatchVideosLinks(videoIds: string[]): string[] {
  const links: string[] = [];
  for (let i = 0; i < videoIds.length; i += WATCH_VIDEOS_MAX_IDS) {
    const chunk = videoIds.slice(i, i + WATCH_VIDEOS_MAX_IDS);
    links.push(`https://www.youtube.com/watch_videos?video_ids=${chunk.join(",")}`);
  }
  return links;
}
