import type { TrackStatus } from "@/lib/types";

const CONFIG: Record<TrackStatus, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  searching: { label: "검색 중", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  matched: { label: "일치", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  low_confidence: { label: "낮은 신뢰도", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  not_found: { label: "찾지 못함", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  skipped: { label: "건너뜀", className: "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500" },
  added: { label: "추가됨", className: "bg-emerald-600 text-white" },
  error: { label: "오류", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
};

export default function StatusPill({ status }: { status: TrackStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {status === "searching" && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {label}
    </span>
  );
}
