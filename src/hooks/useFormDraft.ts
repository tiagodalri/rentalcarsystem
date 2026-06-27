import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";

const PREFIX = "zeus:draft:";

/**
 * Persiste rascunho de formulário no localStorage automaticamente.
 * - Restaura o draft uma única vez quando `enabled` vira true.
 * - Salva (debounced) sempre que `value` muda enquanto enabled=true.
 * - Use `clearFormDraft(key)` ao concluir/cancelar para limpar.
 */
export function useFormDraft<T extends object>(
  key: string,
  value: T,
  setValue: (v: T) => void,
  enabled: boolean,
  options?: { isEmpty?: (v: T) => boolean; debounceMs?: number; silentRestore?: boolean; restoreMode?: "when-empty" | "always" }
) {
  const restoredRef = useRef(false);
  const restoredKeyRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);
  const latestKeyRef = useRef(key);
  const latestEnabledRef = useRef(enabled);
  const latestOptionsRef = useRef(options);
  const debounce = options?.debounceMs ?? 400;

  function persist(draftKey: string, draftValue: T) {
    try {
      const opts = latestOptionsRef.current;
      const empty = opts?.isEmpty ? opts.isEmpty(draftValue) : isShallowEmpty(draftValue);
      if (empty) {
        localStorage.removeItem(PREFIX + draftKey);
      } else {
        localStorage.setItem(PREFIX + draftKey, JSON.stringify(draftValue));
      }
    } catch {
      /* ignore quota / serialization */
    }
  }

  useEffect(() => {
    latestValueRef.current = value;
    latestKeyRef.current = key;
    latestEnabledRef.current = enabled;
    latestOptionsRef.current = options;
  }, [value, key, enabled, options]);

  // Restaurar
  useEffect(() => {
    if (!enabled) {
      restoredRef.current = false;
      restoredKeyRef.current = null;
      return;
    }
    if (restoredKeyRef.current !== key) {
      restoredRef.current = false;
      restoredKeyRef.current = key;
    }
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const parsedEmpty = options?.isEmpty ? options.isEmpty(parsed as T) : isShallowEmpty(parsed);
      if (parsedEmpty) {
        localStorage.removeItem(PREFIX + key);
        return;
      }
      const empty = options?.isEmpty ? options.isEmpty(value) : isShallowEmpty(value);
      const shouldRestore = options?.restoreMode === "always" || empty;
      if (shouldRestore) {
        const merged = { ...value, ...(parsed as Partial<T>) } as T;
        latestValueRef.current = merged;
        setValue(merged);
        if (!options?.silentRestore) {
          toast({
            title: "Rascunho restaurado",
            description: "Recuperamos o que você havia preenchido antes.",
          });
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // Salvar (debounced)
  useEffect(() => {
    if (!enabled || !restoredRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(key, value);
    }, debounce);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);

  // iOS/PWA pode congelar a aba antes do debounce terminar. Flush imediato.
  useEffect(() => {
    const flush = () => {
      if (!latestEnabledRef.current || !restoredRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      persist(latestKeyRef.current, latestValueRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function isShallowEmpty(v: unknown): boolean {
  if (!v || typeof v !== "object") return true;
  return Object.values(v).every(
    (x) => x === "" || x === null || x === undefined || (Array.isArray(x) && x.length === 0)
  );
}
