import { z } from "zod";

export const MAX_LINES = 200;
export const MAX_LINE_LENGTH = 300;

// YouTube video IDs are always 11 chars of [A-Za-z0-9_-]. Validating the shape also keeps
// arbitrary text out of the watch_videos URL and the playlistItems.insert payload.
export const VideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

const ShortText = z.string().max(MAX_LINE_LENGTH);

export const ParsedTrackSchema = z.object({
  lineIndex: z.number().int().min(0).max(MAX_LINES),
  artist: ShortText.min(1),
  title: ShortText.min(1),
  altArtists: z.array(ShortText).max(10).default([]),
  altTitles: z.array(ShortText).max(10).default([]),
  hints: z.array(ShortText).max(10).default([]),
  confidence: z.number().min(0).max(1),
});

export const ParseResponseSchema = z.object({
  tracks: z.array(ParsedTrackSchema),
});

export type ParsedTrackParsed = z.infer<typeof ParsedTrackSchema>;

// JSON Schema mirror of ParseResponseSchema, embedded in the LLM system prompt.
export const PARSE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    tracks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lineIndex: { type: "integer" },
          artist: { type: "string" },
          title: { type: "string" },
          altArtists: { type: "array", items: { type: "string" } },
          altTitles: { type: "array", items: { type: "string" } },
          hints: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        required: ["lineIndex", "artist", "title", "altArtists", "altTitles", "hints", "confidence"],
      },
    },
  },
  required: ["tracks"],
} as const;

// LLMs emit a flat object with optional fields more reliably than a discriminated
// union, so the wire shape is flat and this schema enforces that exactly one of the
// two fields is meaningfully present.
export const DisambiguationChoiceSchema = z
  .object({
    candidateId: z.string().optional(),
    noMatch: z.boolean().optional(),
  })
  .refine((v) => (v.noMatch === true) !== Boolean(v.candidateId), {
    message: "choice must set exactly one of candidateId or noMatch:true",
  })
  .transform((v): { candidateId: string } | { noMatch: true } =>
    v.noMatch === true ? { noMatch: true } : { candidateId: v.candidateId as string },
  );

export const DisambiguationResultItemSchema = z.object({
  lineIndex: z.number().int().min(0),
  choice: DisambiguationChoiceSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const DisambiguationResponseSchema = z.object({
  results: z.array(DisambiguationResultItemSchema),
});

export type DisambiguationResponseParsed = z.infer<typeof DisambiguationResponseSchema>;

export const DISAMBIGUATION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lineIndex: { type: "integer" },
          choice: {
            type: "object",
            properties: {
              candidateId: { type: "string" },
              noMatch: { type: "boolean" },
            },
          },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["lineIndex", "choice", "confidence", "reason"],
      },
    },
  },
  required: ["results"],
} as const;

export const CreatePlaylistRequestSchema = z.object({
  mode: z.enum(["create", "append"]),
  playlistId: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/).optional(),
  title: z.string().min(1).max(150),
  description: z.string().max(5000).default(""),
  privacy: z.enum(["private", "unlisted", "public"]),
  videoIds: z.array(VideoIdSchema).min(1).max(MAX_LINES),
});
