import * as Tabs from "@radix-ui/react-tabs";
import { Zap, Brain } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/Badge";

type Mode = "quick" | "full";

type ModeSelectorProps = {
  value: Mode;
  onChange: (value: Mode) => void;
};

/**
 * Broadcast-style segmented mode selector. Two slabs side-by-side, the active
 * one carries a left orange stripe. The disabled "Full analysis" slab gets a
 * diagonal hatch overlay so it reads as clearly NYI.
 */
export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(v) => {
        if (v === "quick") onChange("quick");
      }}
    >
      <Tabs.List
        className={cn(
          "grid grid-cols-2 gap-0",
          "border border-cs-border bg-cs-charcoal-2",
        )}
        aria-label="Analysis mode"
      >
        <Tabs.Trigger
          value="quick"
          className={cn(
            "group relative flex items-stretch text-left rounded-none",
            "transition-colors duration-150",
            "data-[state=active]:bg-cs-charcoal-3",
            "hover:bg-cs-charcoal-3/60",
            "focus-visible:outline-none focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-cs-orange",
          )}
        >
          {/* left stripe — orange when active */}
          <span
            aria-hidden
            className={cn(
              "w-1 shrink-0",
              "group-data-[state=active]:bg-cs-orange",
              "bg-cs-border",
            )}
          />
          <div className="flex items-center gap-3 px-3 py-2.5 min-w-0 flex-1">
            <Zap
              className={cn(
                "size-4 shrink-0 text-cs-muted",
                "group-data-[state=active]:text-cs-orange",
              )}
              strokeWidth={2.2}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cs-text-bright font-bold">
                  Quick scan
                </span>
                <Badge variant="available">Active</Badge>
              </div>
              <span className="text-[10.5px] text-cs-muted font-mono leading-tight">
                Demo parse / kill-death timeline / ~5s
              </span>
            </div>
          </div>
        </Tabs.Trigger>

        <Tabs.Trigger
          value="full"
          disabled
          className={cn(
            "group relative flex items-stretch text-left rounded-none",
            "cursor-not-allowed opacity-75",
            "border-l border-cs-border",
            "overflow-hidden",
          )}
        >
          {/* diagonal hatch overlay to visually mark "not available yet" */}
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 8px)",
            }}
          />
          <span
            aria-hidden
            className="relative w-1 shrink-0 bg-cs-border"
          />
          <div className="relative flex items-center gap-3 px-3 py-2.5 min-w-0 flex-1">
            <Brain
              className="size-4 shrink-0 text-cs-muted"
              strokeWidth={2.2}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cs-muted font-bold">
                  Full analysis
                </span>
                <Badge variant="coming-soon">v0.3</Badge>
              </div>
              <span className="text-[10.5px] text-cs-muted font-mono leading-tight">
                Vision LLM / positioning / comms
              </span>
            </div>
          </div>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );
}
