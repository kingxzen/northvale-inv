import * as React from "react";
import { cn } from "@/lib/utils";

const badgeStyles = {
  critical: "border-error/35 bg-error/15 text-error",
  low: "border-secondary/35 bg-secondary/15 text-secondary",
  good: "border-success/35 bg-success/15 text-success",
  active: "border-primary/35 bg-primary/15 text-primary",
  neutral: "border-outline-variant bg-surface-container-high text-on-surface-variant"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof badgeStyles;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-label-sm",
        badgeStyles[tone],
        className
      )}
      {...props}
    />
  );
}
