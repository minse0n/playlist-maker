import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLines } from "@/lib/llm/parseTracks";
import { dedupeLines } from "@/lib/utils/dedupe";
import { MAX_LINE_LENGTH, MAX_LINES } from "@/lib/zodSchemas";
import type { ParsedTrack } from "@/lib/types";

const RequestSchema = z.object({ lines: z.array(z.string().max(MAX_LINE_LENGTH)).max(MAX_LINES) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const lines = parsed.data.lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return NextResponse.json({ tracks: [], errors: [] });
  }

  const { uniqueLines, lineIndexToUniqueIndex } = dedupeLines(lines);

  let uniqueResult: Awaited<ReturnType<typeof parseLines>>;
  try {
    uniqueResult = await parseLines(uniqueLines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM parse failed" },
      { status: 502 },
    );
  }

  const trackByUniqueIndex = new Map(uniqueResult.tracks.map((t) => [t.lineIndex, t]));
  const errorByUniqueIndex = new Map(uniqueResult.errors.map((e) => [e.lineIndex, e.error]));

  const tracks: ParsedTrack[] = [];
  const errors: Array<{ lineIndex: number; error: string }> = [];

  lineIndexToUniqueIndex.forEach((uniqueIndex, lineIndex) => {
    const base = trackByUniqueIndex.get(uniqueIndex);
    if (base) {
      tracks.push({ ...base, lineIndex, rawLine: lines[lineIndex] });
    } else {
      errors.push({ lineIndex, error: errorByUniqueIndex.get(uniqueIndex) ?? "Parse failed" });
    }
  });

  return NextResponse.json({ tracks, errors });
}
