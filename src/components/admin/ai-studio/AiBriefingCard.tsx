import { Brain, ChevronDown, ChevronRight, FileDown, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CAR_BRANDS, carLogoUrl, findBrandByName } from "@/data/carBrands";
import { exportPainelPdf } from "@/lib/exportPainelPdf";
import { exportFleetReportPdf, type FleetReport } from "@/lib/exportFleetReportPdf";


export type BriefingSnapshot = {
  rodandoAgora: number;
  paradosAgora: number;
  receitaHoje: number;
  receitaMtd: number;
  receitaLmtd: number;
  deltaPct: number;
  paybackMeses: number | null;
  paretoCarros: number;
  paretoTotal: number;
  paretoFrotaPct: number;
  receitaPerdida: number;
};

export type BriefingHighlight = {
  vehicleName: string;
  brandSlug?: string;
  invested: number;
  days: number;
  revenue: number;
  roiPct: number;
  status: "destaque" | "atencao" | "critico";
  nota: string;
};

export type BriefingAction = {
  vehicleName?: string;
  brandSlug?: string;
  titulo: string;
  detalhe: string;
  impacto: string;
  impactoTipo: "ganho" | "risco";
  prioridade: "alta" | "media" | "baixa";
};

type Props = {
  briefing: string | null;
  loading: boolean;
  contextLabel?: string;
  snapshot?: BriefingSnapshot;
  highlights?: BriefingHighlight[];
  actions?: BriefingAction[];
  report?: FleetReport;
};


const brandSource =
  "\\b(" +
  CAR_BRANDS.map((b) => b.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|") +
  ")\\b";

type Seg = { kind: "text" | "bold" | "brand"; value: string; slug?: string };

function parseParagraph(line: string): Seg[] {
  const boldParts = line.split(/\*\*(.+?)\*\*/g);
  const out: Seg[] = [];
  boldParts.forEach((part, i) => {
    if (!part) return;
    const isBold = i % 2 === 1;
    out.push(...splitBrands(part, isBold));
  });
  return out;
}

function splitBrands(text: string, bold: boolean): Seg[] {
  const segs: Seg[] = [];
  const re = new RegExp(brandSource, "gi");
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    if (start > cursor) {
      segs.push({ kind: bold ? "bold" : "text", value: text.slice(cursor, start) });
    }
    const brandName = m[1];
    const brand = findBrandByName(brandName);
    let end = start + m[0].length;
    const tail = text.slice(end);
    const ext = tail.match(/^(?:\s+[A-Z0-9][A-Za-z0-9\-/]*){1,5}/);
    let fullName = brandName;
    if (ext) {
      fullName = brandName + ext[0];
      end += ext[0].length;
    }
    segs.push({ kind: "brand", value: fullName.replace(/\s+/g, " ").trim(), slug: brand?.slug });
    cursor = end;
    re.lastIndex = end;
  }
  if (cursor < text.length) segs.push({ kind: bold ? "bold" : "text", value: text.slice(cursor) });
  return segs;
}

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const NAVY = "#0d1d2e";
const INK = "rgba(13,29,46,0.86)";
const MUTED = "rgba(13,29,46,0.55)";
const GOLD = "#9a7a3a";
const HAIR = "rgba(13,29,46,0.12)";

function VehiclePill({ name, slug, size = "md" }: { name: string; slug?: string; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        padding: small ? "2px 7px 2px 3px" : "3px 8px 3px 4px",
        borderRadius: 8,
        background: "linear-gradient(180deg, #ffffff, #f4ecd9)",
        border: "1px solid rgba(13,29,46,0.14)",
        boxShadow: "0 1px 2px rgba(13,29,46,0.06)",
      }}
    >
      {slug ? (
        <span
          className="grid place-items-center rounded-[5px]"
          style={{
            width: small ? 16 : 18,
            height: small ? 16 : 18,
            background: "#fff",
            border: "1px solid rgba(13,29,46,0.08)",
          }}
        >
          <img
            src={carLogoUrl(slug)}
            alt=""
            style={{ width: small ? 12 : 14, height: small ? 12 : 14, objectFit: "contain", display: "block" }}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
        </span>
      ) : null}
      <span
        style={{
          fontSize: small ? "11.5px" : "12.5px",
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.005em",
          color: NAVY,
        }}
      >
        {name}
      </span>
    </span>
  );
}

function MiniKpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const accent =
    tone === "good" ? "#1f6b3a" : tone === "bad" ? "#8a2433" : tone === "warn" ? "#8a6d1f" : NAVY;
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.65)",
        border: `1px solid ${HAIR}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
      }}
    >
      <div
        className="text-[9.5px] font-semibold uppercase mb-1.5"
        style={{ letterSpacing: "0.18em", color: MUTED }}
      >
        {label}
      </div>
      <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 600, color: accent, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10.5px] leading-snug" style={{ color: MUTED }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PriorityChip({ p }: { p: "alta" | "media" | "baixa" }) {
  const map = {
    alta: { bg: "#8a2433", label: "Alta" },
    media: { bg: "#8a6d1f", label: "Média" },
    baixa: { bg: "#3a5168", label: "Baixa" },
  } as const;
  const m = map[p];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase"
      style={{
        background: m.bg,
        color: "#fbf7ee",
        padding: "3px 8px",
        borderRadius: 999,
        letterSpacing: "0.12em",
        lineHeight: 1,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: "#fbf7ee", opacity: 0.95 }} />
      {m.label}
    </span>
  );
}

function StatusDot({ s }: { s: "destaque" | "atencao" | "critico" }) {
  const map = { destaque: "#1f6b3a", atencao: "#8a6d1f", critico: "#8a2433" };
  const label = { destaque: "Destaque", atencao: "Atenção", critico: "Crítico" };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold"
      style={{ color: map[s], letterSpacing: "0.04em" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: map[s] }} />
      {label[s]}
    </span>
  );
}

export function AiBriefingCard({ briefing, loading, snapshot, highlights, actions, report }: Props) {
  const [exporting, setExporting] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const paragraphs = useMemo(() => {
    if (!briefing) return [] as Seg[][];
    return briefing
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseParagraph);
  }, [briefing]);

  const handlePdf = async () => {
    setExporting(true);
    try {
      if (report) {
        await exportFleetReportPdf(report, "relatorio-frota-inteligente.pdf");
      } else {
        const target =
          (document.querySelector(".ai-shell") as HTMLElement | null) ?? (document.body as HTMLElement);
        await exportPainelPdf({ target, filename: "ai-studio-painel.pdf" });
      }
    } finally {
      setExporting(false);
    }
  };


  const hasStructured = !!(snapshot || (highlights && highlights.length) || (actions && actions.length));

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(180deg, #fbf7ee 0%, #f3ebd4 100%)",
        border: "1px solid rgba(154,122,58,0.28)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 22px 50px -28px rgba(13,29,46,0.28)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(700px circle at 0% 0%, rgba(154,122,58,0.10), transparent 55%)",
        }}
      />

      <div className="relative p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-3.5 mb-4 sm:mb-5">
          <div
            className="shrink-0 grid place-items-center rounded-xl"
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #b8924a, #9a7a3a)",
              border: "1px solid rgba(154,122,58,0.55)",
              color: "#fbf7ee",
              boxShadow: "0 8px 18px -8px rgba(154,122,58,0.55)",
            }}
          >
            <Brain size={17} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div
                  className="text-[10px] uppercase font-semibold pt-1"
                  style={{ letterSpacing: "0.22em", color: MUTED }}
                >
                  {loading ? "Analisando dados da sua frota..." : "O que a IA está vendo agora"}
                </div>
                {!loading && hasStructured && (
                  <div
                    className="text-[12px] mt-1"
                    style={{ color: MUTED, letterSpacing: "0.01em" }}
                  >
                    Leitura rápida da semana. Números, destaques e o que fazer.
                  </div>
                )}
              </div>
              {!loading && (
                <button
                  onClick={handlePdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-2 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50 min-h-[40px]"
                  style={{
                    background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                    borderColor: "rgba(154,122,58,0.45)",
                    color: "#fbf7ee",
                    boxShadow: "0 6px 14px -8px rgba(13,29,46,0.5)",
                  }}
                  title="Salvar o painel completo como PDF"
                >
                  {exporting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <FileDown size={12} style={{ color: "#d6bf86" }} />
                  )}
                  <span>{exporting ? "Gerando PDF" : "Salvar PDF"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SNAPSHOT */}
        {snapshot && !loading && (
          <div className="mb-5">
            <div
              className="text-[10px] uppercase font-semibold mb-2"
              style={{ letterSpacing: "0.22em", color: GOLD }}
            >
              Snapshot · agora
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <MiniKpi
                label="Rodando"
                value={String(snapshot.rodandoAgora)}
                sub={`${snapshot.paradosAgora} parados`}
                tone="good"
              />
              <MiniKpi label="Receita hoje" value={fmtUSD(snapshot.receitaHoje)} sub="entrando agora" />
              <MiniKpi
                label="Receita do mês"
                value={fmtUSD(snapshot.receitaMtd)}
                sub={`${snapshot.deltaPct >= 0 ? "+" : ""}${snapshot.deltaPct.toFixed(0)}% vs mês passado`}
                tone={snapshot.deltaPct >= 0 ? "good" : "bad"}
              />
              <MiniKpi
                label="Mês passado (mesma data)"
                value={fmtUSD(snapshot.receitaLmtd)}
                sub="referência"
              />
              <MiniKpi
                label="Payback médio"
                value={snapshot.paybackMeses !== null ? `${snapshot.paybackMeses} meses` : ""}
                sub="tempo médio para o carro se pagar"
              />
              <MiniKpi
                label="Receita perdida"
                value={fmtUSD(snapshot.receitaPerdida)}
                sub="cancelamentos + janelas ociosas"
                tone="bad"
              />
            </div>
            {snapshot.paretoTotal > 0 && (
              <div
                className="mt-3 rounded-lg px-3 py-2 text-[12px] leading-snug flex items-start gap-2"
                style={{
                  background: "rgba(154,122,58,0.10)",
                  border: `1px solid rgba(154,122,58,0.28)`,
                  color: NAVY,
                }}
              >
                <TrendingUp size={14} style={{ color: GOLD, marginTop: 2 }} />
                <span>
                  <strong style={{ fontWeight: 650 }}>80% da receita</strong> vem de{" "}
                  <strong style={{ fontWeight: 650 }}>{snapshot.paretoCarros} carros</strong> ({snapshot.paretoFrotaPct.toFixed(0)}% da
                  frota). Os outros {snapshot.paretoTotal - snapshot.paretoCarros} carros geram pouco. vale revisar.
                </span>
              </div>
            )}
          </div>
        )}

        {/* HIGHLIGHTS TABLE */}
        {highlights && highlights.length > 0 && !loading && (
          <div className="mb-5">
            <div
              className="text-[10px] uppercase font-semibold mb-2"
              style={{ letterSpacing: "0.22em", color: GOLD }}
            >
              Carros em destaque
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${HAIR}` }}
            >
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-[12.5px]" style={{ color: INK }}>
                  <thead>
                    <tr style={{ background: "rgba(13,29,46,0.04)", borderBottom: `1px solid ${HAIR}` }}>
                      <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Carro</th>
                      <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Investido</th>
                      <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Dias</th>
                      <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Receita</th>
                      <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Já devolveu</th>
                      <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase" style={{ letterSpacing: "0.14em", color: MUTED }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highlights.map((h, i) => (
                      <tr key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${HAIR}` }}>
                        <td className="px-3 py-2.5"><VehiclePill name={h.vehicleName} slug={h.brandSlug} size="sm" /></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtUSD(h.invested)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{h.days}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtUSD(h.revenue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: h.roiPct >= 15 ? "#1f6b3a" : h.roiPct > 0 ? "#8a6d1f" : "#8a2433", fontWeight: 600 }}>
                          {h.roiPct.toFixed(0)}%
                        </td>
                        <td className="px-3 py-2.5"><StatusDot s={h.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y" style={{ borderColor: HAIR }}>
                {highlights.map((h, i) => (
                  <div key={i} className="p-3" style={{ borderColor: HAIR }}>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <VehiclePill name={h.vehicleName} slug={h.brandSlug} size="sm" />
                      <StatusDot s={h.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]" style={{ color: INK }}>
                      <div><span style={{ color: MUTED }}>Investido: </span><span className="tabular-nums">{fmtUSD(h.invested)}</span></div>
                      <div><span style={{ color: MUTED }}>Dias: </span><span className="tabular-nums">{h.days}</span></div>
                      <div><span style={{ color: MUTED }}>Receita: </span><span className="tabular-nums">{fmtUSD(h.revenue)}</span></div>
                      <div><span style={{ color: MUTED }}>ROI: </span><span className="tabular-nums" style={{ color: h.roiPct >= 15 ? "#1f6b3a" : h.roiPct > 0 ? "#8a6d1f" : "#8a2433", fontWeight: 600 }}>{h.roiPct.toFixed(0)}%</span></div>
                    </div>
                    {h.nota && (
                      <div className="mt-2 text-[11.5px] leading-snug" style={{ color: MUTED }}>{h.nota}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACTIONS TABLE */}
        {actions && actions.length > 0 && !loading && (
          <div className="mb-3">
            <div
              className="text-[10px] uppercase font-semibold mb-2"
              style={{ letterSpacing: "0.22em", color: GOLD }}
            >
              O que fazer essa semana
            </div>
            <ol
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${HAIR}`, listStyle: "none", padding: 0, margin: 0 }}
            >
              {actions.map((a, i) => {
                const impactColor = a.impactoTipo === "ganho" ? "#1f6b3a" : "#8a2433";
                const ImpactIcon = a.impactoTipo === "ganho" ? TrendingUp : TrendingDown;
                return (
                  <li
                    key={i}
                    className="p-3 sm:p-3.5"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${HAIR}` }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="shrink-0 grid place-items-center rounded-lg tabular-nums"
                        style={{
                          width: 26,
                          height: 26,
                          background: NAVY,
                          color: "#fbf7ee",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {a.vehicleName && <VehiclePill name={a.vehicleName} slug={a.brandSlug} size="sm" />}
                          <PriorityChip p={a.prioridade} />
                        </div>
                        <div className="text-[13.5px] font-semibold leading-snug" style={{ color: NAVY }}>
                          {a.titulo}
                        </div>
                        <div className="text-[12.5px] leading-snug mt-1" style={{ color: INK }}>
                          {a.detalhe}
                        </div>
                        <div
                          className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-[12px] font-semibold tabular-nums"
                          style={{
                            background: a.impactoTipo === "ganho" ? "rgba(31,107,58,0.10)" : "rgba(138,36,51,0.10)",
                            border: `1px solid ${a.impactoTipo === "ganho" ? "rgba(31,107,58,0.30)" : "rgba(138,36,51,0.30)"}`,
                            color: impactColor,
                          }}
                        >
                          <ImpactIcon size={12} />
                          {a.impacto}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Briefing prose. collapsed when structured data exists */}
        {paragraphs.length > 0 && (
          <div className="mt-2">
            {hasStructured && (
              <button
                onClick={() => setShowFullText((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase px-2.5 py-2 rounded-md min-h-[36px]"
                style={{
                  letterSpacing: "0.14em",
                  color: NAVY,
                  background: "rgba(13,29,46,0.05)",
                  border: `1px solid ${HAIR}`,
                }}
              >
                {showFullText ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {showFullText ? "Ocultar análise completa" : "Ler análise completa"}
              </button>
            )}

            {(showFullText || !hasStructured) && (
              <div
                className="space-y-3.5 mt-4"
                style={{
                  fontFamily:
                    '"Söhne", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
                  fontSize: "14.5px",
                  lineHeight: 1.72,
                  letterSpacing: "-0.005em",
                  fontWeight: 420,
                  color: INK,
                }}
              >
                {paragraphs.map((segs, i) => (
                  <p key={i}>
                    {segs.map((s, j) => {
                      if (s.kind === "brand") return <VehiclePill key={j} name={s.value} slug={s.slug} />;
                      if (s.kind === "bold")
                        return (
                          <strong key={j} style={{ fontWeight: 650, color: NAVY }}>
                            {s.value}
                          </strong>
                        );
                      return <span key={j}>{s.value}</span>;
                    })}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && paragraphs.length === 0 && !hasStructured && (
          <p style={{ color: MUTED, fontStyle: "italic" }}>Carregando análise...</p>
        )}
      </div>
    </div>
  );
}
