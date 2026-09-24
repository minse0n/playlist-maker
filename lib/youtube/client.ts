import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/** Read-only client for search.list/videos.list — no user sign-in required. */
export function getYoutubeApiKeyClient(): youtube_v3.Youtube {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");
  return google.youtube({ version: "v3", auth: apiKey });
}

/** Write client for playlists.insert/playlistItems.* — requires the signed-in user's tokens. */
export function getYoutubeOAuthClient(tokens: {
  accessToken: string;
  refreshToken?: string;
}): youtube_v3.Youtube {
  const oauth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  return google.youtube({ version: "v3", auth: oauth2Client });
}
