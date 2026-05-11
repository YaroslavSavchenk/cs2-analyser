import { create } from "zustand";
import type {
  AnalysisError,
  AnalysisResult,
  AnalysisStage,
} from "../lib/tauri";

export type AnalysisStatus = "idle" | "running" | "done" | "error";

export type AnalysisState = {
  status: AnalysisStatus;
  jobId: string | null;
  demoPath: string | null;
  progress: number;
  stage: AnalysisStage | null;
  stageMessage: string | null;
  result: AnalysisResult | null;
  error: AnalysisError | null;
  startedAt: number | null;

  start: (jobId: string, demoPath: string) => void;
  setProgress: (progress: number, stage: AnalysisStage, message?: string) => void;
  finish: (result: AnalysisResult) => void;
  fail: (error: AnalysisError) => void;
  reset: () => void;
};

const initialState = {
  status: "idle" as AnalysisStatus,
  jobId: null,
  demoPath: null,
  progress: 0,
  stage: null,
  stageMessage: null,
  result: null,
  error: null,
  startedAt: null,
} satisfies Omit<
  AnalysisState,
  "start" | "setProgress" | "finish" | "fail" | "reset"
>;

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,

  start: (jobId, demoPath) =>
    set({
      ...initialState,
      status: "running",
      jobId,
      demoPath,
      startedAt: Date.now(),
    }),

  setProgress: (progress, stage, message) =>
    set({
      progress,
      stage,
      stageMessage: message ?? null,
    }),

  finish: (result) =>
    set({
      status: "done",
      result,
      progress: 100,
    }),

  fail: (error) =>
    set({
      status: "error",
      error,
    }),

  reset: () => set({ ...initialState }),
}));
