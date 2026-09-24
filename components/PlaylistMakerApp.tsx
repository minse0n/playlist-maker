"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import PasteForm from "@/components/PasteForm";
import QuotaBanner from "@/components/QuotaBanner";
import ReviewTable from "@/components/ReviewTable";
import CreatePlaylistPanel from "@/components/CreatePlaylistPanel";
import QuickLinkPanel from "@/components/QuickLinkPanel";
import { readNdjson } from "@/lib/ndjson";
import { classifyScored } from "@/lib/scoring/score";
import {
  appReducer,
  buildInitialTracks,
  initialAppState,
  selectedVideoIdsInOrder,
} from "@/lib/clientPipeline";
import type {
  DisambiguationResponseParsed,
  ParsedTrackParsed,
} from "@/lib/zodSchemas";
import type { MatchPreference, ParsedTrack, PipelineTrack, QuotaEstimate, ScoredCandidate, SearchProgressEvent } from "@/lib/types";

interface AmbiguousItem {
  lineIndex: number;
  track: ParsedTrack;
  candidates: ScoredCandidate[];
}

async function parseLinesRemote(lines: string[]): Promise<{
  tracks: ParsedTrack[];
  errors: Array<{ lineIndex: number; error: string }>;
}> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `파싱 요청 실패 (${res.status})`);
  }
  return res.json();
}

async function disambiguateRemote(items: AmbiguousItem[]): Promise<DisambiguationResponseParsed> {
  const res = await fetch("/api/disambiguate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `판별 요청 실패 (${res.status})`);
  }
  return res.json();
}

export default function PlaylistMakerApp() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [quota, setQuota] = useState<QuotaEstimate | undefined>();
  const [searchEstimate, setSearchEstimate] = useState<number | undefined>();

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/quota/estimate");
      if (res.ok) setQuota(await res.json());
    } catch {
      // best-effort display only
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quota/estimate")
      .then((res) => (res.ok ? res.json() : undefined))
      .then((data) => {
        if (!cancelled && data) setQuota(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearchAndDisambiguate = useCallback(
    async (parsedTracks: ParsedTrack[], preference: MatchPreference, forceRefreshLineIndexes: number[] = []) => {
      const parsedByIndex = new Map(parsedTracks.map((t) => [t.lineIndex, t]));
      const ambiguous: AmbiguousItem[] = [];

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: parsedTracks, preference, forceRefreshLineIndexes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `검색 요청 실패 (${res.status})`);
      }

      await readNdjson<SearchProgressEvent>(res, (event) => {
        if (event.type === "track_result") {
          dispatch({ type: "TRACK_RESULT", lineIndex: event.lineIndex, candidates: event.candidates, cacheHit: event.cacheHit, stale: event.stale });
          const cls = classifyScored(event.candidates);
          if (cls.status === "needs_disambiguation") {
            const track = parsedByIndex.get(event.lineIndex);
            if (track) ambiguous.push({ lineIndex: event.lineIndex, track, candidates: event.candidates });
          }
        } else if (event.type === "track_error") {
          dispatch({ type: "TRACK_ERROR", lineIndex: event.lineIndex, error: event.error });
        } else if (event.type === "quota_exceeded") {
          dispatch({ type: "QUOTA_EXCEEDED", lineIndexes: event.remainingLineIndexes });
        }
      });

      dispatch({ type: "SEARCH_DONE" });
      refreshQuota();

      if (ambiguous.length > 0) {
        try {
          const result = await disambiguateRemote(ambiguous);
          dispatch({ type: "DISAMBIGUATION_APPLIED", results: result.results });
        } catch {
          // Leave ambiguous tracks as low_confidence with their top candidate pre-selected;
          // the user can still resolve them manually from the alternatives dropdown.
          dispatch({ type: "READY" });
        }
      } else {
        dispatch({ type: "READY" });
      }
    },
    [refreshQuota],
  );

  const handleSubmit = useCallback(async () => {
    const tracks = buildInitialTracks(state.rawInput.split("\n"));
    if (tracks.length === 0) return;
    dispatch({ type: "SUBMIT_START", tracks });

    try {
      const { tracks: parsed, errors } = await parseLinesRemote(tracks.map((t) => t.rawLine));
      const parsedByIndex = new Map(parsed.map((t) => [t.lineIndex, t]));
      const errorByIndex = new Map(errors.map((e) => [e.lineIndex, e.error]));

      const merged: PipelineTrack[] = tracks.map((t) => {
        const p = parsedByIndex.get(t.lineIndex);
        if (p) return { ...t, parsed: p, status: "searching" };
        return { ...t, status: "error", error: errorByIndex.get(t.lineIndex) ?? "파싱 실패" };
      });
      dispatch({ type: "PARSE_APPLIED", tracks: merged });
      dispatch({ type: "SEARCH_STARTED" });

      setSearchEstimate(undefined);
      fetch("/api/quota/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uncachedTrackCount: parsed.length }),
      })
        .then((r) => r.json())
        .then((body) => setSearchEstimate(body.searchEstimate))
        .catch(() => {});

      await runSearchAndDisambiguate(parsed, state.preference);
    } catch (err) {
      dispatch({ type: "PARSE_APPLIED", tracks: state.tracks, globalError: err instanceof Error ? err.message : String(err) });
    }
  }, [state.rawInput, state.preference, state.tracks, runSearchAndDisambiguate]);

  const handleResearch = useCallback(
    async (lineIndex: number) => {
      const track = state.tracks.find((t) => t.lineIndex === lineIndex);
      if (!track?.parsed) return;
      dispatch({ type: "SET_TRACK_SEARCHING", lineIndex });
      try {
        await runSearchAndDisambiguate([track.parsed], state.preference, [lineIndex]);
      } catch (err) {
        dispatch({ type: "TRACK_ERROR", lineIndex, error: err instanceof Error ? err.message : String(err) });
      }
    },
    [state.tracks, state.preference, runSearchAndDisambiguate],
  );

  const handleEditRawLine = useCallback(
    async (lineIndex: number, newLine: string) => {
      dispatch({ type: "SET_RAW_LINE", lineIndex, rawLine: newLine });
      dispatch({ type: "SET_TRACK_SEARCHING", lineIndex });
      try {
        const { tracks: parsed, errors } = await parseLinesRemote([newLine]);
        if (parsed.length === 0) {
          dispatch({ type: "TRACK_ERROR", lineIndex, error: errors[0]?.error ?? "파싱 실패" });
          return;
        }
        const remapped: ParsedTrack = { ...(parsed[0] as ParsedTrackParsed), lineIndex, rawLine: newLine };
        await runSearchAndDisambiguate([remapped], state.preference, [lineIndex]);
      } catch (err) {
        dispatch({ type: "TRACK_ERROR", lineIndex, error: err instanceof Error ? err.message : String(err) });
      }
    },
    [state.preference, runSearchAndDisambiguate],
  );

  const videoIds = selectedVideoIdsInOrder(state.tracks);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">플레이리스트 메이커</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          노래 목록을 붙여넣으면 유튜브에서 가장 정확한 영상을 찾아 재생목록을 만들어 드려요.
        </p>
      </header>

      <QuotaBanner
        unitsUsedToday={quota?.unitsUsedToday}
        dailyLimit={quota?.dailyLimit}
        estimateLabel={
          searchEstimate !== undefined && state.phase === "searching"
            ? `예상 검색 할당량: ~${searchEstimate} 단위`
            : videoIds.length > 0
              ? `재생목록 생성 예상 할당량: ~${50 + videoIds.length * 50} 단위`
              : undefined
        }
      />

      <PasteForm
        value={state.rawInput}
        onChange={(value) => dispatch({ type: "SET_RAW_INPUT", value })}
        preference={state.preference}
        onPreferenceChange={(preference) => dispatch({ type: "SET_PREFERENCE", preference })}
        onSubmit={handleSubmit}
        disabled={state.phase === "parsing" || state.phase === "searching"}
      />

      {state.globalError && <p className="text-sm text-rose-600 dark:text-rose-400">{state.globalError}</p>}
      {state.quotaExceededDuringSearch && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          오늘 검색 할당량을 초과했습니다. 이미 처리된 항목은 캐시되어 있으니, 나중에 다시 실행하면 이어서 진행됩니다.
        </p>
      )}

      <ReviewTable
        tracks={state.tracks}
        onReorder={(orderedIds) => dispatch({ type: "REORDER", orderedIds })}
        onSelectAlternative={(lineIndex, videoId) => dispatch({ type: "SELECT_ALTERNATIVE", lineIndex, videoId })}
        onRemove={(lineIndex) => dispatch({ type: "REMOVE_TRACK", lineIndex })}
        onToggleSkip={(lineIndex) => dispatch({ type: "TOGGLE_SKIP", lineIndex })}
        onResearch={handleResearch}
        onEditRawLine={handleEditRawLine}
      />

      {videoIds.length > 0 && (
        <>
          <CreatePlaylistPanel videoIds={videoIds} />
          <QuickLinkPanel videoIds={videoIds} />
        </>
      )}
    </div>
  );
}
