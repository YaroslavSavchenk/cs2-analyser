import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSearch,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  analyzeDemo,
  cancelAnalysis,
  isTauri,
  onAnalysisEvent,
  pickDemoFile,
  type AnalysisStage,
} from "./lib/tauri";
import { useAnalysisStore } from "./store/analysis";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { Progress } from "./components/ui/Progress";
import { Card, CardHeader, CardTitle, CardBody } from "./components/ui/Card";
import { HeroModel } from "./components/HeroModel";
import { ModeSelector } from "./components/ModeSelector";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { ResultsList } from "./components/ResultsList";
import { cn } from "./lib/utils";

const STAGE_LABEL: Record<AnalysisStage, string> = {
  parsing: "Parsing demo",
  extracting: "Extracting events",
  analyzing: "Analyzing",
  finalizing: "Finalizing",
};

function shortPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

function TopBar() {
  return (
    <header
      className={cn(
        "h-12 shrink-0 border-b border-cs-border bg-cs-charcoal-2/90 backdrop-blur",
        "flex items-center justify-between px-4",
        "relative z-20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex">
            <span className="size-2 rounded-full bg-cs-orange cs-pulse-orange" />
          </span>
          <span className="font-mono text-[12px] font-bold tracking-[0.22em] text-cs-text-bright">
            CS2 ANALYSER
          </span>
          <Badge variant="ghost" className="hidden sm:inline-flex">
            v0.1.0
          </Badge>
        </div>
        <span className="h-4 w-px bg-cs-border mx-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cs-muted">
          {isTauri() ? "desktop" : "browser preview"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <UpdateBanner />
        <SettingsDialog />
      </div>
    </header>
  );
}

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
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-6 min-h-0 flex-1">
      <div
        className={cn(
          "relative border border-cs-border rounded-cs-md overflow-hidden",
          "cs-grid-bg cs-vignette",
          "min-h-[420px] lg:min-h-0",
        )}
      >
        <span className="cs-corner-tl" />
        <span className="cs-corner-tr" />
        <span className="cs-corner-bl" />
        <span className="cs-corner-br" />
        <div
          className={cn(
            "absolute top-3 left-3 z-10",
            "font-mono text-[10px] uppercase tracking-[0.18em] text-cs-muted",
          )}
        >
          <div className="flex items-center gap-2">
            <Activity className="size-3 text-cs-orange" strokeWidth={2.4} />
            <span>operator · idle</span>
          </div>
        </div>
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
          <Badge variant="default" dot>
            local · offline
          </Badge>
        </div>
        <div className="absolute inset-0">
          <HeroModel className="h-full w-full" />
        </div>
        <div
          className={cn(
            "absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between",
            "font-mono text-[10px] uppercase tracking-[0.18em] text-cs-muted",
          )}
        >
          <span>cs2 · demo · .dem</span>
          <span>rt: 60fps · webgl</span>
        </div>
      </div>

      <div className="flex flex-col gap-6 min-w-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-cs-orange" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cs-orange">
              v0.1 · quick scan
            </span>
          </div>
          <h1 className="text-[44px] leading-[1.02] tracking-tight font-bold text-cs-text-bright">
            Decode <span className="text-cs-orange">your matches</span>.
          </h1>
          <p className="text-[14px] text-cs-text-dim max-w-md leading-relaxed">
            Drop a CS2 demo file and pull a clean kill/death timeline in under
            a minute. All compute runs locally — no uploads, no telemetry, no
            cloud round-trip.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={onPick}
            disabled={picking}
            className="w-full sm:w-auto"
          >
            <FileSearch className="size-4" strokeWidth={2.2} />
            {picking ? "Opening..." : "Select demo file"}
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-muted">
            accepts .dem · up to ~120 MB · processed in-place
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-dim">
            Mode
          </span>
          <ModeSelector value={mode} onChange={onModeChange} />
        </div>

        <Card className="mt-auto">
          <CardHeader>
            <CardTitle>Pipeline status</CardTitle>
            <Badge variant="ghost" dot>
              ready
            </Badge>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-3">
            <PipelineCell label="Demo parser" status="ok" hint="demoparser2" />
            <PipelineCell label="Sidecar" status="ok" hint="Python 3.11" />
            <PipelineCell
              label="Vision LLM"
              status="pending"
              hint="v0.3"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function PipelineCell({
  label,
  status,
  hint,
}: {
  label: string;
  status: "ok" | "pending" | "error";
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-dim">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            status === "ok" && "bg-cs-orange cs-pulse-orange",
            status === "pending" && "bg-cs-muted",
            status === "error" && "bg-cs-t",
          )}
        />
        <span className="font-mono text-[11px] text-cs-text">{hint}</span>
      </div>
    </div>
  );
}

function AnalysisState({
  onReset,
  onCancel,
}: {
  onReset: () => void;
  onCancel: () => void;
}) {
  const { status, progress, stage, stageMessage, result, error, demoPath } =
    useAnalysisStore();

  const stageLabel = stage ? STAGE_LABEL[stage] : "Starting";
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 cs-fade-in">
      <Card accent>
        <CardHeader>
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle>Analysis</CardTitle>
            <Badge variant={isError ? "t" : "available"} dot>
              {isRunning ? "running" : isDone ? "complete" : "error"}
            </Badge>
            {demoPath ? (
              <span
                className="font-mono text-[10px] text-cs-muted truncate"
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
                Cancel
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-cs-text-bright">
                {stageLabel}
              </span>
              {stageMessage ? (
                <span className="text-[12px] text-cs-text-dim">
                  · {stageMessage}
                </span>
              ) : null}
            </div>
            <span className="font-mono text-[11px] text-cs-orange">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} indeterminate={isRunning && progress < 4} />
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cs-muted">
            <StageDot label="parse" active={stage === "parsing"} done={progressGte(stage, "parsing")} />
            <StageLine />
            <StageDot label="extract" active={stage === "extracting"} done={progressGte(stage, "extracting")} />
            <StageLine />
            <StageDot label="analyze" active={stage === "analyzing"} done={progressGte(stage, "analyzing")} />
            <StageLine />
            <StageDot label="finalize" active={stage === "finalizing"} done={isDone} />
          </div>
        </CardBody>
      </Card>

      {isError && error ? (
        <Card className="border-cs-t/40">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="size-4 text-cs-t shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cs-t">
                  {error.kind.replace(/_/g, " ")}
                </span>
                <span className="text-[13px] text-cs-text break-words">
                  {error.message}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {isDone && result ? <ResultsList result={result} /> : null}
    </div>
  );
}

const STAGE_ORDER: AnalysisStage[] = [
  "parsing",
  "extracting",
  "analyzing",
  "finalizing",
];

function progressGte(current: AnalysisStage | null, target: AnalysisStage): boolean {
  if (!current) return false;
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

function StageDot({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          done && "bg-cs-orange",
          active && !done && "bg-cs-orange cs-pulse-orange",
          !active && !done && "bg-cs-border-bright",
        )}
      />
      <span className={cn(active || done ? "text-cs-text" : "text-cs-muted")}>
        {label}
      </span>
    </span>
  );
}

function StageLine() {
  return <span className="flex-1 h-px bg-cs-border mx-1" />;
}

function App() {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [picking, setPicking] = useState(false);

  const { status, jobId, start, setProgress, finish, fail, reset } =
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
    <div className="flex flex-col h-screen text-cs-text-bright">
      <TopBar />
      <main className="flex-1 min-h-0 overflow-auto cs-scrollbar">
        <div className="mx-auto max-w-[1280px] px-6 py-6 h-full flex flex-col">
          {view}
        </div>
      </main>
      <footer
        className={cn(
          "h-7 shrink-0 border-t border-cs-border bg-cs-charcoal-2/90",
          "flex items-center justify-between px-4",
          "font-mono text-[10px] uppercase tracking-[0.18em] text-cs-muted",
        )}
      >
        <span>local · windows · tauri 2</span>
        <span>build · v0.1.0</span>
      </footer>
    </div>
  );
}

export default App;
