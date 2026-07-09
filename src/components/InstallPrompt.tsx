import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "zeus_install_prompt_dismissed_at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const when = Number(raw);
    if (!Number.isFinite(when)) return false;
    const diffDays = (Date.now() - when) / (1000 * 60 * 60 * 24);
    return diffDays < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS Safari only
  const iosStandalone = window.navigator.standalone === true;
  return Boolean(mql || iosStandalone);
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isPreviewContext(): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return host.includes("id-preview--") || host.includes("lovableproject.com");
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPreviewContext() || isStandalone() || recentlyDismissed()) return;

    // Mobile não exibe popup: adicionar à tela de início precisa ser feito
    // pelo menu nativo do navegador. Mantém PWA intacto, só esconde o prompt.
    const isMobileViewport = window.matchMedia?.("(max-width: 768px)").matches;
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
    if (isMobileViewport || isCoarsePointer || isIos()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);


  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted" || outcome === "dismissed") dismiss();
    } catch {
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo Sua Marca"
      className="fixed inset-x-0 z-[60] flex justify-center px-3 sm:px-4"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/30 px-4 py-3 flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary shrink-0">
          {showIosHint ? <Share size={18} /> : <Download size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Instalar Sua Marca
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">
            {showIosHint
              ? "Toque em Compartilhar e depois em Adicionar à Tela de Início."
              : "Acesso rápido na sua tela inicial, igual app nativo."}
          </p>
        </div>
        {!showIosHint && (
          <button
            onClick={install}
            className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 px-3 min-h-9 rounded-lg transition-colors shrink-0"
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
