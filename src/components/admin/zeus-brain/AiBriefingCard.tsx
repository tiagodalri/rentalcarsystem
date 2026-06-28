import { Brain, FileDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CAR_BRANDS, carLogoUrl, findBrandByName } from "@/data/carBrands";
import { exportBriefingToPdf } from "@/lib/briefingPdf";

type Props = {
  briefing: string | null;
  loading: boolean;
  contextLabel?: string;
};

// Build a regex once that matches any known brand name (longest first, case-insensitive)
const brandPattern = new RegExp(
  "\\b(" +
    CAR_BRANDS
      .map((b) => b.name)
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|") +
    ")\\b",
  "gi"
);

type Seg = { kind: "text" | "bold" | "brand"; value: string; slug?: string };

/** Parse a paragraph into segments: bold (**…**) and brand tokens with their logos. */
function parseParagraph(line: string): Seg[] {
  // First strip stray ** markers by splitting on **
  const boldParts = line.split(/\*\*(.+?)\*\*/g);
  const out: Seg[] = [];
  boldParts.forEach((part, i) => {
    if (!part) return;
    const isBold = i % 2 === 1;
    if (isBold) {
      out.push(...splitBrands(part, true));
    } else {
      out.push(...splitBrands(part, false));
    }
  });
  return out;
}

function splitBrands(text: string, bold: boolean): Seg[] {
  const segs: Seg[] = [];
  let lastIndex = 0;
  text.replace(brandPattern, (match, _g1, offset: number) => {
    if (offset > lastIndex) {
      segs.push({ kind: bold ? "bold" : "text", value: text.slice(lastIndex, offset) });
    }
    const brand = findBrandByName(match);
    segs.push({ kind: "brand", value: match, slug: brand?.slug });
    if (bold) {
      // Bold continues across the brand token — push following bold text separately
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    segs.push({ kind: bold ? "bold" : "text", value: text.slice(lastIndex) });
  }
  return segs;
}

export function AiBriefingCard({ briefing, loading, contextLabel }: Props) {
  const [exporting, setExporting] = useState(false);

  const paragraphs = useMemo(() => {
    if (!briefing) return [] as Seg[][];
    return briefing
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseParagraph);
  }, [briefing]);

  const handlePdf = async () => {
    if (!briefing) return;
    setExporting(true);
    try {
      await exportBriefingToPdf({ briefing, contextLabel });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ai-insight">
      <div className="flex items-start gap-3">
        <div className="ai-insight-icon shrink-0"><Brain size={16} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 font-medium">
              {loading ? "Analisando dados da sua frota..." : "O que a IA está vendo agora"}
            </div>
            {briefing && !loading && (
              <button
                onClick={handlePdf}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                <span>{exporting ? "Gerando..." : "Salvar PDF"}</span>
              </button>
            )}
          </div>

          {/* Briefing body — editorial typography */}
          <div
            className="space-y-3 text-white/90"
            style={{
              fontFamily: '"Söhne", "Inter", ui-sans-serif, system-ui, sans-serif',
              fontSize: "14.5px",
              lineHeight: 1.72,
              letterSpacing: "-0.005em",
              fontWeight: 380,
            }}
          >
            {paragraphs.length === 0 && (
              <p className="text-white/60 italic">Carregando análise...</p>
            )}
            {paragraphs.map((segs, i) => (
              <p key={i} className="text-white/90">
                {segs.map((s, j) => {
                  if (s.kind === "brand") {
                    return (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 align-baseline"
                      >
                        {s.slug && (
                          <img
                            src={carLogoUrl(s.slug)}
                            alt=""
                            className="inline-block h-[14px] w-[14px] object-contain rounded-[3px] bg-white/95 p-[1px] -mb-[2px]"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span className="font-medium text-white">{s.value}</span>
                      </span>
                    );
                  }
                  if (s.kind === "bold") {
                    return (
                      <strong key={j} className="font-semibold text-white">
                        {s.value}
                      </strong>
                    );
                  }
                  return <span key={j}>{s.value}</span>;
                })}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
