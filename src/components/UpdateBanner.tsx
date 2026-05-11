import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpCircle, X } from "lucide-react";
import {
  checkForUpdate,
  installUpdate,
  type UpdateCheckResult,
} from "../lib/tauri";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

/**
 * "Update available" affordance that lives in the broadcast top-bar. Hidden
 * when no update is available (per spec). Opens a Radix dialog with the
 * release notes and an install button.
 */
export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateCheckResult>({ available: false });
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((r) => {
        if (alive) setInfo(r);
      })
      .catch(() => {
        if (alive) setInfo({ available: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!info.available) return null;

  const onInstall = async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      await installUpdate();
      // On success the Rust side replaces the process via app.restart(),
      // so this promise never resolves.
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
      setInstalling(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "group relative inline-flex items-center gap-2 h-7 pl-2 pr-2.5",
            "border border-cs-orange/55 bg-cs-orange/10 text-cs-orange",
            "hover:bg-cs-orange/20 hover:border-cs-orange transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cs-orange/60",
            "rounded-none",
          )}
        >
          <span
            aria-hidden
            className="size-1.5 bg-cs-orange hud-pulse-orange"
          />
          <ArrowUpCircle className="size-3.5" strokeWidth={2.2} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold">
            Update {info.version}
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm hud-fade-in z-40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[min(560px,calc(100vw-2rem))]",
            "border border-cs-border bg-cs-charcoal-2 rounded-none",
            "hud-fade-up shadow-[0_0_0_1px_rgba(255,107,31,0.18),0_40px_100px_-20px_rgba(0,0,0,0.85)]",
            "hud-bracket-4",
          )}
        >
          <span className="b-tl" />
          <span className="b-tr" />
          <span className="b-bl" />
          <span className="b-br" />
          <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-cs-border bg-cs-charcoal-3/60">
            <div className="flex items-center gap-2.5">
              <ArrowUpCircle
                className="size-4 text-cs-orange"
                strokeWidth={2}
              />
              <Dialog.Title className="font-mono text-[11px] uppercase tracking-[0.22em] text-cs-text-bright font-bold">
                Release / inbound
              </Dialog.Title>
              <Badge variant="available" dot>
                v{info.version}
              </Badge>
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
          <div className="px-4 py-4">
            <Dialog.Description className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cs-text-dim mb-3">
              Cut · {info.date} · restart automatic
            </Dialog.Description>
            <div
              className={cn(
                "max-h-64 overflow-auto hud-scrollbar",
                "border border-cs-border bg-cs-black p-3",
                "font-mono text-[11px] leading-relaxed text-cs-text whitespace-pre-wrap",
              )}
            >
              {info.notes || "No release notes provided."}
            </div>
          </div>
          {installError && (
            <div
              className={cn(
                "px-4 py-2 text-[11px] border-t border-cs-border",
                "text-cs-t-bright bg-cs-t/5 font-mono",
              )}
              role="alert"
            >
              Install failed: {installError}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 px-4 h-12 border-t border-cs-border bg-cs-charcoal-3/40">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Later
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              onClick={onInstall}
              disabled={installing}
            >
              {installing ? "Installing..." : "Install & restart"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
