import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a 2px orange stripe along the top edge. */
  accent?: boolean;
  /** Adds tournament-style 4-corner brackets. */
  corners?: boolean;
  children?: ReactNode;
};

export function Card({
  className,
  accent = false,
  corners = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative border border-cs-border bg-cs-charcoal-2/85 rounded-none",
        accent && "border-t-[2px] border-t-cs-orange",
        corners && "hud-bracket-4",
        className,
      )}
      {...props}
    >
      {corners ? (
        <>
          <span className="b-tl" />
          <span className="b-tr" />
          <span className="b-bl" />
          <span className="b-br" />
        </>
      ) : null}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 h-10 border-b border-cs-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.22em] text-cs-text-dim font-bold",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 border-t border-cs-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
