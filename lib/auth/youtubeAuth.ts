import { getToken } from "next-auth/jwt";
import { refreshAccessToken } from "@/auth";

export interface YoutubeTokens {
  accessToken: string;
  refreshToken?: string;
}

const EXPIRY_SKEW_MS = 30_000;

/**
 * Reads the signed-in user's Google tokens straight from the encrypted session cookie.
 * The tokens are deliberately not part of the client-visible session object.
 */
export async function requireYoutubeTokens(req: Request): Promise<{ tokens: YoutubeTokens } | { error: string }> {
  const secure = req.url.startsWith("https:") || req.headers.get("x-forwarded-proto") === "https";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: secure,
    cookieName,
    salt: cookieName,
  });

  if (!token || !token.accessToken) return { error: "not_signed_in" };
  if (token.error) return { error: "refresh_failed" };

  if (typeof token.expiresAt === "number" && Date.now() >= token.expiresAt - EXPIRY_SKEW_MS) {
    const refreshed = await refreshAccessToken(token as Record<string, unknown>);
    if (!("accessToken" in refreshed) || !refreshed.accessToken) return { error: "refresh_failed" };
    return { tokens: { accessToken: refreshed.accessToken as string, refreshToken: refreshed.refreshToken as string | undefined } };
  }

  return { tokens: { accessToken: token.accessToken as string, refreshToken: token.refreshToken as string | undefined } };
}
