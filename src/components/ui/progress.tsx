import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

export function Progress({ value, className, ...props }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-surface-container-high", className)} {...props}>
      <div className="h-full rounded-full bg-gauge" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
