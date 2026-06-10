import { Upload, Star, Trash2, Eye, EyeOff } from "lucide-react";
import PublicCardPreview from "../PublicCardPreview";
import { WizardForm } from "./types";

export type PendingPhoto = { id: string; file: File; previewUrl: string };

type Props = {
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
  photos: PendingPhoto[];
  setPhotos: (next: PendingPhoto[]) => void;
  coverId: string | null;
  setCoverId: (id: string | null) => void;
};

export default function StepPhotosAndPublish({ form, set, photos, setPhotos, coverId, setCoverId }: Props) {
  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: PendingPhoto[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const merged = [...photos, ...next];
    setPhotos(merged);
    if (!coverId && merged.length) setCoverId(merged[0].id);
  };

  const remove = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    if (coverId === id) setCoverId(next[0]?.id ?? null);
  };

  const cover = photos.find((p) => p.id === coverId) ?? photos[0];
  const togglePublished = () => set({ published: !form.published });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-primary/60 transition-colors min-h-[160px] px-4 py-6 text-center cursor-pointer">
          <Upload size={26} className="text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Arraste fotos aqui ou clique</p>
          <p className="text-[11px] text-muted-foreground">JPG, PNG ou WEBP — múltiplos arquivos. Envio acontece ao concluir.</p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => {
              const isCover = (cover?.id ?? "") === p.id;
              return (
                <div
                  key={p.id}
                  className={`relative rounded-xl overflow-hidden border bg-card ${
                    isCover ? "border-primary ring-2 ring-primary/30" : "border-border/40"
                  }`}
                >
                  <div className="aspect-square bg-muted/30">
                    <img src={p.previewUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
                    <button
                      type="button"
                      onClick={() => setCoverId(p.id)}
                      disabled={isCover}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded ${
                        isCover ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground hover:bg-background"
                      }`}
                    >
                      <Star size={10} /> {isCover ? "Capa" : "Definir capa"}
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
              );
            })}
          </div>
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
          {form.published ? <><Eye size={14} /> Será publicado no site público</> : <><EyeOff size={14} /> Manter oculto por enquanto</>}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Você pode publicar agora ou ativar mais tarde na listagem da Frota.
        </p>
      </div>
    </div>
  );
}
