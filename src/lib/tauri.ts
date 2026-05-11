import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

export type AnalyzeMode = "quick" | "full";

export type AnalyzeDemoArgs = {
  path: string;
  mode: AnalyzeMode;
};

export type UpdateCheckResult =
  | { available: false }
  | { available: true; version: string; notes: string; date: string };

export type AnalysisStage =
  | "parsing"
  | "extracting"
  | "analyzing"
  | "finalizing";

export type AnalysisProgress = {
  job_id: string;
  stage: AnalysisStage;
  percent: number;
  message?: string;
};

export type Player = {
  name: string;
  steam_id: string;
};

export type KillEvent = {
  type: "kill";
  round: number;
  tick: number;
  attacker: Player;
  victim: Player;
  weapon: string;
  headshot: boolean;
};

export type DeathEvent = {
  type: "death";
  round: number;
  tick: number;
  victim: Player;
  killer?: Player;
  weapon?: string;
};

export type AnalysisEvent = KillEvent | DeathEvent;

export type AnalysisResult = {
  job_id: string;
  mode: AnalyzeMode;
  map: string;
  match_started_at: string;
  duration_seconds: number;
  rounds: number;
  events: AnalysisEvent[];
};

export type AnalysisErrorKind =
  | "spawn_failed"
  | "parse_failed"
  | "sidecar_crashed"
  | "cancelled"
  | "unsupported_mode";

export type AnalysisError = {
  job_id: string;
  kind: AnalysisErrorKind;
  message: string;
};

export type AnalysisEventHandlers = {
  onProgress?: (event: AnalysisProgress) => void;
  onResult?: (event: AnalysisResult) => void;
  onError?: (event: AnalysisError) => void;
};

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type StubJob = {
  id: string;
  timers: number[];
  cancelled: boolean;
};

const stubJobs = new Map<string, StubJob>();
const stubListeners = new Map<
  string,
  Set<(payload: unknown) => void>
>();

function emitStub(event: string, payload: unknown): void {
  const set = stubListeners.get(event);
  if (!set) return;
  for (const cb of set) cb(payload);
}

function listenStub(
  event: string,
  cb: (payload: unknown) => void,
): UnlistenFn {
  let set = stubListeners.get(event);
  if (!set) {
    set = new Set();
    stubListeners.set(event, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
  };
}

function makeStubResult(jobId: string, _path: string): AnalysisResult {
  const players: Player[] = [
    { name: "s1mple", steam_id: "STEAM_0:1:36968273" },
    { name: "ZywOo", steam_id: "STEAM_0:0:175302731" },
    { name: "NiKo", steam_id: "STEAM_0:0:9417022" },
    { name: "device", steam_id: "STEAM_0:1:13212680" },
    { name: "sh1ro", steam_id: "STEAM_0:1:524288124" },
    { name: "donk", steam_id: "STEAM_0:0:892017321" },
  ];
  const weapons = ["ak47", "m4a1_s", "awp", "usp_s", "deagle", "famas"];
  const events: AnalysisEvent[] = [];
  let tick = 1500;
  for (let round = 1; round <= 12; round++) {
    const kills = 3 + ((round * 7) % 4);
    for (let i = 0; i < kills; i++) {
      const a = players[(round + i) % players.length]!;
      const v = players[(round + i + 2) % players.length]!;
      tick += 380 + ((i * 53) % 220);
      events.push({
        type: "kill",
        round,
        tick,
        attacker: a,
        victim: v,
        weapon: weapons[(round + i) % weapons.length]!,
        headshot: (round + i) % 3 === 0,
      });
    }
  }
  return {
    job_id: jobId,
    mode: "quick",
    map: "de_mirage",
    match_started_at: new Date().toISOString(),
    duration_seconds: 2412,
    rounds: 24,
    events,
  };
}

function startStubJob(path: string): string {
  const jobId = `stub-${Date.now().toString(36)}`;
  const job: StubJob = { id: jobId, timers: [], cancelled: false };
  stubJobs.set(jobId, job);

  const stages: Array<{ stage: AnalysisStage; percent: number; msg: string }> =
    [
      { stage: "parsing", percent: 12, msg: "reading demo header" },
      { stage: "parsing", percent: 28, msg: "indexing ticks" },
      { stage: "extracting", percent: 44, msg: "kill events" },
      { stage: "extracting", percent: 62, msg: "round boundaries" },
      { stage: "analyzing", percent: 78, msg: "computing metrics" },
      { stage: "finalizing", percent: 94, msg: "packaging results" },
    ];

  stages.forEach((s, i) => {
    const t = window.setTimeout(
      () => {
        if (job.cancelled) return;
        const payload: AnalysisProgress = {
          job_id: jobId,
          stage: s.stage,
          percent: s.percent,
          message: s.msg,
        };
        emitStub("analysis:progress", payload);
      },
      300 + i * 420,
    );
    job.timers.push(t);
  });

  const doneT = window.setTimeout(
    () => {
      if (job.cancelled) return;
      emitStub("analysis:result", makeStubResult(jobId, path));
      stubJobs.delete(jobId);
    },
    300 + stages.length * 420 + 200,
  );
  job.timers.push(doneT);

  return jobId;
}

function cancelStubJob(jobId: string): void {
  const job = stubJobs.get(jobId);
  if (!job) return;
  job.cancelled = true;
  for (const t of job.timers) window.clearTimeout(t);
  stubJobs.delete(jobId);
  emitStub("analysis:error", {
    job_id: jobId,
    kind: "cancelled",
    message: "Job cancelled by user",
  } satisfies AnalysisError);
}

export async function analyzeDemo(args: AnalyzeDemoArgs): Promise<string> {
  if (args.mode === "full") {
    throw new Error("Full analysis is not available in v0.1");
  }
  if (isTauri()) {
    return tauriInvoke<string>("analyze_demo", { path: args.path, mode: args.mode });
  }
  return startStubJob(args.path);
}

export async function cancelAnalysis(jobId: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke<void>("cancel_analysis", { job_id: jobId });
    return;
  }
  cancelStubJob(jobId);
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (isTauri()) {
    return tauriInvoke<UpdateCheckResult>("check_for_update");
  }
  return { available: false };
}

export async function installUpdate(): Promise<void> {
  if (isTauri()) {
    await tauriInvoke<void>("install_update");
    return;
  }
  return;
}

export function onAnalysisEvent(
  jobId: string,
  handlers: AnalysisEventHandlers,
): () => void {
  const unsubs: Array<UnlistenFn | (() => void)> = [];
  let aborted = false;

  // If the caller unsubscribes before tauriListen resolves, immediately
  // unlisten the late-arriving handle so it doesn't leak into the next job.
  const trackAsync = (p: Promise<UnlistenFn>) => {
    void p.then((u) => {
      if (aborted) {
        try {
          u();
        } catch {
          /* noop */
        }
      } else {
        unsubs.push(u);
      }
    });
  };

  const wireProgress = (payload: AnalysisProgress) => {
    if (payload.job_id !== jobId) return;
    handlers.onProgress?.(payload);
  };
  const wireResult = (payload: AnalysisResult) => {
    if (payload.job_id !== jobId) return;
    handlers.onResult?.(payload);
  };
  const wireError = (payload: AnalysisError) => {
    if (payload.job_id !== jobId) return;
    handlers.onError?.(payload);
  };

  if (isTauri()) {
    trackAsync(
      tauriListen<AnalysisProgress>("analysis:progress", (e) =>
        wireProgress(e.payload),
      ),
    );
    trackAsync(
      tauriListen<AnalysisResult>("analysis:result", (e) =>
        wireResult(e.payload),
      ),
    );
    trackAsync(
      tauriListen<AnalysisError>("analysis:error", (e) =>
        wireError(e.payload),
      ),
    );
  } else {
    unsubs.push(
      listenStub("analysis:progress", (p) =>
        wireProgress(p as AnalysisProgress),
      ),
    );
    unsubs.push(
      listenStub("analysis:result", (p) => wireResult(p as AnalysisResult)),
    );
    unsubs.push(
      listenStub("analysis:error", (p) => wireError(p as AnalysisError)),
    );
  }

  return () => {
    aborted = true;
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* noop */
      }
    }
  };
}

export async function pickDemoFile(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "CS2 Demo", extensions: ["dem"] }],
    });
    if (typeof result === "string") return result;
    return null;
  }
  return `C:\\demos\\sample-${Date.now()}.dem`;
}

export const APP_VERSION = "0.1.0";
