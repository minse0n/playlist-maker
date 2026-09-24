export type TrackHint = string;

export interface ParsedTrack {
  lineIndex: number;
  rawLine: string;
  artist: string;
  title: string;
  altArtists: string[];
  altTitles: string[];
  hints: TrackHint[];
  confidence: number;
}

export interface YoutubeCandidate {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  durationSeconds: number;
  publishedAt: string;
  thumbnailUrl: string;
  descriptionSnippet: string;
}

export interface ScoredCandidate extends YoutubeCandidate {
  score: number;
  reasons: string[];
}

export type TrackStatus =
  | "pending"
  | "searching"
  | "matched"
  | "low_confidence"
  | "not_found"
  | "skipped"
  | "added"
  | "error";

export interface PipelineTrack {
  id: string;
  lineIndex: number;
  rawLine: string;
  parsed?: ParsedTrack;
  candidates: ScoredCandidate[];
  selectedVideoId?: string;
  status: TrackStatus;
  disambiguatedByLlm: boolean;
  stale?: boolean;
  error?: string;
}

export type PlaylistPrivacy = "private" | "unlisted" | "public";

export interface CreatePlaylistRequest {
  mode: "create" | "append";
  playlistId?: string;
  title: string;
  description: string;
  privacy: PlaylistPrivacy;
  videoIds: string[];
}

export type CreatePlaylistProgressEvent =
  | { type: "playlist_created"; playlistId: string; url: string }
  | { type: "item_added"; videoId: string; index: number; total: number }
  | { type: "item_skipped_existing"; videoId: string; index: number; total: number }
  | { type: "item_failed"; videoId: string; index: number; error: string }
  | { type: "quota_exceeded"; addedCount: number }
  | { type: "auth_error"; message: string }
  | { type: "done"; addedCount: number; failedVideoIds: string[] };

export type SearchProgressEvent =
  | { type: "track_result"; lineIndex: number; candidates: ScoredCandidate[]; cacheHit: boolean; stale: boolean }
  | { type: "track_error"; lineIndex: number; error: string }
  | { type: "quota_exceeded"; remainingLineIndexes: number[] }
  | { type: "done" };

export type MatchPreference = "audio" | "mv";

export interface QuotaEstimate {
  dateKey: string;
  unitsUsedToday: number;
  dailyLimit: number;
  remaining: number;
}
