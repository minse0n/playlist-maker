import { classifyScored, scoreCandidates } from "@/lib/scoring/score";
import type { MatchPreference, PipelineTrack, ScoredCandidate, TrackStatus } from "@/lib/types";

export function buildInitialTracks(rawLines: string[]): PipelineTrack[] {
  return rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((rawLine, lineIndex) => ({
      id: `track-${lineIndex}-${crypto.randomUUID()}`,
      lineIndex,
      rawLine,
      candidates: [],
      status: "pending" as TrackStatus,
      disambiguatedByLlm: false,
    }));
}

export interface AppState {
  rawInput: string;
  preference: MatchPreference;
  phase: "idle" | "parsing" | "searching" | "disambiguating" | "ready";
  tracks: PipelineTrack[];
  quotaExceededDuringSearch: boolean;
  globalError?: string;
}

export const initialAppState: AppState = {
  rawInput: "",
  preference: "audio",
  phase: "idle",
  tracks: [],
  quotaExceededDuringSearch: false,
};

export type AppAction =
  | { type: "SET_RAW_INPUT"; value: string }
  | { type: "SET_PREFERENCE"; preference: MatchPreference }
  | { type: "SUBMIT_START"; tracks: PipelineTrack[] }
  | { type: "PARSE_APPLIED"; tracks: PipelineTrack[]; globalError?: string }
  | { type: "SEARCH_STARTED" }
  | {
      type: "TRACK_RESULT";
      lineIndex: number;
      candidates: ScoredCandidate[];
      cacheHit: boolean;
      stale: boolean;
    }
  | { type: "TRACK_ERROR"; lineIndex: number; error: string }
  | { type: "QUOTA_EXCEEDED"; lineIndexes: number[] }
  | { type: "SEARCH_DONE" }
  | {
      type: "DISAMBIGUATION_APPLIED";
      results: Array<{
        lineIndex: number;
        choice: { candidateId: string } | { noMatch: true };
        confidence: number;
      }>;
    }
  | { type: "SELECT_ALTERNATIVE"; lineIndex: number; videoId: string }
  | { type: "REMOVE_TRACK"; lineIndex: number }
  | { type: "TOGGLE_SKIP"; lineIndex: number }
  | { type: "REORDER"; orderedIds: string[] }
  | { type: "SET_TRACK_SEARCHING"; lineIndex: number }
  | { type: "SET_RAW_LINE"; lineIndex: number; rawLine: string }
  | { type: "READY" };

function classify(track: PipelineTrack): PipelineTrack {
  const cls = classifyScored(track.candidates);
  if (cls.status === "not_found") {
    return { ...track, status: "not_found", selectedVideoId: undefined };
  }
  if (cls.status === "matched") {
    return { ...track, status: "matched", selectedVideoId: cls.selectedVideoId };
  }
  return { ...track, status: "low_confidence", selectedVideoId: track.candidates[0]?.videoId };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_RAW_INPUT":
      return { ...state, rawInput: action.value };

    case "SET_PREFERENCE": {
      // Re-score already-fetched candidates against the new preference at zero network cost.
      // The current selection is left untouched so a manual pick is never silently swapped.
      const tracks = state.tracks.map((t) => {
        if (!t.parsed || t.candidates.length === 0) return t;
        return { ...t, candidates: scoreCandidates(t.parsed, t.candidates, action.preference) };
      });
      return { ...state, preference: action.preference, tracks };
    }

    case "SUBMIT_START":
      return {
        ...state,
        phase: "parsing",
        tracks: action.tracks,
        quotaExceededDuringSearch: false,
        globalError: undefined,
      };

    case "PARSE_APPLIED":
      return { ...state, tracks: action.tracks, globalError: action.globalError };

    case "SEARCH_STARTED":
      return { ...state, phase: "searching" };

    case "SET_TRACK_SEARCHING":
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.lineIndex === action.lineIndex ? { ...t, status: "searching", error: undefined } : t)),
      };

    case "TRACK_RESULT": {
      const tracks = state.tracks.map((t) => {
        if (t.lineIndex !== action.lineIndex) return t;
        return classify({ ...t, candidates: action.candidates, stale: action.stale });
      });
      return { ...state, tracks };
    }

    case "TRACK_ERROR":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.lineIndex === action.lineIndex ? { ...t, status: "error", error: action.error } : t,
        ),
      };

    case "QUOTA_EXCEEDED": {
      const set = new Set(action.lineIndexes);
      return {
        ...state,
        quotaExceededDuringSearch: true,
        tracks: state.tracks.map((t) => (set.has(t.lineIndex) ? { ...t, status: "pending" } : t)),
      };
    }

    case "SEARCH_DONE":
      return { ...state, phase: "disambiguating" };

    case "DISAMBIGUATION_APPLIED": {
      const byIndex = new Map(action.results.map((r) => [r.lineIndex, r]));
      const tracks = state.tracks.map((t) => {
        const result = byIndex.get(t.lineIndex);
        if (!result) return t;
        if ("noMatch" in result.choice) {
          return { ...t, status: "not_found" as TrackStatus, selectedVideoId: undefined, disambiguatedByLlm: true };
        }
        return {
          ...t,
          status: (result.confidence >= 0.5 ? "matched" : "low_confidence") as TrackStatus,
          selectedVideoId: result.choice.candidateId,
          disambiguatedByLlm: true,
        };
      });
      return { ...state, tracks, phase: "ready" };
    }

    case "SELECT_ALTERNATIVE":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.lineIndex === action.lineIndex ? { ...t, selectedVideoId: action.videoId, status: "matched" } : t,
        ),
      };

    case "REMOVE_TRACK":
      return { ...state, tracks: state.tracks.filter((t) => t.lineIndex !== action.lineIndex) };

    case "TOGGLE_SKIP":
      return {
        ...state,
        tracks: state.tracks.map((t) => {
          if (t.lineIndex !== action.lineIndex) return t;
          if (t.status === "skipped") return classify(t);
          return { ...t, status: "skipped" as TrackStatus };
        }),
      };

    case "REORDER": {
      const byId = new Map(state.tracks.map((t) => [t.id, t]));
      const tracks = action.orderedIds.map((id) => byId.get(id)).filter((t): t is PipelineTrack => Boolean(t));
      return { ...state, tracks };
    }

    case "SET_RAW_LINE":
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.lineIndex === action.lineIndex ? { ...t, rawLine: action.rawLine } : t)),
      };

    case "READY":
      return { ...state, phase: "ready" };

    default:
      return state;
  }
}

export function selectedVideoIdsInOrder(tracks: PipelineTrack[]): string[] {
  return tracks
    .filter((t) => t.status !== "skipped" && t.selectedVideoId)
    .map((t) => t.selectedVideoId as string);
}

