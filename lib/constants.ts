export const YOUTUBE_QUOTA = {
  SEARCH_LIST: 100,
  VIDEOS_LIST: 1,
  PLAYLISTS_INSERT: 50,
  PLAYLISTITEMS_INSERT: 50,
  PLAYLISTITEMS_LIST: 1,
  DAILY_LIMIT: 10000,
} as const;

// YouTube's quota resets at midnight Pacific time regardless of server locale.
export const QUOTA_RESET_TIMEZONE = "America/Los_Angeles";

export const SEARCH_MAX_RESULTS = 5;
export const VIDEOS_LIST_BATCH_SIZE = 50;
export const WATCH_VIDEOS_MAX_IDS = 50;

export const CACHE_TTL_DAYS = 30;

export const SCORING = {
  CONFIDENT_THRESHOLD: 60,
  CONFIDENT_MARGIN: 20,
  LOW_THRESHOLD: 20,
} as const;

export const CONFIDENCE_BUCKETS = {
  HIGH: 70,
  MEDIUM: 40,
} as const;

export const VARIANT_KEYWORDS: Array<{ pattern: RegExp; label: string; penalty: number }> = [
  { pattern: /\bcover(s|ed)?\b|커버/i, label: "cover", penalty: 25 },
  { pattern: /\blive\b|\bconcert\b|\bfancam\b|라이브|콘서트|직캠/i, label: "live", penalty: 25 },
  { pattern: /\bremix\b|\brmx\b|리믹스/i, label: "remix", penalty: 20 },
  { pattern: /\breaction\b|리액션/i, label: "reaction", penalty: 40 },
  { pattern: /\blyrics?\b|가사/i, label: "lyrics video", penalty: 10 },
  { pattern: /sped\s?up|speed\s?up/i, label: "sped up", penalty: 30 },
  { pattern: /\bnightcore\b/i, label: "nightcore", penalty: 35 },
  { pattern: /\b8d\b/i, label: "8D audio", penalty: 35 },
  { pattern: /\bkaraoke\b|\binstrumental\b|\binst\b|\bmr\b|노래방|반주/i, label: "karaoke/instrumental", penalty: 30 },
  { pattern: /\bacoustic\b|어쿠스틱/i, label: "acoustic", penalty: 15 },
  { pattern: /방송|하이라이트|\bhighlights?\b|교차편집/i, label: "broadcast/highlight clip", penalty: 20 },
  { pattern: /\bofficial\s?(music\s?)?video\b|\bmv\b/i, label: "official mv", penalty: 0 },
];

// Variants that change the audio: when the user hinted for one, videos lacking it are penalized.
export const REQUIRED_WHEN_HINTED: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\binstrumental\b|\binst\b|\bmr\b|반주/i, label: "instrumental" },
  { pattern: /\blive\b|\bconcert\b|라이브|콘서트/i, label: "live" },
  { pattern: /\bacoustic\b|어쿠스틱/i, label: "acoustic" },
  { pattern: /\bremix\b|\brmx\b|리믹스/i, label: "remix" },
];

// Hint keywords the parser/UI recognize, mapped to the VARIANT_KEYWORDS label they satisfy.
export const HINT_TO_VARIANT_LABEL: Record<string, string> = {
  live: "live",
  concert: "live",
  acoustic: "acoustic",
  remix: "remix",
  cover: "cover",
  mv: "official mv",
  "official video": "official mv",
  "music video": "official mv",
  lyrics: "lyrics video",
  karaoke: "karaoke/instrumental",
  instrumental: "karaoke/instrumental",
};
