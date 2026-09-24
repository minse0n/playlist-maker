/**
 * ALLOWED_EMAILS is an optional comma-separated allowlist. When empty/unset any Google account
 * that completes OAuth may sign in (fine for local use; set it for any shared deployment).
 */
export function isEmailAllowed(email: string | null | undefined, allowlist: string | undefined): boolean {
  const allowed = (allowlist ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return Boolean(email) && allowed.includes((email as string).toLowerCase());
}
