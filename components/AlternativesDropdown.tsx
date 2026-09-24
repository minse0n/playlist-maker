"use client";

import type { ScoredCandidate } from "@/lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AlternativesDropdown({
  candidates,
  selectedVideoId,
  onSelect,
}: {
  candidates: ScoredCandidate[];
  selectedVideoId?: string;
  onSelect: (videoId: string) => void;
}) {
  if (candidates.length === 0) {
    return <span className="text-xs text-zinc-400">후보 없음</span>;
  }

  return (
    <select
      className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      value={selectedVideoId ?? ""}
      onChange={(e) => onSelect(e.target.value)}
    >
      {!selectedVideoId && <option value="">선택 안 됨</option>}
      {candidates.map((c) => (
        <option key={c.videoId} value={c.videoId}>
          {c.channelTitle} · {formatDuration(c.durationSeconds)} · {c.title.slice(0, 40)}
        </option>
      ))}
    </select>
  );
}
