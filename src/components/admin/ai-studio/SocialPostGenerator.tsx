import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Wand2, Download, Copy, Loader2, Image as ImageIcon, Smartphone, Tag, MessageSquare, Upload, X, Layers, Square, ChevronLeft, ChevronRight, Shuffle, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pickRandomSeasonalTheme } from "@/lib/aiStudio/seasonalTheme";
import { savePost } from "@/lib/marketing/postHistory";

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
type PostKind = "single" | "carousel";

const TONES: { v: Tone; label: string; hint: string }[] = [
  { v: "luxo", label: "Luxo", hint: "Exclusivo, premium, status" },
  { v: "aventura", label: "Aventura", hint: "Viagem, liberdade, Orlando" },
  { v: "familia", label: "Família", hint: "Memórias, conforto, segurança" },
  { v: "promocao", label: "Oportunidade", hint: "Oferta sem apelar" },
  { v: "lancamento", label: "Lançamento", hint: "Novidade, primeira vez" },
  { v: "sazonal", label: "Sazonal", hint: "Periodo aleatorio: Natal, Verao, Ano Novo, feriados..." },
];

type SlideOut = { role: "cover" | "content" | "cta"; imageBase64: string; headline: string; subheadline: string };
type Result = {
  imageBase64: string;
  phrase: string;
  caption: string;
  hashtags: string[];
  format: Format;
  carousel?: boolean;
  slidesCount?: number;
  slides?: SlideOut[];
};

export default function SocialPostGenerator({ onBack }: { onBack: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [randomVehicle, setRandomVehicle] = useState<boolean>(false);
  const [format, setFormat] = useState<Format>("feed");
  const [tone, setTone] = useState<Tone>("luxo");
  const [mode, setMode] = useState<Mode>("promo");
  const [customPrompt, setCustomPrompt] = useState("");

  // NEW: single vs carousel
  const [kind, setKind] = useState<PostKind>("single");
  const [slidesCount, setSlidesCount] = useState<number>(3);
  const [activeSlide, setActiveSlide] = useState<number>(0);

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
  const [suggesting, setSuggesting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function suggestDirection() {
    setSuggesting(true);
    try {
      const seasonal = tone === "sazonal" ? pickRandomSeasonalTheme() : null;
      const v = selected;
      const { data, error } = await supabase.functions.invoke("marketing-suggest-direction", {
        body: {
          vehicleName: v?.name || undefined,
          vehicleBrand: v?.brand || undefined,
          format, tone, mode,
          carousel: kind === "carousel",
          slidesCount: kind === "carousel" ? slidesCount : 1,
          seasonalLabel: seasonal?.label,
          promo: mode === "promo" ? { priceDaily, dateStart, dateEnd, hook: promoHook } : undefined,
        },
      });
      if (error) throw error;
      const s = (data as any)?.suggestion as string | undefined;
      if (!s) throw new Error("Sem sugestão");
      setCustomPrompt(s);
      toast.success("Direcionamento sugerido pela IA");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao sugerir direcionamento");
    } finally {
      setSuggesting(false);
    }
  }

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
    // Pick vehicle: random (AI escolhe) or selected.
    let vehicleForRun = selected;
    if (randomVehicle) {
      const pool = vehicles.filter((v) => {
        if (v.image_url) return true;
        const arr = Array.isArray(v.photos) ? v.photos : [];
        return arr.length > 0;
      });
      const finalPool = pool.length > 0 ? pool : vehicles;
      if (finalPool.length === 0) {
        toast.error("Nenhum carro disponível para gerar a arte.");
        return;
      }
      vehicleForRun = finalPool[Math.floor(Math.random() * finalPool.length)];
      toast.success(`A IA escolheu: ${vehicleForRun.name || `${vehicleForRun.brand || ""} ${vehicleForRun.model || ""}`.trim()}`);
    }
    if (!vehicleForRun) {
      toast.error("Selecione um carro ou ative o modo aleatório.");
      return;
    }
    if (mode === "promo" && (!priceDaily || !dateStart || !dateEnd)) {
      toast.error("Preencha o valor da diária e o período da promoção.");
      return;
    }
    if (mode === "reference" && !refDataUrl) {
      toast.error("Anexe uma imagem de referência.");
      return;
    }
    setLoading(true);
    setResult(null);
    setActiveSlide(0);
    try {
      const runPhotoUrl = (() => {
        if (vehicleForRun!.image_url) return vehicleForRun!.image_url;
        const arr = Array.isArray(vehicleForRun!.photos) ? vehicleForRun!.photos : [];
        const first = arr[0];
        if (typeof first === "string") return first;
        if (first && typeof first === "object") return first.url || first.src || null;
        return null;
      })();
      const logoDataUrl = await urlToDataUrl(`${window.location.origin}/brand/logo-black.png`);
      // Convert the vehicle photo to data URL too — edge functions may fail to fetch
      // arbitrary CDN/storage URLs reliably, and Gemini needs guaranteed access.
      const vehiclePhotoDataUrl = runPhotoUrl ? await urlToDataUrl(runPhotoUrl) : null;
      const { data, error } = await supabase.functions.invoke("marketing-generate-post", {
        body: {
          vehicleName: vehicleForRun!.name || `${vehicleForRun!.brand || ""} ${vehicleForRun!.model || ""}`.trim(),
          vehicleBrand: vehicleForRun!.brand,
          vehiclePhotoUrl: vehiclePhotoDataUrl || runPhotoUrl,
          logoDataUrl,
          format,
          tone,
          mode,
          customPrompt: customPrompt.trim() || undefined,
          seasonalTheme: tone === "sazonal" ? pickRandomSeasonalTheme() : undefined,
          promo: mode === "promo" ? {
            priceDaily: priceDaily.trim(),
            dateStart,
            dateEnd,
            hook: promoHook.trim() || undefined,
          } : undefined,
          referenceImageDataUrl: mode === "reference" ? refDataUrl : undefined,
          carousel: kind === "carousel",
          slidesCount: kind === "carousel" ? slidesCount : 1,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as Result;
      setResult(res);
      // Persist to local history (IndexedDB) so the user can revisit later.
      try {
        await savePost({
          vehicleName: vehicleForRun!.name || `${vehicleForRun!.brand || ""} ${vehicleForRun!.model || ""}`.trim() || null,
          vehicleBrand: vehicleForRun!.brand || null,
          format: res.format,
          tone,
          mode,
          carousel: !!res.carousel,
          slidesCount: res.slidesCount || (res.slides?.length ?? 1),
          phrase: res.phrase,
          caption: res.caption,
          hashtags: res.hashtags,
          imageBase64: res.imageBase64,
          slides: res.slides,
        });
      } catch (saveErr) {
        console.warn("Falha ao salvar histórico local:", saveErr);
      }
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || e);
      if (msg.includes("429")) toast.error("Limite de uso atingido. Tente novamente em instantes.");
      else if (msg.includes("402")) toast.error("Créditos esgotados. Adicione mais créditos para continuar.");
      else toast.error("Não foi possível gerar o post. " + msg);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const safeName = (selected?.name || "post").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const list = result.slides && result.slides.length > 0
      ? result.slides.map((s, i) => ({ b64: s.imageBase64, name: `post-${safeName}-${result.format}-slide-${String(i + 1).padStart(2, "0")}.png` }))
      : [{ b64: result.imageBase64, name: `post-${safeName}-${result.format}.png` }];
    list.forEach((it, idx) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `data:image/png;base64,${it.b64}`;
        a.download = it.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, idx * 250);
    });
    if (list.length > 1) toast.success(`Baixando ${list.length} artes do carrossel.`);
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
          style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
        >
          Crie uma arte com a marca em segundos
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 sm:gap-4">
        {/* Form */}
        <div
          className={`rounded-[14px] p-3 sm:p-4 ${(loading || result) ? "order-2 lg:order-none" : ""}`}
          style={{ background: "#fbf7ee", border: "1px solid rgba(13,29,46,0.10)" }}
        >
          {/* Mode selector */}
          <Label>Tipo de arte</Label>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <ModePill active={mode === "promo"} onClick={() => setMode("promo")} icon={<Tag size={12} />} label="Promoção" sub="Carro + data + valor" />
            <ModePill active={mode === "free"} onClick={() => setMode("free")} icon={<MessageSquare size={12} />} label="Livre" sub="Só com instrução" />
            <ModePill active={mode === "reference"} onClick={() => setMode("reference")} icon={<ImageIcon size={12} />} label="Com referência" sub="Anexar arte base" />
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Carro</Label>
              <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid rgba(13,29,46,0.18)" }}>
                <button
                  onClick={() => setRandomVehicle(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-all"
                  style={{
                    background: !randomVehicle ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
                    color: !randomVehicle ? "#d6bf86" : "#0d1d2e",
                  }}
                >
                  <Car size={10} /> Manual
                </button>
                <button
                  onClick={() => setRandomVehicle(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-all"
                  style={{
                    background: randomVehicle ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
                    color: randomVehicle ? "#d6bf86" : "#0d1d2e",
                    borderLeft: "1px solid rgba(13,29,46,0.18)",
                  }}
                >
                  <Shuffle size={10} /> Aleatório
                </button>
              </div>
            </div>
            {!randomVehicle ? (
              <>
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
                    Este carro não tem foto cadastrada. A arte será gerada apenas com a marca.
                  </p>
                )}
              </>
            ) : (
              <div
                className="mt-1 rounded-lg px-3 py-2.5 flex items-center gap-2"
                style={{ background: "white", border: "1px dashed rgba(154,122,58,0.45)" }}
              >
                <Shuffle size={14} style={{ color: "#9a7a3a" }} />
                <div className="flex-1">
                  <div className="text-[12px] font-semibold" style={{ color: "#0d1d2e" }}>A IA escolhe o carro</div>
                  <div className="text-[10px]" style={{ color: "rgba(13,29,46,0.62)" }}>
                    Sorteia um veículo da frota com foto cadastrada na hora de gerar.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Promo fields */}
          {mode === "promo" && (
            <div className="mt-3 rounded-lg p-2.5" style={{ background: "white", border: "1px dashed rgba(154,122,58,0.45)" }}>
              <div className="text-[9px] uppercase tracking-[0.28em] font-semibold mb-1.5" style={{ color: "#9a7a3a" }}>
                Detalhes da promoção
              </div>
              <Label>Valor da diária (USD)</Label>
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
                  <Label>Até</Label>
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
              <Label>Imagem de referência</Label>
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
                  <div className="text-[12px] font-semibold">Anexar imagem de inspiração</div>
                  <div className="text-[10px] opacity-65 mt-0.5">PNG, JPG ou WEBP até 8MB</div>
                </button>
              ) : (
                <div className="mt-1 rounded-lg overflow-hidden relative" style={{ border: "1px solid rgba(13,29,46,0.18)" }}>
                  <img src={refDataUrl} alt="Referência" className="w-full max-h-[140px] object-contain bg-white" />
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
                A IA usa essa arte como inspiração de estilo, composição e paleta. O carro e a marca continuam sendo os protagonistas.
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
            <Label>Tipo de publicação</Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <FormatPill active={kind === "single"} onClick={() => setKind("single")} icon={<Square size={12} />} label="Único" sub="1 arte" />
              <FormatPill active={kind === "carousel"} onClick={() => setKind("carousel")} icon={<Layers size={12} />} label="Carrossel" sub={`${slidesCount} slides`} />
            </div>
            {kind === "carousel" && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Label>Slides</Label>
                <div className="flex gap-1">
                  {[3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSlidesCount(n)}
                      className="h-7 w-7 rounded-md text-[11px] font-semibold transition-all"
                      style={{
                        background: slidesCount === n ? "linear-gradient(180deg,#14283d,#0d1d2e)" : "white",
                        color: slidesCount === n ? "#d6bf86" : "#0d1d2e",
                        border: "1px solid " + (slidesCount === n ? "rgba(214,191,134,0.40)" : "rgba(13,29,46,0.15)"),
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-[10px]" style={{ color: "rgba(13,29,46,0.55)" }}>
                  Capa + conteúdo + chamada final
                </span>
              </div>
            )}
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
                  <div className="text-[12px] font-semibold leading-tight truncate">{t.label}</div>
                  <div className="text-[9.5px] opacity-75 leading-tight mt-0.5 truncate">{t.hint}</div>

                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{mode === "free" ? "Sua instrução" : "Direcionamento extra (opcional)"}</Label>
              <button
                type="button"
                onClick={suggestDirection}
                disabled={suggesting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10.5px] font-semibold tracking-wide transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(180deg,#14283d,#0d1d2e)",
                  color: "#d6bf86",
                  border: "1px solid rgba(214,191,134,0.40)",
                  minHeight: 28,
                }}
                title="A IA sugere um direcionamento criativo coerente com a marca"
              >
                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Sugerir com IA
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder={
                mode === "free"
                  ? "Ex: arte com clima de fim de tarde em Miami Beach, frase sobre liberdade"
                  : "Ex: destaque o teto solar panorâmico"
              }
              className="w-full mt-1 px-2.5 py-2 rounded-lg text-[12px] bg-white resize-none"
              style={{ border: "1px solid rgba(13,29,46,0.18)", color: "#0d1d2e" }}
            />
          </div>

          <div className="mt-3 sticky bottom-2 lg:static z-10">
            <button
              onClick={generate}
              disabled={loading || (!randomVehicle && !vehicleId)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-[13px] font-semibold tracking-wide transition-all disabled:opacity-60 active:scale-[0.99]"
              style={{
                background: "linear-gradient(180deg,#14283d,#0d1d2e)",
                color: "#d6bf86",
                border: "1px solid rgba(214,191,134,0.40)",
                minHeight: 48,
                boxShadow: "0 14px 30px -16px rgba(13,29,46,0.6)",
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {loading ? (kind === "carousel" ? `Gerando ${slidesCount} slides…` : "Gerando arte…") : (kind === "carousel" ? `Gerar carrossel (${slidesCount} slides)` : "Gerar com IA")}
            </button>
          </div>
          <p className="text-[10px] text-center mt-1.5" style={{ color: "rgba(13,29,46,0.5)" }}>
            {kind === "carousel"
              ? `O carrossel leva cerca de ${slidesCount * 25}s. Os slides mantêm o mesmo estilo visual.`
              : "A geração leva de 15 a 40 segundos. Cada execução produz uma arte única."}
          </p>
        </div>


        {/* Preview */}
        <div
          className={`rounded-[14px] p-3 sm:p-4 lg:sticky lg:top-4 self-start ${(loading || result) ? "order-1 lg:order-none" : ""}`}
          style={{ background: "#0d1d2e", border: "1px solid rgba(214,191,134,0.20)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-[0.28em] font-semibold" style={{ color: "#d6bf86" }}>
              {result?.slides && result.slides.length > 1
                ? `Carrossel · ${activeSlide + 1} / ${result.slides.length}`
                : "Pré-visualização completa"}
            </span>
            {result && (
              <div className="flex gap-1.5">
                <IconBtn onClick={copyCaption} title="Copiar legenda"><Copy size={12} /></IconBtn>
                <IconBtn onClick={download} title={result.slides && result.slides.length > 1 ? "Baixar todas as artes" : "Baixar imagem"}>
                  <Download size={12} />
                </IconBtn>
              </div>
            )}
          </div>

          <div
            className="relative w-full rounded-lg overflow-hidden flex items-center justify-center mx-auto"
            style={{
              aspectRatio: format === "feed" ? "1 / 1" : "9 / 16",
              maxHeight: format === "story" ? "75vh" : "65vh",
              maxWidth: format === "story" ? 360 : "100%",
              background:
                "repeating-conic-gradient(rgba(255,255,255,0.03) 0deg 90deg, rgba(255,255,255,0.06) 90deg 180deg) 0 0/20px 20px",
              border: "1px solid rgba(214,191,134,0.15)",
            }}
          >
            {loading && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.85)" }}>
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                <div className="text-[11px] tracking-wide">
                  {kind === "carousel" ? `Compondo ${slidesCount} slides do carrossel…` : "A inteligência está compondo a arte…"}
                </div>
              </div>
            )}
            {!loading && !result && (
              <div className="text-center px-6" style={{ color: "rgba(214,191,134,0.55)" }}>
                <ImageIcon size={24} className="mx-auto mb-2" />
                <div className="text-[11px] tracking-wide">A arte gerada aparece aqui inteira, sem cortes.</div>
              </div>
            )}
            {!loading && result && (() => {
              const slides = result.slides && result.slides.length > 0
                ? result.slides
                : [{ role: "cover" as const, imageBase64: result.imageBase64, headline: result.phrase, subheadline: "" }];
              const safeIdx = Math.min(activeSlide, slides.length - 1);
              const current = slides[safeIdx];
              return (
                <>
                  <img
                    src={`data:image/png;base64,${current.imageBase64}`}
                    alt={current.headline || result.phrase}
                    className="w-full h-full object-contain"
                  />
                  {slides.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveSlide((safeIdx - 1 + slides.length) % slides.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 sm:h-9 sm:w-9 rounded-full inline-flex items-center justify-center active:scale-95 transition-transform"
                        style={{ background: "rgba(13,29,46,0.78)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.40)", backdropFilter: "blur(6px)" }}
                        title="Slide anterior"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setActiveSlide((safeIdx + 1) % slides.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 sm:h-9 sm:w-9 rounded-full inline-flex items-center justify-center active:scale-95 transition-transform"
                        style={{ background: "rgba(13,29,46,0.78)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.40)", backdropFilter: "blur(6px)" }}
                        title="Próximo slide"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(13,29,46,0.55)", backdropFilter: "blur(6px)" }}>
                        {slides.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveSlide(i)}
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: i === safeIdx ? 20 : 8,
                              background: i === safeIdx ? "#d6bf86" : "rgba(214,191,134,0.45)",
                            }}
                            aria-label={`Slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {result?.slides && result.slides.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
              {result.slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className="flex-shrink-0 rounded-md overflow-hidden transition-all snap-start"
                  style={{
                    border: i === activeSlide ? "1.5px solid #d6bf86" : "1px solid rgba(214,191,134,0.20)",
                    opacity: i === activeSlide ? 1 : 0.7,
                    width: format === "feed" ? 60 : 40,
                    height: 60,
                  }}
                  title={`${s.role === "cover" ? "Capa" : s.role === "cta" ? "Chamada" : "Conteúdo"} · ${i + 1}`}
                >
                  <img
                    src={`data:image/png;base64,${s.imageBase64}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}


          {result && (
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(214,191,134,0.75)" }}>
                  Frase
                </span>
                <p className="text-[13px] mt-0.5" style={{ color: "#fbf7ee", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}>
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
      aria-label={title}
      className="h-10 w-10 sm:h-8 sm:w-8 rounded-full inline-flex items-center justify-center transition-all active:scale-95"
      style={{ background: "rgba(214,191,134,0.14)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.35)" }}
    >
      {children}
    </button>
  );
}
