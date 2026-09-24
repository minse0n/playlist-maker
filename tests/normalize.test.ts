import { describe, expect, it } from "vitest";
import { buildCacheKey, normalizeHints, normalizeText } from "@/lib/scoring/normalize";

describe("normalizeText", () => {
  it("lowercases and trims", () => {
    expect(normalizeText("  IU Blueming  ")).toBe("iu blueming");
  });

  it("strips punctuation", () => {
    expect(normalizeText("Blueming - IU")).toBe("blueming iu");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeText("iu   blueming")).toBe("iu blueming");
  });

  it("NFKC-normalizes full-width and combining forms to the same value", () => {
    // Full-width Latin "ＩＵ" should normalize the same as ASCII "IU".
    expect(normalizeText("ＩＵ")).toBe(normalizeText("IU"));
  });

  it("treats Korean strings as case-insensitive-safe (no crash, stable output)", () => {
    expect(normalizeText("아이유 블루밍")).toBe(normalizeText("아이유 블루밍"));
  });
});

describe("normalizeHints", () => {
  it("is order-independent", () => {
    expect(normalizeHints(["live", "acoustic"])).toEqual(normalizeHints(["acoustic", "live"]));
  });

  it("dedupes and drops empties", () => {
    expect(normalizeHints(["live", "Live", "", "  "])).toEqual(["live"]);
  });
});

describe("buildCacheKey", () => {
  it("is stable regardless of casing/whitespace/hint order", () => {
    const a = buildCacheKey("IU", "Blueming", ["live", "acoustic"]);
    const b = buildCacheKey("  iu  ", "blueming", ["acoustic", "live"]);
    expect(a).toBe(b);
  });

  it("differs when hints differ", () => {
    const withHint = buildCacheKey("IU", "Blueming", ["live"]);
    const withoutHint = buildCacheKey("IU", "Blueming", []);
    expect(withHint).not.toBe(withoutHint);
  });
});
