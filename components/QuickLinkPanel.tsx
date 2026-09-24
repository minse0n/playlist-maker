"use client";

import { useState } from "react";

export default function QuickLinkPanel({ videoIds }: { videoIds: string[] }) {
  const [links, setLinks] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleBuild() {
    setLoading(true);
    try {
      const res = await fetch("/api/playlist/quick-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds }),
      });
      const body = await res.json();
      setLinks(body.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">임시 재생목록 링크 (로그인 불필요, 할당량 소모 없음)</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        비공식 URL 형식으로, 계정에 저장되지는 않지만 바로 재생해볼 수 있는 임시 링크입니다. (최대 50곡씩 분할)
      </p>
      <button
        type="button"
        onClick={handleBuild}
        disabled={loading || videoIds.length === 0}
        className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {loading ? "생성 중..." : "임시 링크 생성"}
      </button>
      {links && (
        <ul className="flex flex-col gap-1">
          {links.map((link, i) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline dark:text-sky-400">
                임시 재생목록 ({i + 1}/{links.length})
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
