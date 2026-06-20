import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base — iOS-style filled field, no harsh border
          "flex h-11 w-full rounded-lg border border-transparent bg-muted/40 px-3 py-2 text-base text-foreground",
          // Transitions — smooth bg + border + shadow
          "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
          // Placeholder + file
          "placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Hover (pointer devices)
          "hover:bg-muted/60",
          // Focus — awaken: background lightens, border primary, soft halo (no offset ring)
          "focus-visible:outline-none focus-visible:bg-background focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Sizing
          "lg:h-10 lg:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
