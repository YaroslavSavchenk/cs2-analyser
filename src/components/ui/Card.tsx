import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: boolean;
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
        "relative border border-cs-border bg-cs-charcoal-2/80 rounded-cs-md",
        accent && "border-t-cs-orange border-t-[2px]",
        className,
      )}
      {...props}
    >
      {corners ? (
        <>
          <span className="cs-corner-tl" />
          <span className="cs-corner-tr" />
          <span className="cs-corner-bl" />
          <span className="cs-corner-br" />
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
        "flex items-center justify-between gap-3 px-4 py-3 border-b border-cs-border",
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
        "font-mono text-[11px] uppercase tracking-[0.18em] text-cs-text-dim",
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
