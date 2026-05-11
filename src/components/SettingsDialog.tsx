import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Separator from "@radix-ui/react-separator";
import { Settings, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { APP_VERSION, checkForUpdate, type UpdateCheckResult } from "../lib/tauri";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

type SettingsDialogProps = {
  trigger?: React.ReactNode;
};

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "done"; result: UpdateCheckResult }
  | { status: "error"; message: string };

function FieldRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-dim">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 h-9 rounded-cs",
          "border border-cs-border bg-cs-charcoal-3",
          "font-mono text-[12px] text-cs-text",
        )}
      >
        <span className="truncate">{value}</span>
        <Badge variant="coming-soon">read-only</Badge>
      </div>
      {hint ? <span className="text-[11px] text-cs-muted">{hint}</span> : null}
    </div>
  );
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  const runCheck = async () => {
    setCheck({ status: "checking" });
    try {
      const result = await checkForUpdate();
      setCheck({ status: "done", result });
    } catch (e) {
      setCheck({
        status: "error",
        message: e instanceof Error ? e.message : "Update check failed",
      });
    }
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label="Settings"
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-cs",
              "text-cs-text-dim hover:text-cs-text-bright",
              "hover:bg-cs-charcoal-3 transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cs-border-bright",
            )}
          >
            <Settings className="size-4" strokeWidth={2} />
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm cs-fade-in z-40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[min(620px,calc(100vw-2rem))]",
            "border border-cs-border bg-cs-charcoal-2 rounded-cs-md",
            "cs-fade-in shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cs-border">
            <div className="flex items-center gap-2.5">
              <Settings className="size-4 text-cs-orange" strokeWidth={2} />
              <Dialog.Title className="font-mono text-[12px] uppercase tracking-[0.16em] text-cs-text-bright">
                Settings
              </Dialog.Title>
              <Badge variant="ghost">v{APP_VERSION}</Badge>
            </div>
            <Dialog.Close asChild>
              <button
                className="text-cs-muted hover:text-cs-text-bright transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-4 py-4 flex flex-col gap-4">
            <Dialog.Description className="text-[12px] text-cs-text-dim">
              Read-only preview for v0.1. Configurable in v0.2.
            </Dialog.Description>

            <div className="grid grid-cols-1 gap-3">
              <FieldRow
                label="Vision model"
                value="qwen2.5-vl:7b"
                hint="Pulled via Ollama on first run (v0.3)"
              />
              <FieldRow
                label="Ollama endpoint"
                value="http://127.0.0.1:11434"
              />
              <FieldRow
                label="Analyzer sidecar"
                value="resources/analyzer/analyzer.exe"
              />
              <FieldRow
                label="Demo cache"
                value="%LOCALAPPDATA%\\cs2-analyser\\cache"
              />
            </div>

            <Separator.Root className="h-px bg-cs-border" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-dim">
                  Updates
                </span>
                {check.status === "idle" ? (
                  <span className="text-[12px] text-cs-text-dim">
                    Auto-checked on launch.
                  </span>
                ) : null}
                {check.status === "checking" ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-cs-text">
                    <Loader2 className="size-3.5 animate-spin" />
                    Checking GitHub releases...
                  </span>
                ) : null}
                {check.status === "done" && !check.result.available ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-cs-text">
                    <CheckCircle2 className="size-3.5 text-cs-orange" />
                    You are on the latest version.
                  </span>
                ) : null}
                {check.status === "done" && check.result.available ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-cs-text">
                    <CheckCircle2 className="size-3.5 text-cs-orange" />
                    Update available: {check.result.version}
                  </span>
                ) : null}
                {check.status === "error" ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-cs-t">
                    <AlertCircle className="size-3.5" />
                    {check.message}
                  </span>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={runCheck}
                disabled={check.status === "checking"}
              >
                Check for updates
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
