import { NextResponse } from "next/server";
import { runCreatePlaylist } from "@/lib/youtube/playlist";
import { ndjsonStreamResponse } from "@/lib/ndjson";
import { requireYoutubeTokens } from "@/lib/auth/youtubeAuth";
import { CreatePlaylistRequestSchema } from "@/lib/zodSchemas";

export async function POST(req: Request) {
  const auth = await requireYoutubeTokens(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await req.json().catch(() => undefined);
  const parsed = CreatePlaylistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  return ndjsonStreamResponse(runCreatePlaylist(auth.tokens, parsed.data));
}
