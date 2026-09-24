"use client";

import type { MatchPreference } from "@/lib/types";

export default function PreferenceToggle({
  value,
  onChange,
}: {
  value: MatchPreference;
  onChange: (value: MatchPreference) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
      <button
        type="button"
        onClick={() => onChange("audio")}
        className={`rounded-md px-3 py-1.5 transition-colors ${
          value === "audio"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        오디오 (Topic/공식 음원)
      </button>
      <button
        type="button"
        onClick={() => onChange("mv")}
        className={`rounded-md px-3 py-1.5 transition-colors ${
          value === "mv"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        공식 뮤직비디오
      </button>
    </div>
  );
}
