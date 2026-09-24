import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed } from "@/lib/auth/allowlist";

const YOUTUBE_SCOPE = "openid email profile https://www.googleapis.com/auth/youtube";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Auth.js v5 auto-detects AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET by convention;
      // this app's .env uses GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET instead, so wire
      // them through explicitly.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: YOUTUBE_SCOPE,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      if (profile?.email_verified === false) return false;
      return isEmailAllowed(profile?.email, process.env.ALLOWED_EMAILS);
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now();
        return token;
      }

      if (typeof token.expiresAt === "number" && Date.now() < token.expiresAt) {
        return token;
      }

      return refreshAccessToken(token);
    },
    // The Google access/refresh tokens stay inside the encrypted, HttpOnly session cookie and are
    // only read server-side (lib/auth/youtubeAuth.ts). They must never be added to the session
    // object, which is served to the browser by /api/auth/session.
    async session({ session, token }) {
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

export async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    if (!token.refreshToken) throw new Error("No refresh token available");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
