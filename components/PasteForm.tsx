"use client";

import PreferenceToggle from "@/components/PreferenceToggle";
import type { MatchPreference } from "@/lib/types";

export default function PasteForm({
  value,
  onChange,
  preference,
  onPreferenceChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  preference: MatchPreference;
  onPreferenceChange: (value: MatchPreference) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const lineCount = value.split("\n").map((l) => l.trim()).filter(Boolean).length;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <label htmlFor="song-input" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        한 줄에 한 곡씩 붙여넣으세요 (아티스트/제목 순서, 언어 상관없음)
      </label>
      <textarea
        id="song-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"IU Blueming\n뉴진스 하이프보이\nKendrick Lamar - Not Like Us\n아이유 밤편지 라이브 말고 원곡"}
        rows={8}
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PreferenceToggle value={preference} onChange={onPreferenceChange} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{lineCount}곡 입력됨</span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || lineCount === 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            파싱 및 검색 시작
          </button>
        </div>
      </div>
    </section>
  );
}
