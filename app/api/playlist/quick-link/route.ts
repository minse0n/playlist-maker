import { requireSession } from "@/lib/auth/requireSession";
import { z } from "zod";
import { NextResponse } from "next/server";
import { buildWatchVideosLinks } from "@/lib/youtube/quickLink";
import { MAX_LINES, VideoIdSchema } from "@/lib/zodSchemas";

const RequestSchema = z.object({ videoIds: z.array(VideoIdSchema).min(1).max(MAX_LINES) });

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => undefined);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  return NextResponse.json({ links: buildWatchVideosLinks(parsed.data.videoIds) });
}
