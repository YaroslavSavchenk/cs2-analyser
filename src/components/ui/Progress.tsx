import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

type ProgressProps = ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number;
  indeterminate?: boolean;
};

/**
 * Broadcast-style segmented progress bar. Sharp corners, orange glow, and
 * a thin scan-line overlay during active runs.
 */
export function Progress({
  className,
  value,
  indeterminate = false,
  ...props
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={indeterminate ? undefined : pct}
      max={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-none",
        "bg-cs-charcoal-3 border border-cs-border",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "relative h-full transition-[width] duration-300 ease-out",
          "bg-gradient-to-r from-cs-orange-dim via-cs-orange to-cs-orange-bright",
          indeterminate && "w-1/3 hud-shimmer",
        )}
        style={
          indeterminate
            ? undefined
            : {
                width: `${pct}%`,
                boxShadow:
                  "0 0 16px rgba(255,107,31,0.55), inset 0 -1px 0 0 rgba(0,0,0,0.35)",
              }
        }
      >
        {/* trailing edge highlight */}
        <span
          aria-hidden
          className="absolute top-0 right-0 h-full w-px bg-cs-orange-bright/90"
        />
      </ProgressPrimitive.Indicator>
      {/* faint scan overlay */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 6px)",
        }}
      />
    </ProgressPrimitive.Root>
  );
}
