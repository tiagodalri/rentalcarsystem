import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";

const PREFIX = "zeus:draft:";

/**
 * Persiste rascunho de formulário no localStorage automaticamente.
 * - Restaura o draft uma única vez quando `enabled` vira true.
 * - Salva (debounced) sempre que `value` muda enquanto enabled=true.
 * - Use `clearFormDraft(key)` ao concluir/cancelar para limpar.
 */
export function useFormDraft<T extends Record<string, any>>(
  key: string,
  value: T,
  setValue: (v: T) => void,
  enabled: boolean,
  options?: { isEmpty?: (v: T) => boolean; debounceMs?: number }
) {
  const restoredRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = options?.debounceMs ?? 400;

  // Restaurar
  useEffect(() => {
    if (!enabled) {
      restoredRef.current = false;
      return;
    }
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const empty = options?.isEmpty ? options.isEmpty(value) : isShallowEmpty(value);
      if (empty && parsed && typeof parsed === "object") {
        setValue({ ...value, ...parsed });
        toast({
          title: "Rascunho restaurado",
          description: "Recuperamos o que você havia preenchido antes.",
        });
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
      try {
        const empty = options?.isEmpty ? options.isEmpty(value) : isShallowEmpty(value);
        if (empty) {
          localStorage.removeItem(PREFIX + key);
        } else {
          localStorage.setItem(PREFIX + key, JSON.stringify(value));
        }
      } catch {
        /* ignore quota / serialization */
      }
    }, debounce);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function isShallowEmpty(v: any): boolean {
  if (!v || typeof v !== "object") return true;
  return Object.values(v).every(
    (x) => x === "" || x === null || x === undefined || (Array.isArray(x) && x.length === 0)
  );
}
