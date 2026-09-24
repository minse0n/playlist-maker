# Playlist Maker

**English** | [한국어](README.ko.md)

Paste a list of songs in plain language — one per line — and get a real YouTube playlist in your account, with every track matched to the most accurate video.

- Understands swapped artist/title order, Korean / English / Japanese (native or romanized), typos, and hints like `live`, `acoustic`, `MV`, `remix`, `Inst.`.
- Prefers official audio (`<Artist> - Topic` channels) by default, or official MVs with one toggle.
- Review everything before anything is created: thumbnails, confidence badges, an alternatives dropdown per track, drag-to-reorder, skip/remove, edit-and-re-search.
- Spends as little YouTube API quota as possible (results are cached locally).
- Also offers a no-login "quick temporary playlist" link (`watch_videos`, best-effort).

> This is a **personal, single-user, run-it-locally tool**. Read [Security notes](#security-notes) before deploying it anywhere public.

## How it works

```
pasted lines
  -> LLM parses each line into {artist, title, hints}       (one batched call)
  -> code re-anchors the title to your own wording and reads hints like "Inst."
  -> YouTube Data API: search.list + videos.list            (cached in SQLite)
  -> deterministic scoring (Topic/official channels, title match, duration, penalties)
  -> if unsure: one extra "Topic" search, then one batched LLM call to pick among candidates
  -> review table -> create playlist (OAuth) or quick link
```

The LLM never searches YouTube. It only (1) turns text into structured fields and (2) breaks ties between candidates it is given. Searching is done by the YouTube Data API, and ranking is plain, testable code (`lib/scoring/`).

**Scoring in short:** Topic / official-artist channels are favored; titles containing both artist and track score higher; durations under 1 minute or over 10 minutes are penalized; cover, live, remix, reaction, lyrics, sped-up, nightcore, 8D, karaoke, fancam and broadcast clips are penalized unless you hinted for them; if you hinted for a variant (e.g. `Inst.`), videos without it are penalized.

## Requirements

- Node.js 22+
- A Google Cloud project (YouTube Data API v3 + OAuth client)
- An OpenAI-compatible LLM endpoint (`/chat/completions`) and API key

## Setup

### 1. Google Cloud (YouTube)

1. Create/select a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **YouTube Data API v3** (`APIs & Services > Library`).
3. Create an **API key** (`Credentials > Create credentials > API key`) → `YOUTUBE_API_KEY`. Restrict it to the YouTube Data API v3.
4. Create an **OAuth client ID**, type **Web application**, with authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`
   → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. While the OAuth consent screen is in **Testing**, add your own Google account under **Test users**, otherwise sign-in fails with `403 access_denied`.

### 2. LLM

Any OpenAI-compatible chat-completions server works. Set:

```
LLM_BASE_URL=https://your-server/api/v1
LLM_API_KEY=...
LLM_DEFAULT_MODEL=your-model-name
```

To see the exact model names your server offers: `curl -H "Authorization: Bearer $LLM_API_KEY" $LLM_BASE_URL/models`.
The app requests JSON mode (`response_format: json_object`) and automatically retries without it if the server rejects it. Output is validated with Zod and repaired once if invalid.

### 3. Environment

```bash
cp .env.example .env
openssl rand -base64 32     # paste the result as AUTH_SECRET
```

Fill in `.env` (optionally set `ALLOWED_EMAILS` to a comma-separated list of Google accounts allowed to sign in). **Never commit `.env`** (it is git-ignored). `.env.example` must only ever contain placeholders.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000 (bound to 127.0.0.1 only)
npm test           # unit tests, no network calls
```

You sign in with Google first; the whole app (and every API route) is behind that login.

## YouTube quota

The default quota is 10,000 units/day: `search.list` = 100, `playlists.insert` = 50, `playlistItems.insert` = 50, `videos.list` = 1. The UI shows today's usage and an estimate before each costly step (e.g. 20 tracks ≈ 2,000 for searching, ≈ 1,050 for creating).

- Search results are cached in `data/cache.db` (SQLite, git-ignored), so re-running a list, swapping alternatives, or toggling Audio/MV costs nothing.
- Duplicate lines share one search. Uncertain tracks may use one extra search (+100).
- On `quotaExceeded` the app stops gracefully, keeps partial results, and you can resume later.
- 5xx / rate-limit errors are retried with exponential backoff.
- The quota resets at midnight Pacific time.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `MissingSecret` / "problem with the server configuration" | `AUTH_SECRET` missing in `.env`. Restart `npm run dev` after editing `.env`. |
| `403 access_denied` at Google sign-in | Add your account as a Test user on the OAuth consent screen. |
| Signed in with Google but sent back to the login screen | Your email is not in `ALLOWED_EMAILS`. |
| `LLM_API_KEY is not set` | Fill in `.env` and restart. |
| LLM `404 model_not_found` | Wrong `LLM_DEFAULT_MODEL`; list models with the `/models` call above. |
| LLM `429` / `5xx` | Provider limit or overload; the app retries automatically, then try again later. |
| Wrong/empty alternatives for a track | Use the row's "다시 검색" (re-search) to bypass the cache. |

## Security notes

- **Secrets stay server-side.** API keys are only read in route handlers. Google OAuth tokens live in the encrypted, HttpOnly session cookie and are deliberately **not** included in the session object served to the browser.
- **Login comes first.** The page shows only a Google sign-in screen until you are signed in, and every API route (`/api/parse`, `/api/search`, `/api/disambiguate`, `/api/quota/*`, `/api/playlist/*`) returns `401` without a valid session, so strangers cannot spend *your* LLM and YouTube quota.
- **Restrict who may sign in.** By default any Google account that completes OAuth can sign in. For anything other than local use, set `ALLOWED_EMAILS=you@gmail.com` (comma-separated) so only those accounts are accepted. `dev`/`start` also bind to `127.0.0.1` only.
- Request bodies are validated with Zod with size limits (max 200 lines, 300 chars each, YouTube video IDs must match `[A-Za-z0-9_-]{11}`), and LLM-chosen video IDs are accepted only if they were among the offered candidates.
- Before pushing a fork, check that `git ls-files` contains no `.env` and that `.env.example` has empty values. If a key ever leaked, revoke and rotate it.
- Found a vulnerability? Please open a private security advisory on GitHub rather than a public issue.

## Project layout

```
app/api/        route handlers (parse, search, disambiguate, quota, playlist, auth)
components/     single-page UI (paste -> review table -> create)
lib/llm/        OpenAI-compatible client, structured output + repair, prompts
lib/parse/      post-processing: title anchoring, hint extraction
lib/youtube/    search, video details, playlist creation, quick link
lib/scoring/    normalization + deterministic scoring
lib/cache/      SQLite cache and quota accounting
tests/          Vitest suites + ~20 tricky-query fixtures
```

Stack: Next.js (App Router) · TypeScript · Tailwind · Auth.js · Zod · SQLite (better-sqlite3) · Vitest.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
