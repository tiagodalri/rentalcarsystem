import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Wand2, Download, Copy, Loader2, Image as ImageIcon, Smartphone, Tag, MessageSquare, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectSeasonalTheme } from "@/lib/zeusBrain/seasonalTheme";

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
type Tone = "luxo" | "aventura" | "familia" | "promocao" | "lancamento" | "sazonal";
type Mode = "promo" | "free" | "reference";

const SEASONAL_NOW = detectSeasonalTheme();

const TONES: { v: Tone; label: string; hint: string }[] = [
  { v: "luxo", label: "Luxo", hint: "exclusivo, premium, status" },
  { v: "aventura", label: "Aventura", hint: "viagem, liberdade, Orlando" },
  { v: "familia", label: "Familia", hint: "memorias, conforto, seguranca" },
  { v: "promocao", label: "Oportunidade", hint: "oferta sem apelar" },
  { v: "lancamento", label: "Lancamento", hint: "novidade, primeira vez" },
  { v: "sazonal", label: `Sazonal · ${SEASONAL_NOW.label}`, hint: "tema da data atual, automatico" },
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
  const [mode, setMode] = useState<Mode>("promo");
  const [customPrompt, setCustomPrompt] = useState("");

  // Promo fields
  const [priceDaily, setPriceDaily] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [promoHook, setPromoHook] = useState("");

  // Reference image
  const [refDataUrl, setRefDataUrl] = useState<string | null>(null);
  const [refName, setRefName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function urlToDataUrl(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function onPickReference(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem grande demais. Maximo 8MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setRefDataUrl(r.result as string);
      setRefName(file.name);
    };
    r.readAsDataURL(file);
  }

  async function generate() {
    if (!selected) return;
    if (mode === "promo" && (!priceDaily || !dateStart || !dateEnd)) {
      toast.error("Preencha valor da diaria e periodo da promocao.");
      return;
    }
    if (mode === "reference" && !refDataUrl) {
      toast.error("Anexe uma imagem de referencia.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const logoDataUrl = await urlToDataUrl(`${window.location.origin}/zeus-logo-full.png`);
      const { data, error } = await supabase.functions.invoke("marketing-generate-post", {
        body: {
          vehicleName: selected.name || `${selected.brand || ""} ${selected.model || ""}`.trim(),
          vehicleBrand: selected.brand,
          vehiclePhotoUrl: photoUrl,
          logoDataUrl,
          format,
          tone,
          mode,
          customPrompt: customPrompt.trim() || undefined,
          seasonalTheme: tone === "sazonal" ? detectSeasonalTheme() : undefined,
          promo: mode === "promo" ? {
            priceDaily: priceDaily.trim(),
            dateStart,
            dateEnd,
            hook: promoHook.trim() || undefined,
          } : undefined,
          referenceImageDataUrl: mode === "reference" ? refDataUrl : undefined,
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
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 lg:px-6 pt-2 sm:pt-4 pb-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] font-semibold mb-2"
        style={{ color: "rgba(13,29,46,0.62)" }}
      >
        <ArrowLeft size={12} /> Voltar ao Marketing Studio
      </button>

      <div className="text-center mb-4">
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase font-semibold tracking-[0.28em]"
          style={{ background: "rgba(13,29,46,0.04)", border: "1px solid rgba(13,29,46,0.10)", color: "rgba(13,29,46,0.62)" }}
        >
          <ImageIcon size={10} style={{ color: "#9a7a3a" }} />
          Posts para redes sociais
        </div>
        <h1
          className="mt-1.5 text-[20px] sm:text-[26px] font-light tracking-[-0.01em]"
          style={{ color: "#0d1d2e", fontFamily: "'Cormorant Garamond', 'Inter', serif" }}
        >
          Crie uma arte com a marca Zeus em segundos
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 sm:gap-4">
        {/* Form */}
        <div
          className="rounded-[14px] p-3 sm:p-4"
          style={{ background: "#fbf7ee", border: "1px solid rgba(13,29,46,0.10)" }}
        >
          {/* Mode selector */}
          <Label>Tipo de arte</Label>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <ModePill active={mode === "promo"} onClick={() => setMode("promo")} icon={<Tag size={12} />} label="Promocao" sub="carro + data + valor" />
            <ModePill active={mode === "free"} onClick={() => setMode("free")} icon={<MessageSquare size={12} />} label="Livre" sub="so com instrucao" />
            <ModePill active={mode === "reference"} onClick={() => setMode("reference")} icon={<ImageIcon size={12} />} label="Com referencia" sub="anexar arte base" />
          </div>

          <div className="mt-3">
            <Label>Carro</Label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full mt-1 px-2.5 py-2 rounded-lg text-[13px] bg-white"
              style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 40 }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || `${v.brand || ""} ${v.model || ""}`.trim()}
                </option>
              ))}
            </select>
            {!photoUrl && (
              <p className="text-[10px] mt-1" style={{ color: "#a05a2c" }}>
                Este carro nao tem foto cadastrada. A arte sera gerada apenas com a marca.
              </p>
            )}
          </div>

          {/* Promo fields */}
          {mode === "promo" && (
            <div className="mt-3 rounded-lg p-2.5" style={{ background: "white", border: "1px dashed rgba(154,122,58,0.45)" }}>
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold mb-1.5" style={{ color: "#9a7a3a" }}>
                Detalhes da promocao
              </div>
              <Label>Valor da diaria (USD)</Label>
              <input
                type="text"
                inputMode="decimal"
                value={priceDaily}
                onChange={(e) => setPriceDaily(e.target.value)}
                placeholder="Ex: 129"
                className="w-full mt-1 px-2.5 py-2 rounded-lg text-[13px] bg-white"
                style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 40 }}
              />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div>
                  <Label>De</Label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full mt-1 px-2.5 py-2 rounded-lg text-[12px] bg-white"
                    style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 40 }}
                  />
                </div>
                <div>
                  <Label>Ate</Label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full mt-1 px-2.5 py-2 rounded-lg text-[12px] bg-white"
                    style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 40 }}
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label>Gancho da oferta (opcional)</Label>
                <input
                  type="text"
                  value={promoHook}
                  onChange={(e) => setPromoHook(e.target.value)}
                  placeholder="Ex: Fim de semana especial em Orlando"
                  className="w-full mt-1 px-2.5 py-2 rounded-lg text-[12px] bg-white"
                  style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e", minHeight: 40 }}
                />
              </div>
            </div>
          )}

          {/* Reference upload */}
          {mode === "reference" && (
            <div className="mt-3">
              <Label>Imagem de referencia</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickReference(f);
                }}
              />
              {!refDataUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-1 rounded-lg px-3 py-4 text-center transition-all"
                  style={{ background: "white", border: "1.5px dashed rgba(13,29,46,0.30)", color: "#0d1d2e", minHeight: 80 }}
                >
                  <Upload size={16} className="mx-auto mb-1" style={{ color: "#9a7a3a" }} />
                  <div className="text-[12px] font-semibold">Anexar imagem inspiracao</div>
                  <div className="text-[10px] opacity-65 mt-0.5">PNG, JPG ou WEBP ate 8MB</div>
                </button>
              ) : (
                <div className="mt-1 rounded-lg overflow-hidden relative" style={{ border: "1px solid rgba(13,29,46,0.18)" }}>
                  <img src={refDataUrl} alt="referencia" className="w-full max-h-[140px] object-contain bg-white" />
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-white">
                    <span className="text-[10px] truncate" style={{ color: "rgba(13,29,46,0.65)" }}>{refName}</span>
                    <button
                      onClick={() => { setRefDataUrl(null); setRefName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="h-6 w-6 rounded-full inline-flex items-center justify-center"
                      style={{ background: "rgba(13,29,46,0.06)", color: "#0d1d2e" }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[10px] mt-1" style={{ color: "rgba(13,29,46,0.55)" }}>
                A IA usa essa arte como inspiracao de estilo, composicao e paleta. O carro e a marca Zeus continuam sendo os herois.
              </p>
            </div>
          )}

          <div className="mt-3">
            <Label>Formato</Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <FormatPill active={format === "feed"} onClick={() => setFormat("feed")} icon={<ImageIcon size={12} />} label="Feed" sub="1:1" />
              <FormatPill active={format === "story"} onClick={() => setFormat("story")} icon={<Smartphone size={12} />} label="Story" sub="9:16" />
            </div>
          </div>

          <div className="mt-3">
            <Label>Tom da mensagem</Label>
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTone(t.v)}
                  className="text-left rounded-lg px-2.5 py-1.5 transition-all"
                  style={{
                    background: tone === t.v ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
                    color: tone === t.v ? "#d6bf86" : "#0d1d2e",
                    border: "1px solid " + (tone === t.v ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
                    minHeight: 44,
                  }}
                >
                  <div className="text-[12px] font-semibold">{t.label}</div>
                  <div className="text-[9.5px] opacity-75 leading-tight mt-0.5">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <Label>{mode === "free" ? "Sua instrucao" : "Direcionamento extra (opcional)"}</Label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder={
                mode === "free"
                  ? "Ex: arte com clima de fim de tarde em Miami Beach, frase sobre liberdade"
                  : "Ex: destaque o teto solar panoramico"
              }
              className="w-full mt-1 px-2.5 py-2 rounded-lg text-[12px] bg-white resize-none"
              style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e" }}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || !vehicleId}
            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold tracking-wide transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(180deg,#14283d,#0d1d2e)",
              color: "#d6bf86",
              border: "1px solid rgba(214,191,134,0.40)",
              minHeight: 42,
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {loading ? "Gerando arte..." : "Gerar com IA"}
          </button>
          <p className="text-[10px] text-center mt-1.5" style={{ color: "rgba(13,29,46,0.5)" }}>
            A geracao leva de 15 a 40 segundos. Cada vez gera uma arte unica.
          </p>
        </div>

        {/* Preview */}
        <div
          className="rounded-[14px] p-3 sm:p-4 lg:sticky lg:top-4 self-start"
          style={{ background: "#0d1d2e", border: "1px solid rgba(214,191,134,0.20)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "#d6bf86" }}>
              Pre-visualizacao completa
            </span>
            {result && (
              <div className="flex gap-1.5">
                <IconBtn onClick={copyCaption} title="Copiar legenda"><Copy size={12} /></IconBtn>
                <IconBtn onClick={download} title="Baixar imagem"><Download size={12} /></IconBtn>
              </div>
            )}
          </div>

          <div
            className="relative w-full rounded-lg overflow-hidden flex items-center justify-center mx-auto"
            style={{
              aspectRatio: format === "feed" ? "1 / 1" : "9 / 16",
              maxHeight: "60vh",
              maxWidth: format === "story" ? 320 : "100%",
              background:
                "repeating-conic-gradient(rgba(255,255,255,0.03) 0deg 90deg, rgba(255,255,255,0.06) 90deg 180deg) 0 0/20px 20px",
              border: "1px solid rgba(214,191,134,0.15)",
            }}
          >
            {loading && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.85)" }}>
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                <div className="text-[11px] tracking-wide">A inteligencia esta compondo a arte...</div>
              </div>
            )}
            {!loading && !result && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.55)" }}>
                <ImageIcon size={24} className="mx-auto mb-2" />
                <div className="text-[11px] tracking-wide">A arte gerada aparece aqui inteira, sem cortes.</div>
              </div>
            )}
            {!loading && result && (
              <img
                src={`data:image/png;base64,${result.imageBase64}`}
                alt={result.phrase}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {result && (
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Frase
                </span>
                <p className="text-[13px] mt-0.5" style={{ color: "#fbf7ee", fontFamily: "'Cormorant Garamond', serif" }}>
                  {result.phrase}
                </p>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Legenda
                </span>
                <p className="text-[11.5px] mt-0.5 whitespace-pre-line" style={{ color: "rgba(251,247,238,0.85)" }}>
                  {result.caption}
                </p>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Hashtags
                </span>
                <p className="text-[11px] mt-0.5" style={{ color: "#d6bf86" }}>
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
    <label className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(13,29,46,0.55)" }}>
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
      className="rounded-lg px-2.5 py-2 text-left transition-all"
      style={{
        background: active ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
        color: active ? "#d6bf86" : "#0d1d2e",
        border: "1px solid " + (active ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
        minHeight: 44,
      }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-semibold">{icon} {label}</div>
      <div className="text-[10px] opacity-75 mt-0.5">{sub}</div>
    </button>
  );
}

function ModePill({
  active, onClick, icon, label, sub,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-2.5 py-2 text-left transition-all"
      style={{
        background: active ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
        color: active ? "#d6bf86" : "#0d1d2e",
        border: "1px solid " + (active ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
        minHeight: 50,
      }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-semibold">{icon} {label}</div>
      <div className="text-[10px] opacity-75 mt-0.5">{sub}</div>
    </button>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 rounded-full inline-flex items-center justify-center transition-all"
      style={{ background: "rgba(214,191,134,0.12)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.30)" }}
    >
      {children}
    </button>
  );
}
