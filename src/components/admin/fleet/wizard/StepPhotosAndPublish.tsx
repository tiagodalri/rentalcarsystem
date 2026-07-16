import { useState } from "react";
import {
  Upload,
  Star,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  ClipboardList,
  ArrowLeftRight,
  Loader2,
  Info,
  Camera,
} from "lucide-react";
import PublicCardPreview from "../PublicCardPreview";
import { WizardForm } from "./types";
import { stampPhoto } from "./stampPhoto";

export type PhotoKind = "showcase" | "registry";

export type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  kind: PhotoKind;
  stamped?: boolean; // registry-only: indica se já recebeu o carimbo
};

type Props = {
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
  photos: PendingPhoto[];
  setPhotos: (next: PendingPhoto[]) => void;
  coverId: string | null;
  setCoverId: (id: string | null) => void;
};

export default function StepPhotosAndPublish({
  form,
  set,
  photos,
  setPhotos,
  coverId,
  setCoverId,
}: Props) {
  // Padrão: começa em "Registro interno" (documenta o carro primeiro, depois cuida do anúncio)
  const [tab, setTab] = useState<PhotoKind>("registry");
  const [busy, setBusy] = useState(false);

  const showcase = photos.filter((p) => p.kind === "showcase");
  const registry = photos.filter((p) => p.kind === "registry");
  const visible = tab === "showcase" ? showcase : registry;

  const cover =
    showcase.find((p) => p.id === coverId) ?? showcase[0] ?? null;

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const arr = Array.from(files);
      const prepared: PendingPhoto[] = [];
      for (const f of arr) {
        if (tab === "registry") {
          const stamped = await stampPhoto(f, form.current_odometer ?? form.initial_odometer ?? null);
          prepared.push({
            id: crypto.randomUUID(),
            file: stamped,
            previewUrl: URL.createObjectURL(stamped),
            kind: "registry",
            stamped: true,
          });
        } else {
          prepared.push({
            id: crypto.randomUUID(),
            file: f,
            previewUrl: URL.createObjectURL(f),
            kind: "showcase",
          });
        }
      }
      const merged = [...photos, ...prepared];
      setPhotos(merged);
      if (!coverId) {
        const firstShow = merged.find((p) => p.kind === "showcase");
        if (firstShow) setCoverId(firstShow.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    if (coverId === id) {
      const nextCover = next.find((p) => p.kind === "showcase");
      setCoverId(nextCover?.id ?? null);
    }
  };

  const moveTo = async (id: string, dest: PhotoKind) => {
    const target = photos.find((p) => p.id === id);
    if (!target || target.kind === dest) return;
    setBusy(true);
    try {
      let nextPhoto: PendingPhoto = { ...target, kind: dest };
      if (dest === "registry" && !target.stamped) {
        const stamped = await stampPhoto(
          target.file,
          form.current_odometer ?? form.initial_odometer ?? null,
        );
        URL.revokeObjectURL(target.previewUrl);
        nextPhoto = {
          ...target,
          file: stamped,
          previewUrl: URL.createObjectURL(stamped),
          kind: "registry",
          stamped: true,
        };
      }
      const next = photos.map((p) => (p.id === id ? nextPhoto : p));
      setPhotos(next);
      if (dest === "registry" && coverId === id) {
        const nextCover = next.find((p) => p.kind === "showcase");
        setCoverId(nextCover?.id ?? null);
      }
      if (dest === "showcase" && !coverId) setCoverId(id);
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = () => set({ published: !form.published });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        {/* TABS */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border/50 bg-muted/30">
          <TabButton
            active={tab === "registry"}
            onClick={() => setTab("registry")}
            icon={<ClipboardList size={14} />}
            label="Registro interno"
            count={registry.length}
          />
          <TabButton
            active={tab === "showcase"}
            onClick={() => setTab("showcase")}
            icon={<Globe size={14} />}
            label="Vitrine pública"
            count={showcase.length}
          />
        </div>

        {/* HINT contextual da aba */}
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/40 rounded-lg px-3 py-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          {tab === "registry" ? (
            <p>
              Fotos completas do estado atual do veículo. 4 lados, painel, hodômetro, pneus e
              eventuais danos. <strong>Não aparecem no site público.</strong> Cada foto recebe
              automaticamente um carimbo com data, hora e quilometragem.
            </p>
          ) : (
            <p>
              Fotos curadas que vão aparecer no site para os clientes. Recomendado: mínimo de
              <strong> 5 fotos </strong>em paisagem, boa iluminação, sem placa visível. A 1ª da
              lista é a capa do anúncio.
            </p>
          )}
        </div>

        {/* UPLOADER */}
        <div className="space-y-2">
          <label
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors min-h-[140px] px-4 py-6 text-center cursor-pointer ${
              busy
                ? "border-border/60 bg-muted/30 cursor-wait"
                : "border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-primary/60"
            }`}
          >
            {busy ? (
              <Loader2 size={24} className="text-muted-foreground animate-spin" />
            ) : (
              <Upload size={24} className="text-muted-foreground" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {busy ? "Processando…" : "Arraste fotos aqui ou clique para escolher"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Envia para a aba <strong>{tab === "registry" ? "Registro interno" : "Vitrine pública"}</strong>.
              JPG, PNG ou WEBP. múltiplos arquivos.
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {/* Botão dedicado de câmera (essencial em mobile/PWA) */}
          <label
            className={`sm:hidden flex items-center justify-center gap-2 h-11 rounded-xl border border-border/60 bg-card text-sm font-semibold text-foreground active:scale-[0.98] transition-transform ${
              busy ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Camera size={16} className="text-primary" />
            Tirar foto com a câmera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* GRID DA ABA ATIVA */}
        {visible.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visible.map((p) => {
              const isCover = tab === "showcase" && cover?.id === p.id;
              const otherKind: PhotoKind = tab === "showcase" ? "registry" : "showcase";
              return (
                <div
                  key={p.id}
                  className={`relative rounded-xl overflow-hidden border bg-card group ${
                    isCover ? "border-primary ring-2 ring-primary/30" : "border-border/40"
                  }`}
                >
                  <div className="aspect-square bg-muted/30">
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Badge de capa (apenas vitrine) */}
                  {isCover && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                      <Star size={9} /> CAPA
                    </span>
                  )}

                  {/* Ações */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent">
                    {tab === "showcase" ? (
                      <button
                        type="button"
                        onClick={() => setCoverId(p.id)}
                        disabled={isCover}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded ${
                          isCover
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/90 text-foreground hover:bg-background"
                        }`}
                      >
                        <Star size={10} /> {isCover ? "Capa" : "Definir capa"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-background/90 text-foreground">
                        <ClipboardList size={10} /> Registro
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveTo(p.id, otherKind)}
                        className="h-7 px-2 rounded inline-flex items-center gap-1 bg-background/90 text-foreground hover:bg-background text-[10px] font-semibold"
                        title={
                          otherKind === "showcase"
                            ? "Mover para Vitrine pública"
                            : "Mover para Registro interno"
                        }
                      >
                        <ArrowLeftRight size={11} />
                        <span className="hidden sm:inline">
                          {otherKind === "showcase" ? "Vitrine" : "Registro"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="h-7 w-7 rounded inline-flex items-center justify-center bg-background/90 text-destructive hover:bg-background"
                        title="Remover"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma foto nesta aba ainda.
          </p>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        <PublicCardPreview
          name={form.name || `${form.brand} ${form.model} ${form.version}`.trim()}
          category={form.category}
          passengers={form.passengers}
          bags={form.bags}
          transmission={form.transmission}
          fuel={form.fuel}
          daily_price_usd={form.daily_price_usd || 0}
          coverUrl={cover?.previewUrl ?? ""}
          published={form.published}
        />

        <button
          type="button"
          onClick={togglePublished}
          className={`w-full h-11 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
            form.published
              ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border/60 bg-background text-foreground hover:bg-accent"
          }`}
        >
          {form.published ? (
            <>
              <Eye size={14} /> Será publicado no site público
            </>
          ) : (
            <>
              <EyeOff size={14} /> Manter oculto por enquanto
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Você pode publicar agora ou ativar mais tarde na listagem da Frota.
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-9 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span
        className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] tabular-nums font-medium ${
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
