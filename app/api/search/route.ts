import { z } from "zod";
import { NextResponse } from "next/server";
import { resolveSearch } from "@/lib/youtube/search";
import { ndjsonStreamResponse } from "@/lib/ndjson";
import { MAX_LINE_LENGTH, MAX_LINES, ParsedTrackSchema } from "@/lib/zodSchemas";

const RequestSchema = z.object({
  tracks: z.array(ParsedTrackSchema.extend({ rawLine: z.string().max(MAX_LINE_LENGTH) })).max(MAX_LINES),
  preference: z.enum(["audio", "mv"]),
  forceRefreshLineIndexes: z.array(z.number()).max(MAX_LINES).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tracks, preference, forceRefreshLineIndexes } = parsed.data;
  const forceRefresh = new Set(forceRefreshLineIndexes ?? []);

  return ndjsonStreamResponse(resolveSearch(tracks, preference, { forceRefresh }));
}
