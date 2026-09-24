import { describe, expect, it } from "vitest";
import {
  CreatePlaylistRequestSchema,
  VideoIdSchema,
  DisambiguationResponseSchema,
  ParsedTrackSchema,
  ParseResponseSchema,
} from "@/lib/zodSchemas";
import { QUERY_FIXTURES } from "@/tests/fixtures/queries";
import recordedFixture from "@/tests/fixtures/parseResponse.json";

describe("ParsedTrackSchema", () => {
  it("accepts a well-formed track", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "IU",
      title: "Blueming",
      altArtists: ["아이유"],
      altTitles: [],
      hints: ["live"],
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("defaults altArtists/altTitles/hints to empty arrays when omitted", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "IU",
      title: "Blueming",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.altArtists).toEqual([]);
      expect(result.data.hints).toEqual([]);
    }
  });

  it("rejects a missing required field (title)", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "IU",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-array hints field", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "IU",
      title: "Blueming",
      hints: "live",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence outside [0, 1]", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "IU",
      title: "Blueming",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty artist string", () => {
    const result = ParsedTrackSchema.safeParse({
      lineIndex: 0,
      artist: "",
      title: "Blueming",
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("DisambiguationResponseSchema", () => {
  it("accepts a candidateId choice", () => {
    const result = DisambiguationResponseSchema.safeParse({
      results: [{ lineIndex: 0, choice: { candidateId: "abc123" }, confidence: 0.8, reason: "official channel" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].choice).toEqual({ candidateId: "abc123" });
    }
  });

  it("accepts a noMatch choice", () => {
    const result = DisambiguationResponseSchema.safeParse({
      results: [{ lineIndex: 0, choice: { noMatch: true }, confidence: 0.1, reason: "nothing matches" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].choice).toEqual({ noMatch: true });
    }
  });

  it("rejects a choice with neither candidateId nor noMatch", () => {
    const result = DisambiguationResponseSchema.safeParse({
      results: [{ lineIndex: 0, choice: {}, confidence: 0.1, reason: "?" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a choice with both candidateId and noMatch set", () => {
    const result = DisambiguationResponseSchema.safeParse({
      results: [{ lineIndex: 0, choice: { candidateId: "x", noMatch: true }, confidence: 0.1, reason: "?" }],
    });
    expect(result.success).toBe(false);
  });
});

// This fixture is a hand-authored stand-in for a recorded LLM response covering
// the ~20 tricky lines in queries.ts (no live LLM call happens in this test suite).
// It locks the contract shape and spot-checks that tricky cases resolve sensibly.
describe("recorded parse fixture (tricky queries)", () => {
  it("validates against ParseResponseSchema", () => {
    const result = ParseResponseSchema.safeParse(recordedFixture);
    expect(result.success).toBe(true);
  });

  it("has one entry per non-blank fixture line", () => {
    const nonBlankCount = QUERY_FIXTURES.filter((f) => f.raw.trim().length > 0).length;
    expect(recordedFixture.tracks.length).toBe(nonBlankCount);
  });

  it("resolves the swapped-order fixtures to the same artist/title as plain order", () => {
    const plain = recordedFixture.tracks[0]; // "IU Blueming"
    const swappedNoDash = recordedFixture.tracks[1]; // "Blueming IU"
    const swappedDash = recordedFixture.tracks[2]; // "Blueming - IU"
    for (const t of [swappedNoDash, swappedDash]) {
      expect(t.artist).toBe(plain.artist);
      expect(t.title).toBe(plain.title);
    }
  });

  it("resolves the Korean-native and swapped-order Korean fixtures identically", () => {
    const native = recordedFixture.tracks[3]; // "뉴진스 하이프보이"
    const swapped = recordedFixture.tracks[4]; // "하이프보이 뉴진스"
    expect(swapped.artist).toBe(native.artist);
    expect(swapped.title).toBe(native.title);
  });

  it("drops the hint when it is explicitly negated", () => {
    const negated = recordedFixture.tracks[6]; // "아이유 밤편지 라이브 말고 원곡"
    const positive = recordedFixture.tracks[7]; // "아이유 밤편지 라이브"
    expect(negated.hints).not.toContain("live");
    expect(positive.hints).toContain("live");
  });

  it("carries every explicit hint through (acoustic/mv/remix)", () => {
    expect(recordedFixture.tracks[9].hints).toContain("acoustic");
    expect(recordedFixture.tracks[10].hints).toContain("mv");
    expect(recordedFixture.tracks[11].hints).toContain("remix");
  });

  it("still produces a (low-confidence) entry for an unparseable line rather than omitting it", () => {
    const unparseable = recordedFixture.tracks[18]; // "asdkfj alksdjf laksjdf"
    expect(unparseable.confidence).toBeLessThan(0.5);
  });
});

describe("request validation limits", () => {
  it("rejects video IDs that are not 11 chars of [A-Za-z0-9_-] (blocks URL/param injection)", () => {
    expect(VideoIdSchema.safeParse("dQw4w9WgXcQ").success).toBe(true);
    expect(VideoIdSchema.safeParse("abc&x=evil").success).toBe(false);
    expect(VideoIdSchema.safeParse("short").success).toBe(false);
    expect(VideoIdSchema.safeParse("dQw4w9WgXcQ,other").success).toBe(false);
  });

  it("rejects playlist requests with too many videos or an over-long title", () => {
    const base = { mode: "create", title: "t", privacy: "private", videoIds: ["dQw4w9WgXcQ"] };
    expect(CreatePlaylistRequestSchema.safeParse(base).success).toBe(true);
    expect(CreatePlaylistRequestSchema.safeParse({ ...base, videoIds: Array(201).fill("dQw4w9WgXcQ") }).success).toBe(false);
    expect(CreatePlaylistRequestSchema.safeParse({ ...base, title: "x".repeat(151) }).success).toBe(false);
  });
});
