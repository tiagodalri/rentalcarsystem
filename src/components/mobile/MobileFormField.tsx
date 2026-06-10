import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * MobileFormField — input with floating label, 48pt minimum touch target,
 * proper mobile keyboard hints, and scroll-into-view on focus so the
 * software keyboard never covers the input.
 *
 * Usage:
 *   <MobileFormField label="Email" type="email" value={...} onChange={...} />
 *
 * For phone/number/currency, pass the appropriate `inputMode`. We default
 * to sensible mappings for common types so authors don't have to think.
 */
export interface MobileFormFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Render slot at the right side of the input (e.g. clear, eye). */
  trailing?: React.ReactNode;
  /** Render slot at the left of the input (e.g. flag, $ sign). */
  leading?: React.ReactNode;
}

const KEYBOARD_BY_TYPE: Record<string, { inputMode?: string; enterKeyHint?: string; autoComplete?: string }> = {
  email: { inputMode: "email", enterKeyHint: "next", autoComplete: "email" },
  tel: { inputMode: "tel", enterKeyHint: "next", autoComplete: "tel" },
  number: { inputMode: "numeric", enterKeyHint: "next" },
  url: { inputMode: "url", enterKeyHint: "go", autoComplete: "url" },
  search: { inputMode: "search", enterKeyHint: "search" },
};

export const MobileFormField = React.forwardRef<HTMLInputElement, MobileFormFieldProps>(
  function MobileFormField(
    { label, hint, error, trailing, leading, className, type = "text", id, onFocus, ...rest },
    ref,
  ) {
    const autoId = React.useId();
    const fieldId = id || autoId;
    const keyboard = KEYBOARD_BY_TYPE[type] || {};

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e);
      // Give the OS time to bring up the keyboard, then nudge the field
      // into view above it.
      setTimeout(() => {
        e.target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 280);
    };

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={fieldId}
          className="text-[12px] font-medium text-muted-foreground px-1"
        >
          {label}
        </label>
        <div
          className={cn(
            "flex items-stretch gap-2 rounded-xl border bg-background transition-colors",
            error
              ? "border-rose-500/70 focus-within:border-rose-500"
              : "border-border focus-within:border-foreground/60",
            "min-h-[48px] px-3",
          )}
        >
          {leading && (
            <div className="flex items-center text-muted-foreground">{leading}</div>
          )}
          <input
            ref={ref}
            id={fieldId}
            type={type}
            inputMode={(keyboard.inputMode as any) || (rest as any).inputMode}
            enterKeyHint={(keyboard.enterKeyHint as any) || (rest as any).enterKeyHint}
            autoComplete={keyboard.autoComplete || rest.autoComplete}
            onFocus={handleFocus}
            className={cn(
              "flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted-foreground/60 outline-none",
              "leading-[1.2]",
              className,
            )}
            {...rest}
          />
          {trailing && (
            <div className="flex items-center text-muted-foreground">{trailing}</div>
          )}
        </div>
        {error ? (
          <div className="text-[11.5px] text-rose-500 px-1">{error}</div>
        ) : hint ? (
          <div className="text-[11.5px] text-muted-foreground px-1">{hint}</div>
        ) : null}
      </div>
    );
  },
);
