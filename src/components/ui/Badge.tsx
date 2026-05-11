import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 select-none",
    "h-[18px] px-1.5",
    "font-mono text-[9.5px] uppercase tracking-[0.16em] leading-none font-semibold",
    "border rounded-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-cs-charcoal-3 border-cs-border text-cs-text-dim",
        available: "bg-cs-orange/10 border-cs-orange/55 text-cs-orange",
        "coming-soon": "bg-cs-charcoal-3 border-cs-border text-cs-muted",
        ct: "bg-cs-ct/12 border-cs-ct/50 text-cs-ct-bright",
        t: "bg-cs-t/12 border-cs-t/50 text-cs-t-bright",
        ghost: "bg-transparent border-cs-border-bright/40 text-cs-text-dim",
        live: "bg-cs-orange text-cs-black border-cs-orange",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    children?: ReactNode;
    dot?: boolean;
  };

export function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          className={cn(
            "inline-block size-1.5",
            variant === "available" && "bg-cs-orange",
            variant === "coming-soon" && "bg-cs-muted",
            variant === "ct" && "bg-cs-ct",
            variant === "t" && "bg-cs-t",
            variant === "live" && "bg-cs-black",
            (variant === "default" || variant === "ghost" || !variant) &&
              "bg-cs-text-dim",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export { badgeVariants };
