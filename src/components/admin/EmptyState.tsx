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

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8" : "py-20"
      }`}
    >
      <Icon size={compact ? 40 : 56} strokeWidth={1.2} className="text-muted-foreground/40 mb-4" />
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="mt-4 gold-gradient text-primary-foreground text-xs font-semibold uppercase tracking-wider hover:opacity-90"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
