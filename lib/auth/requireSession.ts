import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Returns a 401 response when there is no valid signed-in session, otherwise null. */
export async function requireSession(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session || session.error) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  return null;
}
