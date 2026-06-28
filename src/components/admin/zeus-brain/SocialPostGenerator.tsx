import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Wand2, Download, Copy, Loader2, Image as ImageIcon, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Vehicle = {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  image_url: string | null;
  photos: any;
  status: string | null;
};

type Format = "feed" | "story";
type Tone = "luxo" | "aventura" | "familia" | "promocao" | "lancamento";

const TONES: { v: Tone; label: string; hint: string }[] = [
  { v: "luxo", label: "Luxo", hint: "exclusivo, premium, status" },
  { v: "aventura", label: "Aventura", hint: "viagem, liberdade, Orlando" },
  { v: "familia", label: "Familia", hint: "memorias, conforto, seguranca" },
  { v: "promocao", label: "Oportunidade", hint: "oferta sem apelar" },
  { v: "lancamento", label: "Lancamento", hint: "novidade, primeira vez" },
];

type Result = {
  imageBase64: string;
  phrase: string;
  caption: string;
  hashtags: string[];
  format: Format;
};

export default function SocialPostGenerator({ onBack }: { onBack: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [format, setFormat] = useState<Format>("feed");
  const [tone, setTone] = useState<Tone>("luxo");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, name, brand, model, image_url, photos, status")
        .order("name");
      const list = (data as Vehicle[]) || [];
      setVehicles(list);
      if (list.length && !vehicleId) setVehicleId(list[0].id);
    })();
  }, []);

  const selected = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);

  const photoUrl = useMemo(() => {
    if (!selected) return null;
    if (selected.image_url) return selected.image_url;
    const arr = Array.isArray(selected.photos) ? selected.photos : [];
    const first = arr[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return first.url || first.src || null;
    return null;
  }, [selected]);

  async function generate() {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-generate-post", {
        body: {
          vehicleName: selected.name || `${selected.brand || ""} ${selected.model || ""}`.trim(),
          vehicleBrand: selected.brand,
          vehiclePhotoUrl: photoUrl,
          format,
          tone,
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as Result);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || e);
      if (msg.includes("429")) toast.error("Limite de uso atingido. Tente novamente em instantes.");
      else if (msg.includes("402")) toast.error("Creditos esgotados. Adicione mais creditos para continuar.");
      else toast.error("Nao foi possivel gerar o post. " + msg);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.imageBase64}`;
    const safeName = (selected?.name || "post").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `zeus-${safeName}-${result.format}.png`;
    a.click();
  }

  function copyCaption() {
    if (!result) return;
    const text = `${result.caption}\n\n${result.hashtags.join(" ")}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Legenda copiada."));
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.22em] font-semibold mb-4"
        style={{ color: "rgba(13,29,46,0.62)" }}
      >
        <ArrowLeft size={14} /> Voltar ao Marketing Studio
      </button>

      <div className="text-center mb-6">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase font-semibold tracking-[0.32em]"
          style={{ background: "rgba(13,29,46,0.04)", border: "1px solid rgba(13,29,46,0.10)", color: "rgba(13,29,46,0.62)" }}
        >
          <ImageIcon size={11} style={{ color: "#9a7a3a" }} />
          Posts para redes sociais
        </div>
        <h1
          className="mt-2 text-[24px] sm:text-[30px] font-light tracking-[-0.01em]"
          style={{ color: "#0d1d2e", fontFamily: "'Cormorant Garamond', 'Inter', serif" }}
        >
          Crie uma arte com a marca Zeus em segundos
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 sm:gap-6">
        {/* Form */}
        <div
          className="rounded-[20px] p-4 sm:p-6"
          style={{ background: "#fbf7ee", border: "1px solid rgba(13,29,46,0.10)" }}
        >
          <Label>Carro</Label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full mt-1.5 px-3 py-2.5 rounded-lg text-[14px] bg-white"
            style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 44 }}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || `${v.brand || ""} ${v.model || ""}`.trim()}
              </option>
            ))}
          </select>
          {!photoUrl && (
            <p className="text-[11px] mt-1.5" style={{ color: "#a05a2c" }}>
              Este carro nao tem foto cadastrada. A arte sera gerada apenas com a marca.
            </p>
          )}

          <div className="mt-5">
            <Label>Formato</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <FormatPill active={format === "feed"} onClick={() => setFormat("feed")} icon={<ImageIcon size={14} />} label="Feed" sub="1:1" />
              <FormatPill active={format === "story"} onClick={() => setFormat("story")} icon={<Smartphone size={14} />} label="Story" sub="9:16" />
            </div>
          </div>

          <div className="mt-5">
            <Label>Tom da mensagem</Label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTone(t.v)}
                  className="text-left rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: tone === t.v ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
                    color: tone === t.v ? "#d6bf86" : "#0d1d2e",
                    border: "1px solid " + (tone === t.v ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
                    minHeight: 56,
                  }}
                >
                  <div className="text-[13px] font-semibold">{t.label}</div>
                  <div className="text-[10.5px] opacity-75 leading-tight mt-0.5">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <Label>Direcionamento extra (opcional)</Label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              placeholder="Ex: destaque que esta com diaria promocional este fim de semana"
              className="w-full mt-1.5 px-3 py-2.5 rounded-lg text-[13px] bg-white resize-none"
              style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e" }}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || !vehicleId}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[14px] font-semibold tracking-wide transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(180deg,#14283d,#0d1d2e)",
              color: "#d6bf86",
              border: "1px solid rgba(214,191,134,0.40)",
              minHeight: 48,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Gerando arte..." : "Gerar com IA"}
          </button>
          <p className="text-[10.5px] text-center mt-2" style={{ color: "rgba(13,29,46,0.5)" }}>
            A geracao leva de 15 a 40 segundos. Cada gera uma arte unica.
          </p>
        </div>

        {/* Preview */}
        <div
          className="rounded-[20px] p-4 sm:p-6"
          style={{ background: "#0d1d2e", border: "1px solid rgba(214,191,134,0.20)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.32em] font-semibold" style={{ color: "#d6bf86" }}>
              Pre-visualizacao
            </span>
            {result && (
              <div className="flex gap-2">
                <IconBtn onClick={copyCaption} title="Copiar legenda"><Copy size={14} /></IconBtn>
                <IconBtn onClick={download} title="Baixar imagem"><Download size={14} /></IconBtn>
              </div>
            )}
          </div>

          <div
            className="relative w-full rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              aspectRatio: format === "feed" ? "1 / 1" : "9 / 16",
              maxHeight: format === "story" ? 640 : undefined,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(214,191,134,0.15)",
            }}
          >
            {loading && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.85)" }}>
                <Loader2 size={28} className="animate-spin mx-auto mb-3" />
                <div className="text-[12px] tracking-wide">A inteligencia esta compondo a arte...</div>
              </div>
            )}
            {!loading && !result && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.55)" }}>
                <ImageIcon size={28} className="mx-auto mb-3" />
                <div className="text-[12px] tracking-wide">A arte gerada aparece aqui.</div>
              </div>
            )}
            {!loading && result && (
              <img
                src={`data:image/png;base64,${result.imageBase64}`}
                alt={result.phrase}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {result && (
            <div className="mt-4 space-y-3">
              <div>
                <span className="text-[9px] uppercase tracking-[0.32em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Frase
                </span>
                <p className="text-[15px] mt-1" style={{ color: "#fbf7ee", fontFamily: "'Cormorant Garamond', serif" }}>
                  {result.phrase}
                </p>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.32em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Legenda
                </span>
                <p className="text-[12.5px] mt-1 whitespace-pre-line" style={{ color: "rgba(251,247,238,0.85)" }}>
                  {result.caption}
                </p>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.32em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Hashtags
                </span>
                <p className="text-[12px] mt-1" style={{ color: "#d6bf86" }}>
                  {result.hashtags.join(" ")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-[0.32em] font-semibold" style={{ color: "rgba(13,29,46,0.55)" }}>
      {children}
    </label>
  );
}

function FormatPill({
  active, onClick, icon, label, sub,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-2.5 text-left transition-all"
      style={{
        background: active ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
        color: active ? "#d6bf86" : "#0d1d2e",
        border: "1px solid " + (active ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
        minHeight: 52,
      }}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold">{icon} {label}</div>
      <div className="text-[10.5px] opacity-75 mt-0.5">{sub}</div>
    </button>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-8 w-8 rounded-full inline-flex items-center justify-center transition-all"
      style={{ background: "rgba(214,191,134,0.12)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.30)" }}
    >
      {children}
    </button>
  );
}
