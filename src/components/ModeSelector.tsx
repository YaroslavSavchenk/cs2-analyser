import * as Tabs from "@radix-ui/react-tabs";
import { Zap, Brain } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/Badge";

type Mode = "quick" | "full";

type ModeSelectorProps = {
  value: Mode;
  onChange: (value: Mode) => void;
};

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
          "border border-cs-border rounded-cs-md p-0.5",
          "bg-cs-charcoal-2",
        )}
        aria-label="Analysis mode"
      >
        <Tabs.Trigger
          value="quick"
          className={cn(
            "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-cs",
            "text-left text-cs-text-dim",
            "transition-colors duration-150",
            "data-[state=active]:bg-cs-charcoal-3 data-[state=active]:text-cs-text-bright",
            "hover:text-cs-text-bright",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cs-orange",
          )}
        >
          <Zap
            className={cn(
              "size-4 shrink-0 text-cs-muted",
              "group-data-[state=active]:text-cs-orange",
            )}
            strokeWidth={2}
          />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                Quick scan
              </span>
              <Badge variant="available" dot>
                Active
              </Badge>
            </div>
            <span className="text-[11px] text-cs-muted leading-tight">
              Demo parse, kill/death timeline
            </span>
          </div>
        </Tabs.Trigger>

        <Tabs.Trigger
          value="full"
          disabled
          className={cn(
            "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-cs",
            "text-left text-cs-muted",
            "cursor-not-allowed opacity-70",
          )}
        >
          <Brain className="size-4 shrink-0 text-cs-muted" strokeWidth={2} />
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                Full analysis
              </span>
              <Badge variant="coming-soon">v0.3</Badge>
            </div>
            <span className="text-[11px] text-cs-muted leading-tight">
              Vision LLM, positioning, comms
            </span>
          </div>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );
}
