import { getDb } from "@/lib/cache/db";
import { QUOTA_RESET_TIMEZONE, YOUTUBE_QUOTA } from "@/lib/constants";
import type { QuotaEstimate } from "@/lib/types";

export function currentQuotaDateKey(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which sorts and stores nicely as a SQLite TEXT primary key.
  return new Intl.DateTimeFormat("en-CA", { timeZone: QUOTA_RESET_TIMEZONE }).format(date);
}

export function chargeQuota(units: number): void {
  const db = getDb();
  const dateKey = currentQuotaDateKey();
  db.prepare(
    `INSERT INTO quota_usage (usage_date, units_used) VALUES (?, ?)
     ON CONFLICT(usage_date) DO UPDATE SET units_used = units_used + excluded.units_used`,
  ).run(dateKey, units);
}

export function getQuotaEstimate(): QuotaEstimate {
  const db = getDb();
  const dateKey = currentQuotaDateKey();
  const row = db
    .prepare<[string], { units_used: number }>("SELECT units_used FROM quota_usage WHERE usage_date = ?")
    .get(dateKey);
  const unitsUsedToday = row?.units_used ?? 0;
  return {
    dateKey,
    unitsUsedToday,
    dailyLimit: YOUTUBE_QUOTA.DAILY_LIMIT,
    remaining: Math.max(0, YOUTUBE_QUOTA.DAILY_LIMIT - unitsUsedToday),
  };
}
