import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 select-none",
    "font-medium tracking-wide whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cs-charcoal",
    "disabled:opacity-40 disabled:pointer-events-none",
    "active:translate-y-[1px]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-cs-orange text-cs-black border border-cs-orange",
          "hover:bg-cs-orange-bright hover:border-cs-orange-bright",
          "focus-visible:ring-cs-orange/60",
          "shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.35)]",
        ].join(" "),
        secondary: [
          "bg-cs-charcoal-3 text-cs-text-bright border border-cs-border",
          "hover:bg-cs-charcoal-4 hover:border-cs-border-bright",
          "focus-visible:ring-cs-border-bright",
        ].join(" "),
        ghost: [
          "bg-transparent text-cs-text border border-transparent",
          "hover:bg-cs-charcoal-2 hover:text-cs-text-bright",
          "focus-visible:ring-cs-border-bright",
        ].join(" "),
        danger: [
          "bg-cs-t/15 text-cs-t border border-cs-t/40",
          "hover:bg-cs-t/25 hover:border-cs-t",
          "focus-visible:ring-cs-t/60",
        ].join(" "),
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-cs",
        md: "h-9 px-3.5 text-sm rounded-cs-md",
        lg: "h-11 px-5 text-sm rounded-cs-md uppercase tracking-[0.08em]",
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
