import { describe, expect, it } from "vitest";
import { classifyScored, scoreCandidates } from "@/lib/scoring/score";
import type { ParsedTrack, YoutubeCandidate } from "@/lib/types";

function track(overrides: Partial<ParsedTrack> = {}): ParsedTrack {
  return {
    lineIndex: 0,
    rawLine: "IU Blueming",
    artist: "IU",
    title: "Blueming",
    altArtists: ["아이유"],
    altTitles: ["블루밍"],
    hints: [],
    confidence: 0.9,
    ...overrides,
  };
}

function candidate(overrides: Partial<YoutubeCandidate> = {}): YoutubeCandidate {
  return {
    videoId: "vid",
    title: "IU - Blueming",
    channelId: "c1",
    channelTitle: "Random Channel",
    durationSeconds: 210,
    publishedAt: "2019-01-01T00:00:00Z",
    thumbnailUrl: "https://example.com/thumb.jpg",
    descriptionSnippet: "",
    ...overrides,
  };
}

describe("scoreCandidates: channel identity", () => {
  it("ranks an artist Topic channel above a generic upload with audio preference", () => {
    const t = track();
    const topic = candidate({ videoId: "topic", channelTitle: "IU - Topic" });
    const generic = candidate({ videoId: "generic", channelTitle: "SomeRandomUploader" });
    const [first, second] = scoreCandidates(t, [generic, topic], "audio");
    expect(first.videoId).toBe("topic");
    expect(second.videoId).toBe("generic");
  });

  it("ranks an official artist channel with full title match above a generic upload", () => {
    const t = track();
    const official = candidate({ videoId: "official", channelTitle: "IU Official", title: "IU 'Blueming' MV" });
    const generic = candidate({ videoId: "generic", channelTitle: "SomeRandomUploader", title: "cool song" });
    const [first] = scoreCandidates(t, [generic, official], "audio");
    expect(first.videoId).toBe("official");
  });
});

describe("scoreCandidates: variant keyword penalties", () => {
  const cases: Array<{ label: string; title: string }> = [
    { label: "cover", title: "IU Blueming (Cover)" },
    { label: "live", title: "IU Blueming Live" },
    { label: "remix", title: "IU Blueming Remix" },
    { label: "reaction", title: "IU Blueming Reaction" },
    { label: "nightcore", title: "IU Blueming Nightcore" },
    { label: "8D", title: "IU Blueming 8D Audio" },
    { label: "karaoke", title: "IU Blueming Karaoke Instrumental" },
  ];

  for (const { label, title } of cases) {
    it(`penalizes an unhinted ${label} video below a plain upload`, () => {
      const t = track({ hints: [] });
      const variant = candidate({ videoId: "variant", title });
      const plain = candidate({ videoId: "plain", title: "IU Blueming" });
      const [first] = scoreCandidates(t, [variant, plain], "audio");
      expect(first.videoId).toBe("plain");
    });
  }

  it("rewards a live video when the user hinted for live", () => {
    const t = track({ hints: ["live"] });
    const live = candidate({ videoId: "live", title: "IU Blueming Live" });
    const plain = candidate({ videoId: "plain", title: "IU Blueming" });
    const [first] = scoreCandidates(t, [live, plain], "audio");
    expect(first.videoId).toBe("live");
  });
});

describe("scoreCandidates: duration plausibility", () => {
  it("heavily penalizes sub-60-second teasers", () => {
    const t = track();
    const teaser = candidate({ videoId: "teaser", durationSeconds: 30 });
    const full = candidate({ videoId: "full", durationSeconds: 210 });
    const [first] = scoreCandidates(t, [teaser, full], "audio");
    expect(first.videoId).toBe("full");
  });

  it("penalizes videos over 10 minutes unless a hint allows it", () => {
    const t = track();
    const long = candidate({ videoId: "long", durationSeconds: 700 });
    const normal = candidate({ videoId: "normal", durationSeconds: 210 });
    const [first] = scoreCandidates(t, [long, normal], "audio");
    expect(first.videoId).toBe("normal");
  });

  it("does not penalize a long video when a live/mix hint allows it", () => {
    const t = track({ hints: ["live"] });
    const long = candidate({ videoId: "long", durationSeconds: 700, title: "IU Blueming Live" });
    const scored = scoreCandidates(t, [long], "audio");
    expect(scored[0].reasons.join(" ")).not.toMatch(/over 10 minutes/);
  });
});

describe("scoreCandidates: preference toggle", () => {
  it("flips ranking between a Topic upload and an official MV depending on preference", () => {
    const t = track();
    const topicAudio = candidate({ videoId: "topic", channelTitle: "IU - Topic", title: "Blueming" });
    const officialMv = candidate({ videoId: "mv", channelTitle: "1theK", title: "IU 'Blueming' Official MV" });

    const audioPref = scoreCandidates(t, [topicAudio, officialMv], "audio");
    expect(audioPref[0].videoId).toBe("topic");

    const mvPref = scoreCandidates(t, [topicAudio, officialMv], "mv");
    expect(mvPref[0].videoId).toBe("mv");
  });
});

describe("classifyScored", () => {
  it("returns not_found for an empty candidate list", () => {
    expect(classifyScored([])).toEqual({ status: "not_found" });
  });

  it("auto-matches a clear top candidate with a wide margin", () => {
    const t = track();
    const clear = candidate({ videoId: "clear", channelTitle: "IU - Topic", title: "IU Blueming" });
    const weak = candidate({ videoId: "weak", channelTitle: "randomguy123", title: "some cover" });
    const scored = scoreCandidates(t, [clear, weak], "audio");
    const result = classifyScored(scored);
    expect(result).toEqual({ status: "matched", selectedVideoId: "clear" });
  });

  it("flags a close top-2 as needing disambiguation", () => {
    const t = track();
    // Two near-identical uploads (same channel type, title match, duration) score
    // a tie, so even though both score high, the margin is too small to auto-pick.
    const a = candidate({ videoId: "a", channelTitle: "IU Official", title: "IU Blueming" });
    const b = candidate({ videoId: "b", channelTitle: "IU Official", title: "IU Blueming" });
    const scored = scoreCandidates(t, [a, b], "audio");
    expect(classifyScored(scored).status).toBe("needs_disambiguation");
  });
});

describe("scoreCandidates: Topic channel in a different script than the user's input", () => {
  it("still credits a Topic channel named in English when the description lists the Korean artist", () => {
    const t = track({ artist: "곽진언", title: "202호", altArtists: [], altTitles: [] });
    const topic = candidate({
      videoId: "topic",
      channelTitle: "Kwak Jin Eon - Topic",
      title: "202 (202호)",
      descriptionSnippet: "Provided to YouTube by Universal\n\n202 (202호) · 곽진언\n\n곽진언 Vol.1",
    });
    const fancam = candidate({ videoId: "fancam", channelTitle: "fan", title: "[직캠][4K] 곽진언 - 202호 [페스티벌]" });
    const [first] = scoreCandidates(t, [fancam, topic], "audio");
    expect(first.videoId).toBe("topic");
  });

  it("penalizes fancam videos as live unless the user hinted for live", () => {
    const t = track({ hints: [] });
    const fancam = candidate({ videoId: "fancam", title: "IU Blueming 직캠" });
    const plain = candidate({ videoId: "plain", title: "IU Blueming" });
    const [first] = scoreCandidates(t, [fancam, plain], "audio");
    expect(first.videoId).toBe("plain");
  });
});

describe("scoreCandidates: acoustic keyword", () => {
  it("penalizes an unhinted acoustic version and rewards it when hinted", () => {
    const acoustic = candidate({ videoId: "acoustic", title: "IU Blueming (Acoustic Ver.)" });
    const plain = candidate({ videoId: "plain", title: "IU Blueming" });
    expect(scoreCandidates(track({ hints: [] }), [acoustic, plain], "audio")[0].videoId).toBe("plain");
    expect(scoreCandidates(track({ hints: ["acoustic"] }), [acoustic, plain], "audio")[0].videoId).toBe("acoustic");
  });
});

describe("scoreCandidates: requested variant must be present", () => {
  it("ranks the instrumental upload above a more 'official' plain version when Inst. was requested", () => {
    const t = track({ artist: "구름", title: "冬に置いてきたもの", altArtists: [], altTitles: [], hints: ["instrumental"] });
    const plain = candidate({ videoId: "plain", channelTitle: "구름 Cloud koh", title: "구름 (cloud koh) - 冬に置いてきたもの" });
    const inst = candidate({ videoId: "inst", channelTitle: "Cloud koh - Topic", title: "冬に置いてきたもの (Inst.)" });
    expect(scoreCandidates(t, [plain, inst], "audio")[0].videoId).toBe("inst");
  });
});

describe("scoreCandidates: Topic by exact title and official audio", () => {
  it("credits a Topic upload with the exact title even when the artist is only in English", () => {
    const t = track({ artist: "장들레", title: "우리들의 가능성", altArtists: [], altTitles: [] });
    const topic = candidate({ videoId: "topic", channelTitle: "deulrejang - Topic", title: "우리들의 가능성", descriptionSnippet: "Provided to YouTube by X" });
    const broadcast = candidate({ videoId: "kbs", channelTitle: "KBS Kpop", title: "장들레 - 우리들의 가능성 | KBS 방송" });
    expect(scoreCandidates(t, [broadcast, topic], "audio")[0].videoId).toBe("topic");
  });

  it("does not credit a Topic channel whose title differs and whose artist is unknown", () => {
    const t = track({ artist: "장들레", title: "우리들의 가능성", altArtists: [], altTitles: [] });
    const other = candidate({ videoId: "other", channelTitle: "someone else - Topic", title: "Different Song" });
    expect(scoreCandidates(t, [other], "audio")[0].reasons.join(" ")).not.toMatch(/Topic channel/);
  });
});

describe("scoreCandidates: RMX abbreviation", () => {
  it("treats 'RMX' as a remix and ranks the plain original above it", () => {
    const t = track({ hints: [] });
    const rmx = candidate({ videoId: "rmx", channelTitle: "IU - Topic", title: "Blueming (Piano RMX)" });
    const original = candidate({ videoId: "orig", channelTitle: "IU - Topic", title: "Blueming" });
    expect(scoreCandidates(t, [rmx, original], "audio")[0].videoId).toBe("orig");
  });
});
