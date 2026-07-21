import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatPersonName } from "@/lib/formatName";
import { cn } from "@/lib/utils";

/**
 * Standardized avatar for any place we show a person's name.
 * - Uses initials from formatPersonName (handles particles: "de", "da", "do"...).
 * - Monochrome by default to match the admin private-bank aesthetic.
 * - tone="gold" for emphasis in headers / hero contexts.
 */

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_MAP: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-20 w-20 text-xl",
};

export function getPersonInitials(rawName?: string | null): string {
  const formatted = formatPersonName(rawName || "");
  if (!formatted) return "?";
  const parts = formatted.split(" ").filter(
    (w) => w.length > 1 || /^[A-ZÀ-Ý]/.test(w),
  );
  if (parts.length === 0) return formatted.charAt(0).toUpperCase();
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

interface PersonAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string | null;
  src?: string | null;
  size?: Size;
  tone?: "neutral" | "gold";
}

export const PersonAvatar = React.forwardRef<HTMLSpanElement, PersonAvatarProps>(
  ({ name, src, size = "md", tone = "neutral", className, ...rest }, ref) => {
    const initials = getPersonInitials(name);
    const toneClass =
      tone === "gold"
        ? "bg-primary/10 text-primary ring-1 ring-primary/25"
        : "bg-muted text-foreground/80 ring-1 ring-border/60";

    return (
      <Avatar
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(SIZE_MAP[size], "shrink-0", className)}
        {...rest}
      >
        {src ? <AvatarImage src={src} alt={formatPersonName(name || "") || "avatar"} /> : null}
        <AvatarFallback
          className={cn(
            "font-medium tabular-nums tracking-tight select-none",
            toneClass,
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  },
);
PersonAvatar.displayName = "PersonAvatar";

export default PersonAvatar;
