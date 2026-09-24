import { requireSession } from "@/lib/auth/requireSession";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getQuotaEstimate } from "@/lib/cache/quota";
import { SEARCH_MAX_RESULTS, VIDEOS_LIST_BATCH_SIZE, YOUTUBE_QUOTA } from "@/lib/constants";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  return NextResponse.json(getQuotaEstimate());
}

const RequestSchema = z.object({
  uncachedTrackCount: z.number().min(0).default(0),
  matchedCountForCreate: z.number().min(0).optional(),
});

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { uncachedTrackCount, matchedCountForCreate } = parsed.data;

  const searchEstimate =
    uncachedTrackCount * YOUTUBE_QUOTA.SEARCH_LIST +
    Math.ceil((uncachedTrackCount * SEARCH_MAX_RESULTS) / VIDEOS_LIST_BATCH_SIZE) * YOUTUBE_QUOTA.VIDEOS_LIST;

  const createEstimate =
    matchedCountForCreate === undefined
      ? undefined
      : YOUTUBE_QUOTA.PLAYLISTS_INSERT + matchedCountForCreate * YOUTUBE_QUOTA.PLAYLISTITEMS_INSERT;

  return NextResponse.json({
    ...getQuotaEstimate(),
    searchEstimate,
    createEstimate,
  });
}
