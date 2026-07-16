import { useRef } from "react";
import {
  FileText,
  ShieldCheck,
  FileSignature,
  ClipboardCheck,
  Paperclip,
  Upload,
  Trash2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { inputCls, labelCls } from "./types";

export type DocType = "purchase_contract" | "vehicle_registration" | "insurance_policy" | "inspection_report" | "other";

export type PendingDocument = {
  id: string;
  docType: DocType;
  name: string;
  file: File | null;
  expiresAt: string | null;
  notes: string;
};

type Slot = {
  type: DocType;
  title: string;
  description: string;
  Icon: typeof FileText;
  showExpiry: boolean;
  customName: boolean;
};

const SLOTS: Slot[] = [
  {
    type: "purchase_contract",
    title: "Contrato de compra e venda",
    description: "Comprovante de aquisição do veículo.",
    Icon: FileSignature,
    showExpiry: false,
    customName: false,
  },
  {
    type: "vehicle_registration",
    title: "Documento do veículo",
    description: "CRLV, registration, title. o documento oficial.",
    Icon: FileText,
    showExpiry: true,
    customName: false,
  },
  {
    type: "insurance_policy",
    title: "Apólice de seguro",
    description: "Apólice vigente do veículo.",
    Icon: ShieldCheck,
    showExpiry: true,
    customName: false,
  },
  {
    type: "inspection_report",
    title: "Laudo / Vistoria",
    description: "Laudo cautelar ou vistoria mais recente.",
    Icon: ClipboardCheck,
    showExpiry: true,
    customName: false,
  },
];

type Props = {
  documents: PendingDocument[];
  setDocuments: (next: PendingDocument[]) => void;
};

export default function StepDocuments({ documents, setDocuments }: Props) {
  const update = (id: string, patch: Partial<PendingDocument>) =>
    setDocuments(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const remove = (id: string) => setDocuments(documents.filter((d) => d.id !== id));

  // Garante que cada slot fixo sempre exista (mesmo vazio) — assim a UI fica previsível
  const getOrCreateSlot = (slot: Slot): PendingDocument => {
    const existing = documents.find((d) => d.docType === slot.type);
    if (existing) return existing;
    const created: PendingDocument = {
      id: crypto.randomUUID(),
      docType: slot.type,
      name: slot.title,
      file: null,
      expiresAt: null,
      notes: "",
    };
    setDocuments([...documents, created]);
    return created;
  };

  const others = documents.filter((d) => d.docType === "other");

  const addOther = () => {
    setDocuments([
      ...documents,
      {
        id: crypto.randomUUID(),
        docType: "other",
        name: "",
        file: null,
        expiresAt: null,
        notes: "",
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Documentação do veículo</h3>
        <p className="text-xs text-muted-foreground">
          Anexe os documentos relevantes. Tudo fica armazenado de forma segura e visível apenas pela
          equipe interna. Você pode adicionar/atualizar a qualquer momento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map((slot) => {
          const doc = getOrCreateSlot(slot);
          return (
            <DocSlot
              key={slot.type}
              slot={slot}
              doc={doc}
              onUpdate={(patch) => update(doc.id, patch)}
              onClear={() => update(doc.id, { file: null, expiresAt: null, notes: "" })}
            />
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outros documentos
          </h4>
          <button
            type="button"
            onClick={addOther}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
          >
            <Paperclip size={12} /> Adicionar
          </button>
        </div>

        {others.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Use este espaço para vistorias, recibos, manuais, laudos etc.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {others.map((doc) => (
              <OtherDoc
                key={doc.id}
                doc={doc}
                onUpdate={(patch) => update(doc.id, patch)}
                onRemove={() => remove(doc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocSlot({
  slot,
  doc,
  onUpdate,
  onClear,
}: {
  slot: Slot;
  doc: PendingDocument;
  onUpdate: (patch: Partial<PendingDocument>) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const has = !!doc.file;
  const Icon = slot.Icon;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        has ? "border-primary/50 bg-primary/5" : "border-border/40 bg-card/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0 ${
            has ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{slot.title}</p>
            {has && <CheckCircle2 size={13} className="text-primary shrink-0" />}
          </div>
          <p className="text-[11px] text-muted-foreground">{slot.description}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpdate({ file: f });
          e.target.value = "";
        }}
      />

      {has ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{doc.file!.name}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {formatBytes(doc.file!.size)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="h-7 px-2 rounded inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={onClear}
                className="h-7 w-7 rounded inline-flex items-center justify-center text-destructive hover:bg-destructive/10"
                title="Remover"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {slot.showExpiry && (
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-muted-foreground" />
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Validade
              </label>
              <input
                type="date"
                value={doc.expiresAt ?? ""}
                onChange={(e) => onUpdate({ expiresAt: e.target.value || null })}
                className="flex-1 h-8 px-2 rounded border border-border/60 bg-background text-xs"
              />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 w-full h-10 rounded-lg border border-dashed border-border/60 inline-flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          <Upload size={13} /> Anexar PDF ou imagem
        </button>
      )}
    </div>
  );
}

function OtherDoc({
  doc,
  onUpdate,
  onRemove,
}: {
  doc: PendingDocument;
  onUpdate: (patch: Partial<PendingDocument>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const has = !!doc.file;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
          <Paperclip size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <label className={labelCls}>Nome do documento</label>
          <input
            className={inputCls}
            placeholder="Ex: Laudo de vistoria"
            value={doc.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-destructive hover:bg-destructive/10 shrink-0"
          title="Remover"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpdate({ file: f });
          e.target.value = "";
        }}
      />

      {has ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{doc.file!.name}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {formatBytes(doc.file!.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-7 px-2 rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            Trocar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-10 rounded-lg border border-dashed border-border/60 inline-flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50"
        >
          <Upload size={13} /> Anexar arquivo
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Validade (opcional)
          </label>
          <input
            type="date"
            value={doc.expiresAt ?? ""}
            onChange={(e) => onUpdate({ expiresAt: e.target.value || null })}
            className="w-full h-9 mt-1 px-2 rounded border border-border/60 bg-background text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Notas
          </label>
          <input
            value={doc.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Opcional"
            className="w-full h-9 mt-1 px-2 rounded border border-border/60 bg-background text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
