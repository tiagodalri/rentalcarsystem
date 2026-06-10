import { useEffect, useState } from "react";
import { Upload, Star, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PublicCardPreview from "../PublicCardPreview";
import { WizardForm } from "./types";

type Props = {
  vehicleId: string;
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
};

export default function StepPhotosAndPublish({ vehicleId, form, set }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [cover, setCover] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("photos,image_url")
        .eq("id", vehicleId)
        .single();
      setPhotos((data?.photos as string[]) || []);
      setCover(data?.image_url || ((data?.photos as string[])?.[0] ?? ""));
    })();
  }, [vehicleId]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${vehicleId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || undefined,
        });
        if (error) {
          toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
          continue;
        }
        const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      if (uploaded.length) {
        const next = [...photos, ...uploaded];
        const nextCover = cover || next[0];
        await supabase.from("vehicles").update({ photos: next, image_url: nextCover }).eq("id", vehicleId);
        setPhotos(next);
        setCover(nextCover);
      }
    } finally {
      setUploading(false);
    }
  };

  const setAsCover = async (url: string) => {
    setCover(url);
    await supabase.from("vehicles").update({ image_url: url }).eq("id", vehicleId);
    toast({ title: "Capa atualizada" });
  };

  const remove = async (url: string) => {
    const next = photos.filter((p) => p !== url);
    const nextCover = cover === url ? next[0] || "" : cover;
    setPhotos(next);
    setCover(nextCover);
    await supabase.from("vehicles").update({ photos: next, image_url: nextCover || null }).eq("id", vehicleId);
    // try to remove file from storage (best effort)
    try {
      const match = url.match(/vehicle-photos\/(.+)$/);
      if (match?.[1]) await supabase.storage.from("vehicle-photos").remove([match[1]]);
    } catch {}
  };

  const togglePublished = async () => {
    const next = !form.published;
    set({ published: next });
    await supabase.from("vehicles").update({ published: next }).eq("id", vehicleId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-4">
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors min-h-[160px] px-4 py-6 text-center cursor-pointer ${
            uploading ? "border-primary/60 bg-primary/5 cursor-wait" : "border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-primary/60"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={26} className="text-primary animate-spin" />
              <p className="text-sm font-semibold text-foreground">Enviando fotos…</p>
              <p className="text-[11px] text-muted-foreground">Aguarde, não feche a página</p>
            </>
          ) : (
            <>
              <Upload size={26} className="text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Arraste fotos aqui ou clique</p>
              <p className="text-[11px] text-muted-foreground">JPG, PNG ou WEBP — múltiplos arquivos</p>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((url) => {
              const isCover = cover === url;
              return (
                <div
                  key={url}
                  className={`relative rounded-xl overflow-hidden border bg-card ${
                    isCover ? "border-primary ring-2 ring-primary/30" : "border-border/40"
                  }`}
                >
                  <div className="aspect-square bg-muted/30">
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
                    <button
                      onClick={() => setAsCover(url)}
                      disabled={isCover}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded ${
                        isCover ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground hover:bg-background"
                      }`}
                    >
                      <Star size={10} /> {isCover ? "Capa" : "Definir capa"}
                    </button>
                    <button
                      onClick={() => remove(url)}
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
          coverUrl={cover}
          published={form.published}
        />

        <button
          onClick={togglePublished}
          className={`w-full h-11 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
            form.published
              ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border/60 bg-background text-foreground hover:bg-accent"
          }`}
        >
          {form.published ? <><Eye size={14} /> Publicado no site público</> : <><EyeOff size={14} /> Publicar no site público</>}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">
          Você pode publicar agora ou deixar oculto e ativar mais tarde na listagem da Frota.
        </p>
      </div>
    </div>
  );
}
