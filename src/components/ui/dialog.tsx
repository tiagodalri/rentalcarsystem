import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Drag-to-dismiss grab handle (mobile only).
 * Pulls the bottom-sheet down with the finger; closes if pulled past threshold,
 * snaps back with spring otherwise. Desktop ignores this entirely.
 */
function MobileGrabHandle({
  contentRef,
  onClose,
}: {
  contentRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const startY = React.useRef<number | null>(null);
  const dragging = React.useRef(false);

  const setTransform = (y: number, transition: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = transition
      ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    el.style.transform = `translateY(${y}px)`;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(min-width: 640px)").matches) return;
    startY.current = e.clientY;
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || startY.current === null) return;
    const dy = Math.max(0, e.clientY - startY.current);
    setTransform(dy, false);
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || startY.current === null) return;
    const dy = Math.max(0, e.clientY - startY.current);
    dragging.current = false;
    startY.current = null;
    const threshold = (contentRef.current?.offsetHeight ?? 400) * 0.25;
    if (dy > threshold || dy > 140) {
      // Animate off-screen then close.
      const h = contentRef.current?.offsetHeight ?? window.innerHeight;
      setTransform(h, true);
      window.setTimeout(() => {
        setTransform(0, false);
        onClose();
      }, 200);
    } else {
      setTransform(0, true);
    }
  };

  return (
    <div
      className="sm:hidden absolute top-0 left-0 right-0 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      aria-hidden
    >
      <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement>(null);
  // Merge forwarded ref + local ref
  React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={localRef}
        className={cn(
          // Base
          "fixed z-50 grid gap-4 border bg-background shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          // Mobile = bottom-sheet
          "inset-x-0 bottom-0 w-full max-h-[92dvh] rounded-t-2xl border-x-0 border-b-0 border-t border-border/60 px-4 pt-8 pb-[max(env(safe-area-inset-bottom),1.25rem)] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom overflow-y-auto overscroll-contain",
          // Desktop = centered modal
          "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:w-full sm:max-w-lg sm:max-h-[90vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border sm:p-6 sm:pb-6 sm:pt-6 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          className,
        )}
        {...props}
      >
        <MobileGrabHandle
          contentRef={localRef}
          onClose={() => closeBtnRef.current?.click()}
        />
        {children}
        <DialogPrimitive.Close
          ref={closeBtnRef}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 inline-flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-accent transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
