import { confidenceBucket } from "@/lib/scoring/score";
import type { TrackStatus } from "@/lib/types";

const STYLES: Record<"high" | "medium" | "low" | "none", string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  none: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const LABELS: Record<"high" | "medium" | "low" | "none", string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  none: "-",
};

export default function ConfidenceBadge({ score, status }: { score?: number; status: TrackStatus }) {
  const bucket = status === "not_found" ? "none" : confidenceBucket(score);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[bucket]}`}>
      {LABELS[bucket]}
    </span>
  );
}
