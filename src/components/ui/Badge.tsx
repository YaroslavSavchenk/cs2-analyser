import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 select-none",
    "h-5 px-1.5 rounded-cs",
    "font-mono text-[10px] uppercase tracking-[0.12em] leading-none",
    "border",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-cs-charcoal-3 border-cs-border text-cs-text-dim",
        available:
          "bg-cs-orange/10 border-cs-orange/45 text-cs-orange",
        "coming-soon":
          "bg-cs-charcoal-3 border-cs-border text-cs-muted",
        ct: "bg-cs-ct/12 border-cs-ct/40 text-cs-ct-bright",
        t: "bg-cs-t/12 border-cs-t/40 text-cs-t",
        ghost:
          "bg-transparent border-cs-border-bright/40 text-cs-text-dim",
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
            "size-1.5 rounded-full",
            variant === "available" && "bg-cs-orange cs-pulse-orange",
            variant === "coming-soon" && "bg-cs-muted",
            variant === "ct" && "bg-cs-ct",
            variant === "t" && "bg-cs-t",
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
