import { useEffect, useState } from "react";
import { ArrowLeft, FolderOpen, Trash2, Download, Copy, X, ImageIcon, Layers, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listPosts, deletePost, clearAllPosts, type HistoryPost } from "@/lib/marketing/postHistory";

type Props = { onBack: () => void };

export default function MarketingHistory({ onBack }: Props) {
  const [items, setItems] = useState<HistoryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryPost | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  async function reload() {
    setLoading(true);
    try {
      const list = await listPosts();
      setItems(list);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function formatDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function onDelete(id: string) {
    if (!confirm("Remover esta arte do histórico?")) return;
    await deletePost(id);
    if (selected?.id === id) setSelected(null);
    void reload();
  }

  async function onClearAll() {
    if (!confirm("Apagar TODO o histórico de artes geradas? Esta ação não pode ser desfeita.")) return;
    await clearAllPosts();
    setSelected(null);
    void reload();
  }

  function download(post: HistoryPost) {
    const safe = (post.vehicleName || "post").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const list = post.slides && post.slides.length > 0
      ? post.slides.map((s, i) => ({ b64: s.imageBase64, name: `zeus-${safe}-${post.format}-slide-${String(i + 1).padStart(2, "0")}.png` }))
      : [{ b64: post.imageBase64, name: `zeus-${safe}-${post.format}.png` }];
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

  function copyCaption(post: HistoryPost) {
    const text = `${post.caption}\n\n${post.hashtags.join(" ")}`;
    navigator.clipboard.writeText(text).then(() => toast.success("Legenda copiada."));
  }

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-10">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] font-semibold mb-3"
        style={{ color: "rgba(13,29,46,0.62)" }}
      >
        <ArrowLeft size={12} /> Voltar ao Marketing Studio
      </button>

      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase font-semibold tracking-[0.28em]"
            style={{ background: "rgba(13,29,46,0.04)", border: "1px solid rgba(13,29,46,0.10)", color: "rgba(13,29,46,0.62)" }}
          >
            <FolderOpen size={11} style={{ color: "#9a7a3a" }} /> Histórico de artes
          </div>
          <h1
            className="mt-1.5 text-[22px] sm:text-[28px] font-light tracking-[-0.01em]"
            style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
          >
            Todas as artes geradas
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "rgba(13,29,46,0.62)" }}>
            {loading ? "Carregando..." : `${items.length} ${items.length === 1 ? "arte salva" : "artes salvas"} neste navegador.`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-95"
            style={{ background: "white", color: "#0d1d2e", border: "1px solid rgba(13,29,46,0.15)", minHeight: 40 }}
          >
            <Trash2 size={12} /> Limpar tudo
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(13,29,46,0.55)" }}>
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          <div className="text-[12px]">Carregando histórico...</div>
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-16 rounded-[16px]"
          style={{ background: "#fbf7ee", border: "1px dashed rgba(13,29,46,0.18)" }}
        >
          <ImageIcon size={32} className="mx-auto mb-2" style={{ color: "rgba(154,122,58,0.65)" }} />
          <div className="text-[14px] font-semibold" style={{ color: "#0d1d2e" }}>Nenhuma arte gerada ainda</div>
          <div className="text-[12px] mt-1" style={{ color: "rgba(13,29,46,0.55)" }}>
            Volte ao gerador e crie sua primeira arte. Ela aparecerá aqui automaticamente.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setActiveSlide(0); }}
              className="group text-left rounded-[12px] overflow-hidden transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              style={{
                background: "#fbf7ee",
                border: "1px solid rgba(13,29,46,0.10)",
                boxShadow: "0 10px 24px -18px rgba(13,29,46,0.35)",
              }}
            >
              <div
                className="relative w-full bg-[#0d1d2e] flex items-center justify-center overflow-hidden"
                style={{ aspectRatio: p.format === "feed" ? "1 / 1" : "9 / 16" }}
              >
                <img
                  src={`data:image/${p.thumbBase64 ? "jpeg" : "png"};base64,${p.thumbBase64 || p.imageBase64}`}
                  alt={p.phrase}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {p.carousel && p.slidesCount > 1 && (
                  <span
                    className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
                    style={{ background: "rgba(13,29,46,0.85)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.40)" }}
                  >
                    <Layers size={9} /> {p.slidesCount}
                  </span>
                )}
                <span
                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(13,29,46,0.85)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.30)" }}
                >
                  {p.format === "feed" ? "Feed" : "Story"}
                </span>
              </div>
              <div className="p-2">
                <div className="text-[11.5px] font-semibold leading-tight truncate" style={{ color: "#0d1d2e" }}>
                  {p.vehicleName || "Sem carro"}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[9.5px]" style={{ color: "rgba(13,29,46,0.55)" }}>
                  <Calendar size={9} /> {formatDate(p.createdAt)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          style={{ background: "rgba(8,16,28,0.78)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-[960px] max-h-[92vh] overflow-y-auto rounded-[16px]"
            style={{ background: "#fbf7ee", border: "1px solid rgba(214,191,134,0.30)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 h-9 w-9 rounded-full inline-flex items-center justify-center z-10 active:scale-95"
              style={{ background: "rgba(13,29,46,0.85)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.40)" }}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0">
              <div className="p-3 sm:p-4" style={{ background: "#0d1d2e" }}>
                {(() => {
                  const slides = selected.slides && selected.slides.length > 0
                    ? selected.slides
                    : [{ role: "cover" as const, imageBase64: selected.imageBase64, headline: selected.phrase, subheadline: "" }];
                  const idx = Math.min(activeSlide, slides.length - 1);
                  const current = slides[idx];
                  return (
                    <>
                      <div
                        className="relative w-full rounded-lg overflow-hidden flex items-center justify-center mx-auto"
                        style={{
                          aspectRatio: selected.format === "feed" ? "1 / 1" : "9 / 16",
                          maxHeight: "70vh",
                          maxWidth: selected.format === "story" ? 340 : "100%",
                          background: "rgba(255,255,255,0.04)",
                        }}
                      >
                        <img
                          src={`data:image/png;base64,${current.imageBase64}`}
                          alt={current.headline}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {slides.length > 1 && (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 justify-center">
                          {slides.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveSlide(i)}
                              className="flex-shrink-0 rounded-md overflow-hidden transition-all"
                              style={{
                                border: i === idx ? "1.5px solid #d6bf86" : "1px solid rgba(214,191,134,0.20)",
                                opacity: i === idx ? 1 : 0.65,
                                width: selected.format === "feed" ? 56 : 36,
                                height: 56,
                              }}
                            >
                              <img src={`data:image/png;base64,${s.imageBase64}`} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>Carro</div>
                  <div className="text-[14px] font-semibold" style={{ color: "#0d1d2e" }}>{selected.vehicleName || "Sem carro"}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: "rgba(13,29,46,0.55)" }}>
                    {formatDate(selected.createdAt)} · {selected.format === "feed" ? "Feed 1:1" : "Story 9:16"}
                    {selected.carousel && selected.slidesCount > 1 ? ` · Carrossel ${selected.slidesCount} slides` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>Frase</div>
                  <p className="text-[14px] mt-0.5" style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}>
                    {selected.phrase}
                  </p>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>Legenda</div>
                  <p className="text-[11.5px] mt-0.5 whitespace-pre-line" style={{ color: "rgba(13,29,46,0.78)" }}>
                    {selected.caption}
                  </p>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>Hashtags</div>
                  <p className="text-[11px] mt-0.5" style={{ color: "#9a7a3a" }}>{selected.hashtags.join(" ")}</p>
                </div>

                <div className="pt-2 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => copyCaption(selected)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold"
                    style={{ background: "white", color: "#0d1d2e", border: "1px solid rgba(13,29,46,0.18)", minHeight: 40 }}
                  >
                    <Copy size={12} /> Copiar legenda
                  </button>
                  <button
                    onClick={() => download(selected)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold"
                    style={{ background: "linear-gradient(180deg,#14283d,#0d1d2e)", color: "#d6bf86", border: "1px solid rgba(214,191,134,0.40)", minHeight: 40 }}
                  >
                    <Download size={12} /> Baixar
                  </button>
                </div>
                <button
                  onClick={() => onDelete(selected.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold"
                  style={{ background: "white", color: "#a02323", border: "1px solid rgba(160,35,35,0.30)", minHeight: 38 }}
                >
                  <Trash2 size={12} /> Remover do histórico
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
