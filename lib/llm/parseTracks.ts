import { generateStructured } from "@/lib/llm/structured";
import { PARSE_RESPONSE_JSON_SCHEMA, ParseResponseSchema } from "@/lib/zodSchemas";
import { postprocessParsedTrack } from "@/lib/parse/postprocess";
import type { ParsedTrack } from "@/lib/types";

const PROMPT_HEADER = `You are parsing a list of song search queries into structured song metadata for YouTube search.
Each numbered line below is one song, written in loose natural language. Order of artist vs title varies,
language varies (Korean/English/Japanese, romanized or native), spacing and punctuation vary, and there may
be typos. Some lines include hints like "live", "acoustic", "MV", "remix" (or their Korean equivalents like
라이브, 어쿠스틱, 리믹스) that describe the desired video variant. A hint may also be NEGATED, e.g. "라이브 말고
원곡" means "not live, the original studio version" — in that case do NOT add "live" to hints; if anything,
you may note the negation is for the ORIGINAL studio version by leaving hints empty.

For each line, return:
- lineIndex: the line's number (0-indexed, matching the input list order)
- artist: the artist name EXACTLY as the user wrote it (only fix an obvious typo)
- title: the track title EXACTLY as the user wrote it, in the user's own language and wording. Keep the original script (Japanese stays Japanese, Korean stays Korean). Do NOT translate, reword or "correct" it (e.g. keep "우리들의 가능성", never change it to "우리의 가능성"). Only strip hint words like "live" or "(Inst.)" from it, and report them in hints instead.
- altArtists: the name(s) the SAME artist uses on YouTube/Spotify in other languages, mainly the official English/romanized name (e.g. 곽진언 -> "Kwak Jin Eon", 아이유 -> "IU"). At most 2. Empty array if unsure.
- altTitles: only well-known official alternate titles of the SAME song (e.g. official English title). Empty array if unsure. Never invent romanizations or translations.
- hints: normalized lowercase English hint keywords the user actually wants (e.g. "live", "acoustic", "mv", "remix", "cover", "instrumental" for "Inst."/"MR"), empty array if none or if negated
- confidence: your confidence (0 to 1) that you correctly identified the artist and title

Return every line, including ones you are unsure about (use low confidence rather than omitting them).

Lines:
`;

export async function parseLines(lines: string[]): Promise<{
  tracks: ParsedTrack[];
  errors: Array<{ lineIndex: number; error: string }>;
}> {
  const prompt = PROMPT_HEADER + lines.map((line, i) => `${i}. ${line}`).join("\n");

  let tracks: ParsedTrack[] = [];
  let topLevelError: string | undefined;
  try {
    const result = await generateStructured({
      prompt,
      jsonSchema: PARSE_RESPONSE_JSON_SCHEMA,
      zodSchema: ParseResponseSchema,
    });
    tracks = result.tracks.map((t) => postprocessParsedTrack({ ...t, rawLine: lines[t.lineIndex] ?? "" }));
  } catch (err) {
    topLevelError = err instanceof Error ? err.message : String(err);
  }

  const byIndex = new Map(tracks.map((t) => [t.lineIndex, t]));
  const errors: Array<{ lineIndex: number; error: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!byIndex.has(i)) {
      errors.push({ lineIndex: i, error: topLevelError ?? "LLM did not return this line" });
    }
  }

  return { tracks, errors };
}
