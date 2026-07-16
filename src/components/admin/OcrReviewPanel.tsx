import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles, X, AlertTriangle } from "lucide-react";
import type { OcrFields } from "@/hooks/useDocumentOcr";

const LABELS: Record<keyof OcrFields, string> = {
  driver_license: "Número da CNH / Driver License",
  driver_license_expiry: "Validade da CNH",
  full_name: "Nome completo",
  document_number: "Documento (CPF / Passport / ID)",
  date_of_birth: "Data de nascimento",
};

type Props = {
  /** OCR extracted values */
  extracted: OcrFields;
  /** Current form values (used to detect conflicts) */
  current: Partial<Record<keyof OcrFields, string>>;
  /** Subset of fields this panel should offer */
  fields?: Array<keyof OcrFields>;
  /** Apply selected values to the form */
  onApply: (values: Partial<Record<keyof OcrFields, string>>) => void;
  /** Dismiss the panel */
  onDismiss: () => void;
};

/**
 * Inline review panel for OCR extraction.
 * - Fields where target is empty: pre-checked (will autofill on apply).
 * - Fields where target already has a different value: NOT pre-checked (user must opt-in to overwrite).
 */
export default function OcrReviewPanel({ extracted, current, fields, onApply, onDismiss }: Props) {
  const items = useMemo(() => {
    const keys = (fields ?? (Object.keys(LABELS) as Array<keyof OcrFields>))
      .filter((k) => {
        const v = extracted[k];
        return typeof v === "string" && v.trim().length > 0;
      });
    return keys.map((k) => {
      const newVal = (extracted[k] || "").toString().trim();
      const curVal = (current[k] || "").toString().trim();
      const isEmpty = !curVal;
      const isSame = curVal && curVal === newVal;
      const isConflict = !!curVal && curVal !== newVal;
      return { key: k, newVal, curVal, isEmpty, isSame, isConflict };
    });
  }, [extracted, current, fields]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const it of items) {
      // Default: select if empty target or identical (no-op). Conflicts default OFF.
      init[it.key] = it.isEmpty;
    }
    setSelected(init);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground flex items-center justify-between">
        <span>Nenhum dado pôde ser extraído da imagem. Preencha manualmente.</span>
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    );
  }

  const apply = () => {
    const out: Partial<Record<keyof OcrFields, string>> = {};
    for (const it of items) {
      if (selected[it.key]) out[it.key] = it.newVal;
    }
    onApply(out);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
          <Sparkles size={12} /> Dados lidos do documento. revise e confirme
        </div>
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground" title="Descartar">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map((it) => (
          <label
            key={it.key}
            className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
              selected[it.key]
                ? "border-primary/40 bg-background"
                : "border-border/40 bg-background/40"
            }`}
          >
            <input
              type="checkbox"
              checked={!!selected[it.key]}
              onChange={(e) => setSelected((s) => ({ ...s, [it.key]: e.target.checked }))}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {LABELS[it.key]}
              </p>
              <p className="text-xs text-foreground font-medium break-all">{it.newVal}</p>
              {it.isConflict && (
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Substituirá: <span className="font-mono">{it.curVal}</span>
                </p>
              )}
              {it.isSame && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Já está preenchido. igual ao extraído.</p>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={apply}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Check size={12} /> Aplicar selecionados
        </button>
      </div>
    </div>
  );
}
