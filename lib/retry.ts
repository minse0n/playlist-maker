export type ErrorClass = "quota_exceeded" | "rate_limited" | "server_error" | "auth_error" | "unknown";

interface GaxiosLikeError {
  response?: {
    status?: number;
    data?: {
      error?: {
        errors?: Array<{ reason?: string; domain?: string }>;
        status?: string;
        message?: string;
      };
    };
  };
  status?: number;
  message?: string;
}

export function classifyApiError(err: unknown): ErrorClass {
  const e = err as GaxiosLikeError;
  const status = e?.response?.status ?? e?.status;
  const reason = e?.response?.data?.error?.errors?.[0]?.reason ?? "";
  const message = e?.response?.data?.error?.message ?? e?.message ?? "";

  if (status === 403 && /quotaExceeded|dailyLimitExceeded/i.test(reason)) return "quota_exceeded";
  if (status === 403 && /quota/i.test(message)) return "quota_exceeded";
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded/i.test(reason)) return "rate_limited";
  if (status === 401 || /invalid_grant|invalid_token/i.test(message)) return "auth_error";
  if (typeof status === "number" && status >= 500) return "server_error";
  return "unknown";
}

export interface BackoffOptions {
  retries?: number;
  baseDelayMs?: number;
  factor?: number;
  jitter?: boolean;
}

const RETRYABLE: ErrorClass[] = ["rate_limited", "server_error"];

export async function withBackoff<T>(fn: () => Promise<T>, options: BackoffOptions = {}): Promise<T> {
  const { retries = 5, baseDelayMs = 500, factor = 2, jitter = true } = options;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const cls = classifyApiError(err);
      if (attempt >= retries || !RETRYABLE.includes(cls)) throw err;
      const delay = baseDelayMs * factor ** attempt * (jitter ? 0.5 + Math.random() : 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}
