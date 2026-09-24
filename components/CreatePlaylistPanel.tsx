"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import SignInButton from "@/components/SignInButton";
import { readNdjson } from "@/lib/ndjson";
import type { CreatePlaylistProgressEvent, PlaylistPrivacy } from "@/lib/types";

function defaultTitle(): string {
  const today = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  return `플레이리스트 ${today}`;
}

export default function CreatePlaylistPanel({ videoIds }: { videoIds: string[] }) {
  const { data: session } = useSession();
  const [title, setTitle] = useState(defaultTitle());
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<PlaylistPrivacy>("unlisted");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ playlistId: string; url: string } | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function handleCreate() {
    setCreating(true);
    setError(undefined);
    setResult(null);
    setProgress(0);

    try {
      const res = await fetch("/api/playlist/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "create", title, description, privacy, videoIds }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `요청 실패 (${res.status})`);
      }

      await readNdjson<CreatePlaylistProgressEvent>(res, (event) => {
        if (event.type === "playlist_created") {
          setResult({ playlistId: event.playlistId, url: event.url });
        } else if (event.type === "item_added" || event.type === "item_skipped_existing") {
          setProgress(Math.round(((event.index + 1) / event.total) * 100));
        } else if (event.type === "auth_error") {
          setError("Google 인증이 만료되었습니다 — 다시 로그인해 주세요.");
        } else if (event.type === "quota_exceeded") {
          setError(`오늘 할당량을 초과했습니다. ${event.addedCount}곡이 추가되었습니다. 나중에 이어서 진행할 수 있습니다.`);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">재생목록 만들기</h2>

      {!session ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            실제 유튜브 재생목록을 만들려면 Google 계정으로 로그인해야 합니다.
          </p>
          <SignInButton />
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              제목
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              공개 범위
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as PlaylistPrivacy)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="unlisted">일부 공개 (unlisted)</option>
                <option value="private">비공개</option>
                <option value="public">공개</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400 sm:col-span-2">
              설명
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>

          <p className="text-xs text-zinc-400">
            이 재생목록은 YouTube Music 라이브러리에도 표시됩니다. 총 {videoIds.length}곡.
          </p>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || videoIds.length === 0}
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {creating ? "재생목록 만드는 중..." : "재생목록 만들기"}
          </button>

          {creating && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          {result && (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
              <span className="text-emerald-800 dark:text-emerald-300">재생목록이 생성되었습니다!</span>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                열기
              </a>
            </div>
          )}
        </>
      )}
    </section>
  );
}
