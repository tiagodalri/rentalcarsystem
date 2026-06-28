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
        background:
          "linear-gradient(180deg, rgba(14,22,40,0.85) 0%, rgba(8,12,24,0.92) 100%)",
        border: "1px solid rgba(140,180,230,0.14)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.7)",
      }}
    >
      {/* subtle sapphire wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(700px circle at 0% 0%, rgba(80,130,210,0.18), transparent 55%)",
        }}
      />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div
            className="shrink-0 grid place-items-center rounded-xl"
            style={{
              width: 34,
              height: 34,
              background: "linear-gradient(135deg, rgba(120,170,230,0.22), rgba(60,100,170,0.18))",
              border: "1px solid rgba(140,180,230,0.28)",
              color: "#dce8fb",
              boxShadow: "0 0 16px rgba(80,130,210,0.25)",
            }}
          >
            <Brain size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div
                className="text-[10px] uppercase font-medium"
                style={{ letterSpacing: "0.24em", color: "rgba(200,220,250,0.7)" }}
              >
                {loading ? "Analisando dados da sua frota..." : "O que a IA está vendo agora"}
              </div>
              {briefing && !loading && (
                <button
                  onClick={handlePdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.82)",
                  }}
                >
                  {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                  <span>{exporting ? "Gerando..." : "Salvar PDF"}</span>
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
                lineHeight: 1.78,
                letterSpacing: "-0.005em",
                fontWeight: 380,
                color: "rgba(232,240,252,0.92)",
              }}
            >
              {paragraphs.length === 0 && (
                <p style={{ color: "rgba(232,240,252,0.55)", fontStyle: "italic" }}>
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
                              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                            border: "1px solid rgba(255,255,255,0.10)",
                            verticalAlign: "-0.22em",
                            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
                          }}
                        >
                          {s.slug ? (
                            <span
                              className="grid place-items-center rounded-[5px]"
                              style={{
                                width: 18,
                                height: 18,
                                background: "#fff",
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
                              fontWeight: 550,
                              lineHeight: 1,
                              letterSpacing: "-0.005em",
                              color: "#f4f7fc",
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
                          style={{ fontWeight: 620, color: "#fbfcfe" }}
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
