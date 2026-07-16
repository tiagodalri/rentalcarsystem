import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual ênfase do botão principal. */
  variant?: "destructive" | "default";
};

type Resolver = (ok: boolean) => void;

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmCtx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const resolverRef = useRef<Resolver | null>(null);
  const isMobile = useIsMobile();

  const finish = useCallback((value: boolean) => {
    setOpen(false);
    setBusy(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    // Pequeno delay pra terminar a animação antes de limpar
    setTimeout(() => setOpts(null), 200);
    r?.(value);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(next);
      setOpen(true);
      haptic.tap();
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const onCancel = () => finish(false);
  const onConfirm = () => {
    setBusy(true);
    haptic.tap();
    finish(true);
  };

  const variant = opts?.variant ?? "destructive";
  const confirmLabel = opts?.confirmLabel ?? "Confirmar";
  const cancelLabel = opts?.cancelLabel ?? "Cancelar";

  const body = opts && (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            variant === "destructive"
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-foreground/10 text-foreground"
          )}
        >
          <AlertTriangle className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold tracking-tight text-foreground">
            {opts.title}
          </div>
          {opts.description && (
            <div className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
              {opts.description}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={busy}
        className="h-12 rounded-xl text-[15px]"
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={cn(
          "h-12 rounded-xl text-[15px] font-medium",
          variant === "destructive"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-foreground text-background hover:bg-foreground/90"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
      </Button>
    </div>
  );

  return (
    <ConfirmCtx.Provider value={value}>
      {children}

      {/* Mobile: bottom sheet. alcance de polegar */}
      {isMobile ? (
        <Sheet
          open={open}
          onOpenChange={(v) => {
            if (!v) onCancel();
          }}
        >
          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-t p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{opts?.title ?? ""}</SheetTitle>
              {opts?.description && (
                <SheetDescription>
                  {typeof opts.description === "string" ? opts.description : ""}
                </SheetDescription>
              )}
            </SheetHeader>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            {body}
            {actions}
          </SheetContent>
        </Sheet>
      ) : (
        <AlertDialog
          open={open}
          onOpenChange={(v) => {
            if (!v) onCancel();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{opts?.title ?? ""}</AlertDialogTitle>
              {opts?.description && (
                <AlertDialogDescription asChild>
                  <div>{opts.description}</div>
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>{actions}</AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm deve ser usado dentro de <ConfirmProvider>");
  return ctx.confirm;
}
