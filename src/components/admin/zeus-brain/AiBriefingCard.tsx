import { Brain, FileDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CAR_BRANDS, carLogoUrl, findBrandByName } from "@/data/carBrands";
import { exportPainelPdf } from "@/lib/exportPainelPdf";

type Props = {
  briefing: string | null;
  loading: boolean;
  contextLabel?: string;
};

// Build a regex once that matches any known brand name (longest first, case-insensitive)
const brandSource =
  "\\b(" +
  CAR_BRANDS.map((b) => b.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|") +
  ")\\b";

type Seg = { kind: "text" | "bold" | "brand"; value: string; slug?: string };

/** Parse a paragraph into segments: bold (**…**) and brand+model "signature" tokens. */
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

/** Extract brand mentions and extend through following model tokens (capitalized / numeric). */
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
    // Extend through up to 5 trailing model tokens (uppercase letters / digits / hyphenated)
    const tail = text.slice(end);
    const ext = tail.match(/^(?:\s+[A-Z0-9][A-Za-z0-9\-/]*){1,5}/);
    let fullName = brandName;
    if (ext) {
      fullName = brandName + ext[0];
      end += ext[0].length;
    }
    segs.push({
      kind: "brand",
      value: fullName.replace(/\s+/g, " ").trim(),
      slug: brand?.slug,
    });
    cursor = end;
    re.lastIndex = end;
  }
  if (cursor < text.length) {
    segs.push({ kind: bold ? "bold" : "text", value: text.slice(cursor) });
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
    setExporting(true);
    try {
      const target =
        (document.querySelector(".ai-shell") as HTMLElement | null) ??
        (document.body as HTMLElement);
      await exportPainelPdf({ target, filename: "zeus-brain-painel.pdf" });
    } finally {
      setExporting(false);
    }
  };

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
      {/* subtle gold wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(700px circle at 0% 0%, rgba(154,122,58,0.10), transparent 55%)",
        }}
      />

      <div className="relative p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-3.5">
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
            <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
              <div
                className="text-[10px] uppercase font-semibold pt-1"
                style={{ letterSpacing: "0.22em", color: "rgba(13,29,46,0.55)" }}
              >
                {loading ? "Analisando dados da sua frota..." : "O que a IA está vendo agora"}
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
                  title="Salvar o painel completo como PDF (réplica fiel da tela)"
                >
                  {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} style={{ color: "#d6bf86" }} />}
                  <span>{exporting ? "Gerando PDF" : "Salvar PDF"}</span>
                </button>
              )}
            </div>

            {/* Briefing body — editorial typography */}
            <div
              className="space-y-3.5"
              style={{
                fontFamily:
                  '"Söhne", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
                fontSize: "14.5px",
                lineHeight: 1.72,
                letterSpacing: "-0.005em",
                fontWeight: 420,
                color: "rgba(13,29,46,0.86)",
              }}
            >
              {paragraphs.length === 0 && (
                <p style={{ color: "rgba(13,29,46,0.50)", fontStyle: "italic" }}>
                  Carregando análise...
                </p>
              )}
              {paragraphs.map((segs, i) => (
                <p key={i}>
                  {segs.map((s, j) => {
                    if (s.kind === "brand") {
                      return (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1.5 mx-[1.5px] whitespace-nowrap"
                          style={{
                            padding: "3px 8px 3px 4px",
                            borderRadius: 8,
                            background:
                              "linear-gradient(180deg, #ffffff, #f4ecd9)",
                            border: "1px solid rgba(13,29,46,0.14)",
                            verticalAlign: "-0.22em",
                            boxShadow: "0 1px 2px rgba(13,29,46,0.06)",
                          }}
                        >
                          {s.slug ? (
                            <span
                              className="grid place-items-center rounded-[5px]"
                              style={{
                                width: 18,
                                height: 18,
                                background: "#fff",
                                border: "1px solid rgba(13,29,46,0.08)",
                              }}
                            >
                              <img
                                src={carLogoUrl(s.slug)}
                                alt=""
                                style={{
                                  width: 14,
                                  height: 14,
                                  objectFit: "contain",
                                  display: "block",
                                }}
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                                }}
                              />
                            </span>
                          ) : null}
                          <span
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              lineHeight: 1,
                              letterSpacing: "-0.005em",
                              color: "#0d1d2e",
                            }}
                          >
                            {s.value}
                          </span>
                        </span>
                      );
                    }
                    if (s.kind === "bold") {
                      return (
                        <strong
                          key={j}
                          style={{ fontWeight: 650, color: "#0d1d2e" }}
                        >
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
    </div>
  );
}
