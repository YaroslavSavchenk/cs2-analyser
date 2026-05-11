import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

type ProgressProps = ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number;
  indeterminate?: boolean;
};

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
        "relative h-1.5 w-full overflow-hidden rounded-cs",
        "bg-cs-charcoal-3 border border-cs-border",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full transition-[width] duration-300 ease-out",
          "bg-cs-orange",
          indeterminate && "w-1/3 cs-shimmer",
        )}
        style={
          indeterminate
            ? undefined
            : {
                width: `${pct}%`,
                boxShadow: "0 0 12px rgba(254,110,44,0.45)",
              }
        }
      />
    </ProgressPrimitive.Root>
  );
}
