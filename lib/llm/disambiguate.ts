import { generateStructured } from "@/lib/llm/structured";
import { DISAMBIGUATION_RESPONSE_JSON_SCHEMA, DisambiguationResponseSchema } from "@/lib/zodSchemas";
import type { DisambiguationResponseParsed } from "@/lib/zodSchemas";
import type { ParsedTrack, ScoredCandidate } from "@/lib/types";

export interface AmbiguousItem {
  lineIndex: number;
  track: ParsedTrack;
  candidates: ScoredCandidate[];
}

const PROMPT_HEADER = `You are choosing the best YouTube video match for a list of songs, from a short list of
candidates for each. For every item, pick the candidateId that best matches the intended song, respecting
any hints (e.g. if hinted "live", prefer a live version; otherwise prefer the official studio audio or
official artist channel upload). Only choose a candidateId that appears in that item's candidate list -
never invent one. If none of the candidates plausibly match the song at all, return {"noMatch": true}
instead of a candidateId.

Return, for each item: lineIndex, choice ({"candidateId": "..."} or {"noMatch": true}), confidence (0-1),
and a brief reason.

Items:
`;

export async function disambiguateBatch(
  items: AmbiguousItem[],
): Promise<DisambiguationResponseParsed> {
  if (items.length === 0) return { results: [] };

  const payload = items.map((item) => ({
    lineIndex: item.lineIndex,
    artist: item.track.artist,
    title: item.track.title,
    hints: item.track.hints,
    candidates: item.candidates.map((c) => ({
      candidateId: c.videoId,
      title: c.title,
      channelTitle: c.channelTitle,
      durationSeconds: c.durationSeconds,
      isTopicChannel: c.channelTitle.toLowerCase().endsWith(" topic"),
    })),
  }));

  const prompt = PROMPT_HEADER + JSON.stringify(payload, null, 2);

  return generateStructured({
    prompt,
    jsonSchema: DISAMBIGUATION_RESPONSE_JSON_SCHEMA,
    zodSchema: DisambiguationResponseSchema,
  });
}
