import { normalizeText } from "@/lib/scoring/normalize";

export interface DedupedLines {
  /** One entry per unique normalized line, in first-seen order. */
  uniqueLines: string[];
  /** Maps each original (non-blank) line index to its unique-line index. */
  lineIndexToUniqueIndex: number[];
}

export function dedupeLines(rawLines: string[]): DedupedLines {
  const nonBlank = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  const seen = new Map<string, number>();
  const uniqueLines: string[] = [];
  const lineIndexToUniqueIndex: number[] = [];

  for (const line of nonBlank) {
    const key = normalizeText(line);
    let uniqueIndex = seen.get(key);
    if (uniqueIndex === undefined) {
      uniqueIndex = uniqueLines.length;
      uniqueLines.push(line);
      seen.set(key, uniqueIndex);
    }
    lineIndexToUniqueIndex.push(uniqueIndex);
  }

  return { uniqueLines, lineIndexToUniqueIndex };
}
