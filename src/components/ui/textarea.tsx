import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-transparent bg-muted/40 px-3 py-2 text-base text-foreground",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
        "placeholder:text-muted-foreground",
        "hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:bg-background focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "lg:min-h-[80px] lg:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
