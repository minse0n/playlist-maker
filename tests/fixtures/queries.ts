export interface QueryFixture {
  raw: string;
  note: string;
  expectArtistContains?: string;
  expectTitleContains?: string;
  expectHints?: string[];
}

/**
 * ~20 tricky real-world-style lines covering swapped artist/title order, mixed
 * Korean/English/Japanese, typos, explicit and negated hints, duplicates and
 * blank/unparseable input. Used by parseSchema.test.ts (schema-shape assertions
 * and, where recorded, a recorded-response fixture) — these are NOT run against a
 * live LLM call in CI.
 */
export const QUERY_FIXTURES: QueryFixture[] = [
  { raw: "IU Blueming", note: "plain EN order: artist title", expectArtistContains: "IU", expectTitleContains: "Blueming" },
  { raw: "Blueming IU", note: "swapped order, no separator", expectArtistContains: "IU", expectTitleContains: "Blueming" },
  { raw: "Blueming - IU", note: "swapped order with dash", expectArtistContains: "IU", expectTitleContains: "Blueming" },
  { raw: "뉴진스 하이프보이", note: "native Korean artist + title", expectArtistContains: "뉴진스", expectTitleContains: "하이프보이" },
  { raw: "하이프보이 뉴진스", note: "native Korean, swapped order", expectArtistContains: "뉴진스", expectTitleContains: "하이프보이" },
  { raw: "Kendrick Lamar - Not Like Us", note: "plain EN with dash separator", expectArtistContains: "Kendrick", expectTitleContains: "Not Like Us" },
  { raw: "아이유 밤편지 라이브 말고 원곡", note: "Korean title + NEGATED hint (not live, original)", expectArtistContains: "아이유", expectTitleContains: "밤편지", expectHints: [] },
  { raw: "아이유 밤편지 라이브", note: "Korean title + POSITIVE live hint", expectArtistContains: "아이유", expectTitleContains: "밤편지", expectHints: ["live"] },
  { raw: "iu bam pyeon ji", note: "fully romanized Korean title", expectArtistContains: "IU" },
  { raw: "Charlie Puth - Attention acoustic", note: "explicit acoustic hint", expectArtistContains: "Charlie Puth", expectHints: ["acoustic"] },
  { raw: "BLACKPINK Kill This Love MV", note: "explicit MV hint", expectArtistContains: "BLACKPINK", expectHints: ["mv"] },
  { raw: "Post Malone Sunflower remix", note: "explicit remix hint", expectArtistContains: "Post Malone", expectHints: ["remix"] },
  { raw: "Kendrik Lamar Not Like Us", note: "artist name typo (Kendrik)", expectTitleContains: "Not Like Us" },
  { raw: "아이유 블루밍", note: "Korean title for an English-titled song", expectArtistContains: "아이유" },
  { raw: "米津玄師 Lemon", note: "native Japanese artist + English title", expectTitleContains: "Lemon" },
  { raw: "Yonezu Kenshi Lemon", note: "romanized Japanese artist", expectTitleContains: "Lemon" },
  { raw: "Ariana Grande feat. Doja Cat - Motive", note: "featured-artist credit", expectArtistContains: "Ariana Grande", expectTitleContains: "Motive" },
  { raw: "iu   blueming", note: "extra whitespace, no punctuation, lowercase", expectArtistContains: "iu" },
  { raw: "asdkfj alksdjf laksjdf", note: "unparseable nonsense line (expect low confidence, no crash)" },
  { raw: "IU Blueming", note: "exact duplicate of fixture #1 (tests line-level dedupe)" },
  { raw: "   ", note: "whitespace-only line (must be filtered out before parsing)" },
];
