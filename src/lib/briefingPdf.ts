import jsPDF from "jspdf";
import { CAR_BRANDS, carLogoUrl, findBrandByName } from "@/data/carBrands";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Brand detection (same regex idea as the renderer) -------------------
const brandSource =
  "\\b(" +
  CAR_BRANDS.map((b) => b.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|") +
  ")\\b";

type Tok = { text: string; bold: boolean; brandSlug?: string };

function tokenize(paragraph: string): Tok[] {
  const out: Tok[] = [];
  const boldParts = paragraph.split(/\*\*(.+?)\*\*/g);
  boldParts.forEach((part, i) => {
    if (!part) return;
    const isBold = i % 2 === 1;
    const re = new RegExp(brandSource, "gi");
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) {
      const start = m.index;
      if (start > cursor) {
        out.push(...wordTokens(part.slice(cursor, start), isBold));
      }
      const brandName = m[1];
      const brand = findBrandByName(brandName);
      let end = start + m[0].length;
      const tail = part.slice(end);
      const ext = tail.match(/^(?:\s+[A-Z0-9][A-Za-z0-9\-/]*){1,5}/);
      let fullName = brandName;
      if (ext) {
        fullName = brandName + ext[0];
        end += ext[0].length;
      }
      // Whole brand+model stays as one token so its logo sits next to it
      out.push({
        text: fullName.replace(/\s+/g, " ").trim(),
        bold: true,
        brandSlug: brand?.slug,
      });
      cursor = end;
      re.lastIndex = end;
    }
    if (cursor < part.length) {
      out.push(...wordTokens(part.slice(cursor), isBold));
    }
  });
  return out;
}

function wordTokens(s: string, bold: boolean): Tok[] {
  // Split on whitespace but keep words as tokens; we re-add a space separator at draw time.
  return s
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => ({ text: w, bold }));
}


// --- Image cache for brand logos -----------------------------------------
const logoCache = new Map<string, string | null>();

async function loadLogoDataUrl(slug: string): Promise<string | null> {
  if (logoCache.has(slug)) return logoCache.get(slug)!;
  try {
    const res = await fetch(carLogoUrl(slug));
    if (!res.ok) {
      logoCache.set(slug, null);
      return null;
    }
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    logoCache.set(slug, dataUrl);
    return dataUrl;
  } catch {
    logoCache.set(slug, null);
    return null;
  }
}

// --- Renderer -------------------------------------------------------------
type Opts = { briefing: string; contextLabel?: string };

export async function exportBriefingToPdf({ briefing, contextLabel }: Opts) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Layout grid
  const marginX = 56;
  const marginTop = 96;
  const marginBottom = 64;
  const contentW = pageW - marginX * 2;

  // Pre-load all brand logos used
  const slugs = new Set<string>();
  briefing.split(/\n+/).forEach((line) => {
    tokenize(line).forEach((t) => {
      if (t.brandSlug) slugs.add(t.brandSlug);
    });
  });
  await Promise.all(Array.from(slugs).map(loadLogoDataUrl));

  let pageNum = 1;

  const drawChrome = () => {
    // Top brand bar
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageW, 56, "F");
    doc.setFillColor(212, 175, 55); // gold accent
    doc.rect(0, 56, pageW, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RENTAL STUDIO", marginX, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(212, 175, 55);
    doc.text("RENTAL CAR", marginX + 38, 34);

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8.5);
    doc.text("AI Studio · Briefing Executivo", pageW - marginX, 34, { align: "right" });

    // Footer
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageH - marginBottom + 18, pageW - marginX, pageH - marginBottom + 18);

    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Confidencial · Sua Marca", marginX, pageH - marginBottom + 34);
    doc.text(`Página ${pageNum}`, pageW - marginX, pageH - marginBottom + 34, { align: "right" });
  };

  // Cursor
  let y = marginTop;

  const newPage = () => {
    doc.addPage();
    pageNum += 1;
    drawChrome();
    y = marginTop;
  };

  const ensureSpace = (h: number) => {
    if (y + h > pageH - marginBottom) newPage();
  };

  drawChrome();

  // ============ TITLE BLOCK ============
  doc.setTextColor(10, 10, 10);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(140, 140, 140);
  doc.text("BRIEFING EXECUTIVO", marginX, y);
  y += 22;

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(10, 10, 10);
  doc.text("O que a sua IA está vendo agora", marginX, y, { maxWidth: contentW });
  y += 38;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(120, 120, 120);
  const dateStr = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(
    `${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}${contextLabel ? ` · ${contextLabel}` : ""}`,
    marginX,
    y
  );
  y += 12;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 8, marginX + contentW, y + 8);
  y += 28;

  // ============ BODY ============
  const bodySize = 11;
  const lineH = bodySize * 1.55;
  const spaceW = (() => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    return doc.getTextWidth(" ");
  })();

  const paragraphs = briefing
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    const tokens = tokenize(para);

    // Group brand+next-token cluster widths so logos render inline cleanly
    let x = marginX;
    ensureSpace(lineH);

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      doc.setFont("helvetica", t.bold ? "bold" : "normal");
      doc.setFontSize(bodySize);

      const logoData = t.brandSlug ? logoCache.get(t.brandSlug) ?? null : null;
      const logoSize = 10;
      const logoGap = 3;
      const textW = doc.getTextWidth(t.text);
      const tokenW = (logoData ? logoSize + logoGap : 0) + textW;

      // Wrap if needed
      if (x + tokenW > marginX + contentW) {
        y += lineH;
        ensureSpace(lineH);
        x = marginX;
      }

      if (logoData) {
        try {
          doc.addImage(logoData, "PNG", x, y - logoSize + 1.5, logoSize, logoSize, undefined, "FAST");
        } catch {
          // ignore broken logo
        }
        x += logoSize + logoGap;
      }

      doc.setTextColor(25, 25, 25);
      doc.text(t.text, x, y);
      x += textW;

      // Trailing space if next token exists and fits
      if (i < tokens.length - 1) {
        if (x + spaceW <= marginX + contentW) {
          x += spaceW;
        } else {
          y += lineH;
          ensureSpace(lineH);
          x = marginX;
        }
      }
    }

    // Paragraph spacing
    y += lineH + 8;
  }

  // ============ SIGNOFF BAR ============
  ensureSpace(60);
  y += 8;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(marginX, y, marginX + 40, y);
  y += 18;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Gerado por AI Studio · Inteligência operacional para a frota Sua Marca.", marginX, y);

  // Save
  const fileName = `Sua Marca-Brain-Briefing-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(fileName);
}
