import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Render compact (no vertical padding) for use inside CardContent */
  compact?: boolean;
}

/**
 * Decorative monochrome backdrop — concentric rings + dotted grid.
 * Pure SVG, uses currentColor so it adapts to light/dark automatically.
 */
function EmptyIllustration({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      className="absolute inset-0 m-auto text-foreground/[0.06] pointer-events-none"
    >
      <defs>
        <pattern id="empty-dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" />
        </pattern>
        <radialGradient id="empty-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="empty-mask">
          <rect width="160" height="160" fill="url(#empty-fade)" />
        </mask>
      </defs>
      {/* Dotted grid faded at edges */}
      <rect width="160" height="160" fill="url(#empty-dots)" mask="url(#empty-mask)" />
      {/* Concentric rings */}
      <circle cx="80" cy="80" r="36" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="80" cy="80" r="52" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="2 4" />
      <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
    </svg>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const illustrationSize = compact ? 108 : 148;
  const iconSize = compact ? 26 : 34;

  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center animate-fade-in px-4 mx-auto ${
        compact ? "py-6 sm:py-8" : "py-12 sm:py-16 lg:py-20"
      }`}
    >
      {/* Illustration: rings + dots backdrop with icon floating in the middle */}
      <div
        className="relative flex items-center justify-center mb-4 sm:mb-5 shrink-0"
        style={{ width: illustrationSize, height: illustrationSize, maxWidth: "80vw" }}
      >
        <EmptyIllustration size={illustrationSize} />
        <div
          className="relative flex items-center justify-center rounded-full bg-muted/60 border border-border/40 shadow-sm"
          style={{ width: illustrationSize * 0.35, height: illustrationSize * 0.35 }}
        >
          <Icon size={iconSize} strokeWidth={1.4} className="text-muted-foreground" />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1.5 max-w-[90%]">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="mt-5 gold-gradient text-primary-foreground text-xs font-semibold uppercase tracking-wider hover:opacity-90"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
