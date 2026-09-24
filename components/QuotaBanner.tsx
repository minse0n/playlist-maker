export default function QuotaBanner({
  unitsUsedToday,
  dailyLimit,
  estimateLabel,
}: {
  unitsUsedToday?: number;
  dailyLimit?: number;
  estimateLabel?: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white/90 px-4 py-2 text-sm text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400">
      <span>
        오늘 사용한 할당량:{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">
          {unitsUsedToday ?? "-"} / {dailyLimit ?? 10000}
        </strong>
      </span>
      {estimateLabel && <span className="text-amber-700 dark:text-amber-400">{estimateLabel}</span>}
    </div>
  );
}
