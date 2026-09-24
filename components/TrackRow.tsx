"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StatusPill from "@/components/StatusPill";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import AlternativesDropdown from "@/components/AlternativesDropdown";
import type { PipelineTrack } from "@/lib/types";

export default function TrackRow({
  track,
  onSelectAlternative,
  onRemove,
  onToggleSkip,
  onResearch,
  onEditRawLine,
}: {
  track: PipelineTrack;
  onSelectAlternative: (videoId: string) => void;
  onRemove: () => void;
  onToggleSkip: () => void;
  onResearch: () => void;
  onEditRawLine: (newLine: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.rawLine);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const selected = track.candidates.find((c) => c.videoId === track.selectedVideoId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center ${
        isDragging ? "opacity-50" : ""
      } ${track.status === "skipped" ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        aria-label="드래그하여 순서 변경"
        className="cursor-grab self-start px-1 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing sm:self-center"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {selected?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selected.thumbnailUrl} alt="" className="h-12 w-20 flex-shrink-0 rounded object-cover" />
      ) : (
        <div className="h-12 w-20 flex-shrink-0 rounded bg-zinc-100 dark:bg-zinc-800" />
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              autoFocus
            />
            <button
              type="button"
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={() => {
                setEditing(false);
                if (draft.trim() && draft.trim() !== track.rawLine) onEditRawLine(draft.trim());
              }}
            >
              적용
            </button>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {selected?.title || track.rawLine}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {selected ? `${selected.channelTitle} · ${formatDuration(selected.durationSeconds)}` : track.rawLine}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        <StatusPill status={track.status} />
        <ConfidenceBadge score={selected?.score} status={track.status} />
        <AlternativesDropdown
          candidates={track.candidates}
          selectedVideoId={track.selectedVideoId}
          onSelect={onSelectAlternative}
        />
      </div>

      <div className="flex flex-shrink-0 items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          편집
        </button>
        <button
          type="button"
          onClick={onResearch}
          className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          다시 검색
        </button>
        <button
          type="button"
          onClick={onToggleSkip}
          className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {track.status === "skipped" ? "포함" : "건너뛰기"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          제거
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
