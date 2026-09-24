import { describe, expect, it } from "vitest";
import { anchorTitleToRawLine, extractHints, postprocessParsedTrack } from "@/lib/parse/postprocess";
import type { ParsedTrack } from "@/lib/types";

function parsed(overrides: Partial<ParsedTrack>): ParsedTrack {
  return { lineIndex: 0, rawLine: "", artist: "", title: "", altArtists: [], altTitles: [], hints: [], confidence: 0.9, ...overrides };
}

describe("anchorTitleToRawLine", () => {
  it("restores a title the LLM translated away from the user's original script", () => {
    const t = anchorTitleToRawLine(
      parsed({ rawLine: "冬に置いてきたもの(Inst.) / 구름", artist: "구름", title: "겨울에 두고 온 것" }),
    );
    expect(t.title).toBe("冬に置いてきたもの");
    expect(t.altTitles).toContain("겨울에 두고 온 것");
  });

  it("restores a title the LLM reworded", () => {
    const t = anchorTitleToRawLine(parsed({ rawLine: "우리들의 가능성 / 장들레", artist: "장들레", title: "우리의 가능성" }));
    expect(t.title).toBe("우리들의 가능성");
  });

  it("leaves a title alone when it already appears in the user's line", () => {
    const original = parsed({ rawLine: "IU Blueming", artist: "IU", title: "Blueming" });
    expect(anchorTitleToRawLine(original)).toBe(original);
  });

  it("leaves the track alone when the artist cannot be located in the line", () => {
    const original = parsed({ rawLine: "something odd", artist: "Nobody", title: "Different" });
    expect(anchorTitleToRawLine(original)).toBe(original);
  });
});

describe("extractHints", () => {
  it("reads Inst./live/acoustic/remix/mv from the line", () => {
    expect(extractHints("冬に置いてきたもの(Inst.) / 구름")).toEqual(["instrumental"]);
    expect(extractHints("아이유 밤편지 라이브")).toEqual(["live"]);
    expect(extractHints("Charlie Puth - Attention acoustic")).toEqual(["acoustic"]);
    expect(extractHints("Post Malone Sunflower remix")).toEqual(["remix"]);
    expect(extractHints("BLACKPINK Kill This Love MV")).toEqual(["mv"]);
  });

  it("ignores a negated hint", () => {
    expect(extractHints("아이유 밤편지 라이브 말고 원곡")).toEqual([]);
  });
});

describe("postprocessParsedTrack", () => {
  it("merges LLM hints with hints found in the line without duplicates", () => {
    const t = postprocessParsedTrack(
      parsed({ rawLine: "冬に置いてきたもの(Inst.) / 구름", artist: "구름", title: "겨울에 두고 온 것", hints: ["Instrumental"] }),
    );
    expect(t.hints).toEqual(["instrumental"]);
    expect(t.title).toBe("冬に置いてきたもの");
  });
});
