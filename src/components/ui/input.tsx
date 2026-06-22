import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-body-md text-on-surface placeholder:text-outline",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
