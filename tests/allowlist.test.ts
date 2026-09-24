import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "@/lib/auth/allowlist";

describe("isEmailAllowed", () => {
  it("allows any email when the allowlist is unset or empty", () => {
    expect(isEmailAllowed("a@example.com", undefined)).toBe(true);
    expect(isEmailAllowed("a@example.com", "")).toBe(true);
    expect(isEmailAllowed(undefined, "  , ")).toBe(true);
  });

  it("allows only listed emails, case-insensitively and ignoring whitespace", () => {
    const list = "Me@Example.com, friend@example.com";
    expect(isEmailAllowed("me@example.com", list)).toBe(true);
    expect(isEmailAllowed("FRIEND@example.com", list)).toBe(true);
    expect(isEmailAllowed("stranger@example.com", list)).toBe(false);
  });

  it("rejects a missing email when an allowlist is set", () => {
    expect(isEmailAllowed(undefined, "me@example.com")).toBe(false);
    expect(isEmailAllowed(null, "me@example.com")).toBe(false);
  });

  it("does not accept partial matches", () => {
    expect(isEmailAllowed("me@example.com.evil.io", "me@example.com")).toBe(false);
  });
});
