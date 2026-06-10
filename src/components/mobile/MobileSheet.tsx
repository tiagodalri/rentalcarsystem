import * as React from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * MobileSheet — bottom sheet primitive used across the admin mobile UI.
 * Built on top of `vaul` so we get a proper iOS-feeling drag handle, swipe
 * to dismiss, and a backdrop. Safe-area aware at the bottom.
 *
 * Replaces shadcn Dialog whenever we're on mobile.
 */

export interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Optional snap points (vaul). Use percentages like `["40%", 1]` for
   * map-style sheets. Default is a single auto-sized sheet.
   */
  snapPoints?: (string | number)[];
  /** When `true` (default), shows a small grab handle at the top. */
  showHandle?: boolean;
  /** Disable the close-on-backdrop-click behavior. */
  dismissible?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  /** Optional footer (e.g. primary action). Sticks to the bottom of the sheet. */
  footer?: React.ReactNode;
}

export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  snapPoints,
  showHandle = true,
  dismissible = true,
  className,
  contentClassName,
  children,
  footer,
}: MobileSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      dismissible={dismissible}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] flex h-auto max-h-[92dvh] flex-col rounded-t-[22px] border-t border-border/40 bg-background text-foreground shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.45)] outline-none",
            className,
          )}
        >
          {showHandle && (
            <div className="mx-auto mt-2 mb-1 h-[5px] w-[40px] shrink-0 rounded-full bg-muted-foreground/30" />
          )}
          {(title || description) && (
            <div className="px-5 pt-2 pb-3">
              {title && (
                <Drawer.Title className="text-[17px] font-semibold tracking-tight text-foreground">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="mt-0.5 text-[13px] text-muted-foreground">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}
          <div
            className={cn(
              "flex-1 overflow-y-auto overscroll-contain px-5 pb-2",
              contentClassName,
            )}
          >
            {children}
          </div>
          {footer && (
            <div
              className="border-t border-border/40 bg-background/95 px-5 pt-3 backdrop-blur-md"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
