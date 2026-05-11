import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

/**
 * Tournament-broadcast button. Sharp corners, monospace label, optional
 * bracket corners on primary/hero variants.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 select-none",
    "font-mono whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cs-black",
    "disabled:opacity-40 disabled:pointer-events-none",
    "active:translate-y-[1px]",
    "rounded-none uppercase tracking-[0.14em]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-cs-orange text-cs-black border border-cs-orange font-bold",
          "hover:bg-cs-orange-bright hover:border-cs-orange-bright",
          "focus-visible:ring-cs-orange/60",
          "shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.4),0_0_24px_-6px_rgba(255,107,31,0.55)]",
        ].join(" "),
        hero: [
          // big primary used as the welcome CTA
          "bg-cs-orange text-cs-black border-2 border-cs-orange font-bold",
          "hover:bg-cs-orange-bright hover:border-cs-orange-bright",
          "focus-visible:ring-cs-orange/60",
          "shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.35),0_0_36px_-6px_rgba(255,107,31,0.65)]",
        ].join(" "),
        secondary: [
          "bg-cs-charcoal-3 text-cs-text-bright border border-cs-border font-semibold",
          "hover:bg-cs-charcoal-4 hover:border-cs-border-bright",
          "focus-visible:ring-cs-border-bright",
        ].join(" "),
        ghost: [
          "bg-transparent text-cs-text border border-transparent font-medium",
          "hover:bg-cs-charcoal-2 hover:text-cs-text-bright",
          "focus-visible:ring-cs-border-bright",
        ].join(" "),
        danger: [
          "bg-cs-t/10 text-cs-t-bright border border-cs-t/45 font-semibold",
          "hover:bg-cs-t/20 hover:border-cs-t",
          "focus-visible:ring-cs-t/60",
        ].join(" "),
      },
      size: {
        sm: "h-7 px-2.5 text-[10px]",
        md: "h-9 px-4 text-[11px]",
        lg: "h-12 px-6 text-[12px]",
        xl: "h-14 px-8 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    children?: ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
