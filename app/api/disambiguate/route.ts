import { z } from "zod";
import { NextResponse } from "next/server";
import { disambiguateBatch } from "@/lib/llm/disambiguate";
import { MAX_LINE_LENGTH, MAX_LINES, ParsedTrackSchema, VideoIdSchema } from "@/lib/zodSchemas";

const ScoredCandidateSchema = z.object({
  videoId: VideoIdSchema,
  title: z.string().max(500),
  channelId: z.string(),
  channelTitle: z.string(),
  durationSeconds: z.number(),
  publishedAt: z.string(),
  thumbnailUrl: z.string(),
  descriptionSnippet: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
});

const RequestSchema = z.object({
  items: z
    .array(
      z.object({
        lineIndex: z.number().int().min(0).max(MAX_LINES),
        track: ParsedTrackSchema.extend({ rawLine: z.string().max(MAX_LINE_LENGTH) }),
        candidates: z.array(ScoredCandidateSchema).max(20),
      }),
    )
    .max(MAX_LINES),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await disambiguateBatch(parsed.data.items);

    // Never trust the model's pick blindly: it may only choose an ID it was actually offered.
    const allowed = new Map(parsed.data.items.map((i) => [i.lineIndex, new Set(i.candidates.map((c) => c.videoId))]));
    const results = result.results.filter(
      (r) => "noMatch" in r.choice || allowed.get(r.lineIndex)?.has(r.choice.candidateId),
    );
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM disambiguation failed" },
      { status: 502 },
    );
  }
}
