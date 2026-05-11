import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FileSearch,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Radar,
  Cpu,
  HardDrive,
  Shield,
} from "lucide-react";
import {
  analyzeDemo,
  cancelAnalysis,
  isTauri,
  onAnalysisEvent,
  pickDemoFile,
  APP_VERSION,
  type AnalysisStage,
} from "./lib/tauri";
import { useAnalysisStore } from "./store/analysis";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { Progress } from "./components/ui/Progress";
import { Card, CardHeader, CardTitle, CardBody } from "./components/ui/Card";
import { ModeSelector } from "./components/ModeSelector";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { ResultsList } from "./components/ResultsList";
import { cn } from "./lib/utils";

// Lazy-load three.js hero so the broadcast shell paints first.
const HeroModel = lazy(() =>
  import("./components/HeroModel").then((m) => ({ default: m.HeroModel })),
);

const STAGE_ORDER: AnalysisStage[] = [
  "parsing",
  "extracting",
  "analyzing",
  "finalizing",
];

const STAGE_LABEL: Record<AnalysisStage, string> = {
  parsing: "Parse",
  extracting: "Extract",
  analyzing: "Analyse",
  finalizing: "Finalise",
};

function shortPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  const file = parts[parts.length - 1] ?? "";
  return `…/${file}`;
}

/* ============================================================== */
/*  Broadcast shell — TopBar, SideRails, Footer                   */
/* ============================================================== */

function TopBar({
  state,
}: {
  state: "idle" | "running" | "done" | "error";
}) {
  // tournament-style status pill
  const statusMap = {
    idle: { label: "Idle", tone: "text-cs-text-dim", dot: "bg-cs-text-dim" },
    running: {
      label: "Live",
      tone: "text-cs-orange",
      dot: "bg-cs-orange hud-pulse-orange",
    },
    done: {
      label: "Ready",
      tone: "text-cs-success",
      dot: "bg-cs-success",
    },
    error: { label: "Fault", tone: "text-cs-t-bright", dot: "bg-cs-t" },
  } as const;
  const s = statusMap[state];

  return (
    <header
      className={cn(
        "relative h-12 shrink-0 border-b border-cs-border bg-cs-charcoal-2/95 backdrop-blur",
        "flex items-stretch z-30",
      )}
    >
      {/* CT-blue left cap */}
      <span
        aria-hidden
        className="w-1 hud-rail-ct"
      />
      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
        {/* left: brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex">
              <span className={cn("size-2", s.dot)} />
            </span>
            <span className="font-mono text-[11.5px] font-bold tracking-[0.28em] text-cs-text-bright">
              CS2/ANALYSER
            </span>
          </div>
          <span className="hidden sm:inline-block h-3 w-px bg-cs-border" />
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
            <span>build</span>
            <span className="text-cs-text-dim tabular">{APP_VERSION}</span>
          </span>
        </div>

        {/* centre: status pill */}
        <div className="hidden md:flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 h-7 px-2.5",
              "border border-cs-border bg-cs-charcoal-3",
              "font-mono text-[10px] uppercase tracking-[0.22em] font-bold",
              s.tone,
            )}
          >
            <span className={cn("inline-block size-1.5", s.dot)} />
            <span>// {s.label}</span>
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
            {isTauri() ? "win/tauri" : "web/preview"}
          </span>
        </div>

        {/* right: actions */}
        <div className="flex items-center justify-end gap-2">
          <UpdateBanner />
          <span className="h-4 w-px bg-cs-border mx-1" />
          <SettingsDialog />
        </div>
      </div>
      {/* T-red right cap */}
      <span
        aria-hidden
        className="w-1 hud-rail-t"
      />
    </header>
  );
}

function Footer({
  state,
  progress,
  stage,
}: {
  state: "idle" | "running" | "done" | "error";
  progress: number;
  stage: AnalysisStage | null;
}) {
  return (
    <footer
      className={cn(
        "relative h-7 shrink-0 border-t border-cs-border bg-cs-charcoal-2/95",
        "flex items-stretch z-30",
      )}
    >
      <span aria-hidden className="w-1 hud-rail-ct" />
      <div className="flex-1 flex items-center justify-between px-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
        <div className="flex items-center gap-3">
          <span>local · windows · tauri-2</span>
          <span className="text-cs-border-bright">/</span>
          <span>no telemetry</span>
          <span className="text-cs-border-bright">/</span>
          <span>no cloud</span>
        </div>
        <div className="flex items-center gap-3">
          {state === "running" ? (
            <span className="inline-flex items-center gap-1.5 text-cs-orange">
              <span className="size-1.5 bg-cs-orange hud-blink" />
              {stage ? STAGE_LABEL[stage].toLowerCase() : "init"} ·{" "}
              <span className="tabular">{Math.round(progress)}%</span>
            </span>
          ) : (
            <span>sig // {state}</span>
          )}
          <span className="text-cs-border-bright">/</span>
          <span className="text-cs-text-dim tabular">v{APP_VERSION}</span>
        </div>
      </div>
      <span aria-hidden className="w-1 hud-rail-t" />
    </footer>
  );
}

/* ============================================================== */
/*  Welcome screen                                                 */
/* ============================================================== */

function WelcomeState({
  mode,
  onModeChange,
  onPick,
  picking,
}: {
  mode: "quick" | "full";
  onModeChange: (m: "quick" | "full") => void;
  onPick: () => void;
  picking: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-5 flex-1 min-h-0">
      {/* LEFT: hero proscenium ===================================== */}
      <section
        className={cn(
          "relative overflow-hidden",
          "border border-cs-border bg-cs-black",
          "hud-proscenium hud-vignette",
          "min-h-[480px] lg:min-h-0",
          "hud-bracket-4",
        )}
        aria-label="Operator preview"
      >
        <span className="b-tl" />
        <span className="b-tr" />
        <span className="b-bl" />
        <span className="b-br" />
        {/* HUD readouts — top-left */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-text-dim">
            <Radar className="size-3 text-cs-orange" strokeWidth={2.2} />
            <span>op // standby</span>
          </div>
          <div className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-cs-muted">
            sig 060Hz · render webgl
          </div>
        </div>

        {/* top-right: live tag */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          <Badge variant="available" dot>
            local / offline
          </Badge>
          <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-cs-muted">
            ch.01 · operator
          </span>
        </div>

        {/* the model */}
        <div className="absolute inset-0">
          <Suspense
            fallback={<div className="h-full w-full" aria-hidden="true" />}
          >
            <HeroModel className="h-full w-full" />
          </Suspense>
        </div>

        {/* scan line sweep */}
        <span aria-hidden className="hud-scan-line" />

        {/* bottom plate: tournament-style nameplate */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div
            className={cn(
              "flex items-stretch border border-cs-border bg-cs-charcoal-2/85 backdrop-blur-sm",
            )}
          >
            <div className="flex items-center px-2 bg-cs-orange">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-black font-bold">
                OP-01
              </span>
            </div>
            <div className="flex-1 px-3 py-1.5 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="display-numeral text-[12px] leading-none text-cs-text-bright">
                  OPERATOR / IDLE
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cs-muted">
                  awaiting demo // mode: quick scan
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cs-text-dim">
                <span className="tabular">0.0 ms</span>
                <span className="text-cs-border-bright">/</span>
                <span>idle</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT: action stack ===================================== */}
      <section className="flex flex-col gap-4 min-w-0">
        {/* eyebrow */}
        <div className="flex items-center gap-2">
          <span className="inline-block h-px w-8 bg-cs-orange" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-cs-orange font-bold">
            v0.1 · quick scan pipeline
          </span>
        </div>

        {/* headline */}
        <div className="flex flex-col gap-1.5">
          <h1 className="display-numeral text-[44px] sm:text-[52px] leading-[0.92] text-cs-text-bright">
            DECODE
            <span className="block text-cs-orange">YOUR DEMO.</span>
          </h1>
          <p className="text-[13.5px] text-cs-text-dim max-w-md leading-relaxed">
            Drop a CS2{" "}
            <span className="font-mono text-cs-text">.dem</span> and pull a clean
            kill/death timeline in seconds. Compute runs local — no upload, no
            telemetry, no cloud round-trip.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2">
          <Button
            variant="hero"
            size="xl"
            onClick={onPick}
            disabled={picking}
            className="w-full sm:w-auto"
          >
            <FileSearch className="size-4" strokeWidth={2.4} />
            {picking ? "OPENING..." : "INSERT DEMO"}
            <span
              aria-hidden
              className="font-mono ml-2 text-[10px] tracking-[0.16em] opacity-75"
            >
              [ .DEM ]
            </span>
          </Button>
          <div className="flex items-center justify-between gap-3 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
            <span>accepts .dem // up to ~120 mb</span>
            <span className="text-cs-text-dim">
              shortcut <span className="text-cs-text-bright">↵</span>
            </span>
          </div>
        </div>

        {/* mode */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-text-dim font-bold">
              Analysis mode
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cs-muted">
              02 channels
            </span>
          </div>
          <ModeSelector value={mode} onChange={onModeChange} />
        </div>

        {/* pipeline rack */}
        <Card className="mt-auto" corners>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Pipeline rack</CardTitle>
              <Badge variant="ghost" dot>
                ready
              </Badge>
            </div>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
              03 modules
            </span>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-4">
            <PipelineCell
              icon={<HardDrive className="size-3" strokeWidth={2.2} />}
              label="Demo parser"
              status="ok"
              hint="demoparser2"
            />
            <PipelineCell
              icon={<Cpu className="size-3" strokeWidth={2.2} />}
              label="Sidecar"
              status="ok"
              hint="Python 3.11"
            />
            <PipelineCell
              icon={<Shield className="size-3" strokeWidth={2.2} />}
              label="Vision LLM"
              status="pending"
              hint="v0.3"
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function PipelineCell({
  icon,
  label,
  status,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  status: "ok" | "pending" | "error";
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cs-text-dim flex items-center gap-1.5 font-bold">
        <span
          className={cn(
            status === "ok" && "text-cs-orange",
            status === "pending" && "text-cs-muted",
            status === "error" && "text-cs-t",
          )}
        >
          {icon}
        </span>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5",
            status === "ok" && "bg-cs-orange",
            status === "pending" && "bg-cs-muted",
            status === "error" && "bg-cs-t",
          )}
        />
        <span className="font-mono text-[10.5px] text-cs-text tabular">
          {hint}
        </span>
      </div>
    </div>
  );
}

/* ============================================================== */
/*  Analysis screen                                                */
/* ============================================================== */

function AnalysisState({
  onReset,
  onCancel,
}: {
  onReset: () => void;
  onCancel: () => void;
}) {
  const { status, progress, stage, stageMessage, result, error, demoPath } =
    useAnalysisStore();

  const stageLabel = stage ? STAGE_LABEL[stage] : "Init";
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 hud-fade-up">
      {/* control panel ============================================ */}
      <Card accent corners>
        <CardHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <CardTitle>
              {isRunning
                ? "Live analysis"
                : isDone
                  ? "Analysis complete"
                  : "Analysis fault"}
            </CardTitle>
            <Badge
              variant={isError ? "t" : isDone ? "live" : "available"}
              dot
            >
              {isRunning ? "running" : isDone ? "complete" : "error"}
            </Badge>
            {demoPath ? (
              <span
                className="font-mono text-[10px] text-cs-muted truncate tabular"
                title={demoPath}
              >
                {shortPath(demoPath)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button variant="danger" size="sm" onClick={onCancel}>
                <XCircle className="size-3.5" strokeWidth={2.2} />
                Abort
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onReset}>
                <RotateCcw className="size-3.5" strokeWidth={2.2} />
                New analysis
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-text-dim font-bold">
                Stage {stage ? STAGE_ORDER.indexOf(stage) + 1 : 0} / 4 ·{" "}
                {stageLabel}
              </span>
              {stageMessage ? (
                <span className="font-mono text-[11px] text-cs-text truncate">
                  {stageMessage}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-cs-text-dim">
                  {isRunning ? "executing..." : isDone ? "all ok." : "stopped"}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="display-numeral text-[28px] leading-none text-cs-orange tabular">
                {Math.round(progress).toString().padStart(2, "0")}
              </span>
              <span className="font-mono text-[12px] text-cs-orange/70">%</span>
            </div>
          </div>
          <Progress
            value={progress}
            indeterminate={isRunning && progress < 4}
          />
          <ol className="flex items-center justify-between gap-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-cs-muted">
            {STAGE_ORDER.map((s, i) => {
              const active = stage === s && !isDone;
              const done = isDone || stageGte(stage, s, isDone);
              return (
                <li
                  key={s}
                  className="inline-flex items-center gap-1.5 flex-1 min-w-0"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0",
                      done && "bg-cs-orange",
                      active && !done && "bg-cs-orange hud-blink",
                      !active && !done && "bg-cs-border-bright",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate",
                      done
                        ? "text-cs-text-bright"
                        : active
                          ? "text-cs-orange"
                          : "text-cs-muted",
                    )}
                  >
                    <span className="text-cs-muted tabular">
                      {i.toString().padStart(2, "0")}
                    </span>{" "}
                    {STAGE_LABEL[s]}
                  </span>
                  {i < STAGE_ORDER.length - 1 ? (
                    <span className="flex-1 h-px bg-cs-border" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      {/* error block ============================================== */}
      {isError && error ? (
        <Card className="border-cs-t/50">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="size-4 text-cs-t shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cs-t-bright font-bold">
                  {error.kind.replace(/_/g, " ")}
                </span>
                <span className="text-[12.5px] text-cs-text break-words font-mono">
                  {error.message}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* results ================================================== */}
      {isDone && result ? <ResultsList result={result} /> : null}
    </div>
  );
}

function stageGte(
  current: AnalysisStage | null,
  target: AnalysisStage,
  isDone: boolean,
): boolean {
  if (isDone) return true;
  if (!current) return false;
  return STAGE_ORDER.indexOf(current) > STAGE_ORDER.indexOf(target);
}

/* ============================================================== */
/*  Root                                                            */
/* ============================================================== */

function App() {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [picking, setPicking] = useState(false);

  const { status, jobId, start, setProgress, finish, fail, reset, progress, stage } =
    useAnalysisStore();

  useEffect(() => {
    if (!jobId) return;
    const unsubscribe = onAnalysisEvent(jobId, {
      onProgress: (e) => setProgress(e.percent, e.stage, e.message),
      onResult: (e) => finish(e),
      onError: (e) => fail(e),
    });
    return () => {
      unsubscribe();
    };
  }, [jobId, setProgress, finish, fail]);

  const pickAndStart = useCallback(async () => {
    setPicking(true);
    try {
      const path = await pickDemoFile();
      if (!path) return;
      const id = await analyzeDemo({ path, mode: "quick" });
      start(id, path);
    } catch (e) {
      fail({
        job_id: "local",
        kind: "spawn_failed",
        message: e instanceof Error ? e.message : "Failed to start analysis",
      });
    } finally {
      setPicking(false);
    }
  }, [start, fail]);

  const onCancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await cancelAnalysis(jobId);
    } catch {
      /* noop */
    }
  }, [jobId]);

  const view = useMemo(() => {
    if (status === "idle") {
      return (
        <WelcomeState
          mode={mode}
          onModeChange={setMode}
          onPick={pickAndStart}
          picking={picking}
        />
      );
    }
    return <AnalysisState onReset={reset} onCancel={onCancel} />;
  }, [status, mode, picking, pickAndStart, reset, onCancel]);

  return (
    <div className="relative flex flex-col h-screen text-cs-text-bright bg-cs-black hud-grid overflow-hidden">
      {/* whole-screen broadcast side rails ===================== */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-12 bottom-7 w-px hud-rail-ct z-10"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-12 bottom-7 w-px hud-rail-t z-10"
      />

      <TopBar state={status} />

      <main className="relative flex-1 min-h-0 overflow-auto hud-scrollbar">
        {/* outer grid frame */}
        <div className="mx-auto max-w-[1320px] px-6 py-6 h-full min-h-full flex flex-col">
          {view}
        </div>
      </main>

      <Footer state={status} progress={progress} stage={stage} />
    </div>
  );
}

export default App;
