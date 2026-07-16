import { jsPDF } from "jspdf";

/**
 * PDF profissional do Painel Inteligente.
 * Layout construido pixel-a-pixel com jsPDF (nao e screenshot).
 * Paleta "private bank": navy + dourado + creme.
 */

export type FleetReport = {
  brandLabel: string;
  generatedAt: Date;
  hero: {
    paretoShare: number;
    paretoCars: number;
    paretoTail: number;
    totalCars: number;
    lostRevenue: { total: number; cancelled: number; idle: number };
    champion: { name: string; roi: number; invested: number; revenue: number } | null;
    worst: { name: string; roi: number; invested: number; revenue: number } | null;
    margin: number;
  };
  kpis: {
    revPAC: number;
    adr: number;
    margin: number;
    mtd: number;
    lmtd: number;
    deltaPct: number;
  };
  fleet: {
    revenue: number;
    expenses: number;
    invested: number;
    roi: number;
    occupancy: number;
    size: number;
  };
  topVehicles: Array<{ name: string; invested: number; revenue: number; roi: number; days: number }>;
  worstVehicles: Array<{ name: string; invested: number; revenue: number; roi: number; days: number }>;
  actions: Array<{ titulo: string; detalhe: string; impacto: string; prioridade: "alta" | "media" | "baixa" }>;
};

type RGB = [number, number, number];

const NAVY: RGB = [13, 29, 46];
const GOLD: RGB = [184, 146, 74];
const GOLD_L: RGB = [214, 191, 134];
const CREAM: RGB = [251, 247, 238];
const CREAM_D: RGB = [243, 235, 212];
const INK: RGB = [24, 35, 52];
const MUTED: RGB = [110, 120, 140];
const ROSE: RGB = [156, 45, 70];
const EMERALD: RGB = [43, 120, 80];

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtUSD2 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export async function exportFleetReportPdf(report: FleetReport, filename = "relatorio-frota.pdf") {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 40;

  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);

  const contentTop = 96;
  const contentBottom = H - 44;
  let y = contentTop;

  const paintBg = () => {
    setFill(CREAM);
    pdf.rect(0, 0, W, H, "F");
  };
  paintBg();

  const newPage = () => {
    pdf.addPage();
    paintBg();
    y = contentTop;
  };
  const ensure = (h: number) => {
    if (y + h > contentBottom) newPage();
  };

  const sectionTitle = (label: string) => {
    ensure(28);
    setText(GOLD);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(label.toUpperCase(), M, y, { charSpace: 2.5 });
    setDraw(GOLD);
    pdf.setLineWidth(0.5);
    pdf.line(M, y + 6, W - M, y + 6);
    y += 22;
  };

  /* ---------- HERO 2x2 ---------- */
  sectionTitle("Destaques da frota");

  const gap = 12;
  const cardW = (W - M * 2 - gap) / 2;
  const cardH = 130;

  const drawHeroCard = (
    x: number,
    yy: number,
    eyebrow: string,
    big: string,
    headline: string,
    sub: string,
  ) => {
    setFill([255, 255, 255]);
    pdf.roundedRect(x, yy, cardW, cardH, 8, 8, "F");
    setDraw(GOLD);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, yy, cardW, cardH, 8, 8, "S");

    setText(GOLD);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.text(eyebrow.toUpperCase(), x + 16, yy + 22, { charSpace: 1.8 });

    setText(INK);
    pdf.setFont("helvetica", "normal");
    // shrink font if too wide
    let fs = 26;
    pdf.setFontSize(fs);
    while (pdf.getTextWidth(big) > cardW - 32 && fs > 14) {
      fs -= 1;
      pdf.setFontSize(fs);
    }
    pdf.text(big, x + 16, yy + 56);

    setText(INK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    const headLines = pdf.splitTextToSize(headline, cardW - 32) as string[];
    pdf.text(headLines, x + 16, yy + 78);

    setText(MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const subLines = pdf.splitTextToSize(sub, cardW - 32) as string[];
    pdf.text(subLines, x + 16, yy + 78 + headLines.length * 11 + 6);
  };

  ensure(cardH * 2 + gap);
  const h = report.hero;

  drawHeroCard(
    M,
    y,
    "Concentração de receita",
    `${Math.round(h.paretoShare)}%`,
    `da receita vem de ${h.paretoCars} carros`,
    `Os outros ${h.paretoTail} carros mal se pagam. Frota total: ${h.totalCars}.`,
  );
  drawHeroCard(
    M + cardW + gap,
    y,
    "Dinheiro que ficou na mesa",
    fmtUSD(h.lostRevenue.total),
    "receita perdida sem ninguém perceber",
    `${fmtUSD(h.lostRevenue.cancelled)} em cancelamentos · ${fmtUSD(h.lostRevenue.idle)} em janelas ociosas entre reservas.`,
  );
  y += cardH + gap;

  const champTxt = h.champion ? `${h.champion.roi.toFixed(0)}%` : ".";
  const worstTxt = h.worst ? `${h.worst.roi.toFixed(0)}%` : ".";
  drawHeroCard(
    M,
    y,
    "Campeão × pior",
    `${champTxt}  vs  ${worstTxt}`,
    h.champion && h.worst ? `${h.champion.name} × ${h.worst.name}` : ".",
    h.champion && h.worst
      ? `Investido: ${fmtUSD(h.champion.invested)} × ${fmtUSD(h.worst.invested)}. O mesmo capital rendendo mundos diferentes.`
      : "Frota ainda com pouco histórico.",
  );
  drawHeroCard(
    M + cardW + gap,
    y,
    "Margem de lucro",
    `${h.margin.toFixed(1)}%`,
    "da receita vira lucro",
    `Receita ${fmtUSD(report.fleet.revenue)} · Despesas ${fmtUSD(report.fleet.expenses)}.`,
  );
  y += cardH + 24;

  /* ---------- KPI STRIP (navy cards) ---------- */
  sectionTitle("Indicadores da frota");
  const kpiN = 4;
  const kpiW = (W - M * 2 - gap * (kpiN - 1)) / kpiN;
  const kpiH = 66;
  ensure(kpiH);
  const kpiData = [
    { l: "Receita / carro / dia", v: fmtUSD2(report.kpis.revPAC) },
    { l: "Diária média", v: fmtUSD(report.kpis.adr) },
    { l: "Margem", v: `${report.kpis.margin.toFixed(1)}%` },
    {
      l: "Mês até hoje",
      v: fmtUSD(report.kpis.mtd),
    },
  ];
  kpiData.forEach((k, i) => {
    const x = M + i * (kpiW + gap);
    setFill(NAVY);
    pdf.roundedRect(x, y, kpiW, kpiH, 6, 6, "F");
    setText(GOLD_L);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text(k.l.toUpperCase(), x + 12, y + 18, { charSpace: 1.4 });
    setText(CREAM);
    pdf.setFont("helvetica", "normal");
    let fs = 18;
    pdf.setFontSize(fs);
    while (pdf.getTextWidth(k.v) > kpiW - 24 && fs > 10) {
      fs -= 1;
      pdf.setFontSize(fs);
    }
    pdf.text(k.v, x + 12, y + 46);
  });
  // MTD sub-line
  setText(MUTED);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  const deltaSign = report.kpis.deltaPct >= 0 ? "+" : "";
  pdf.text(
    `Mês passado no mesmo dia: ${fmtUSD(report.kpis.lmtd)} (${deltaSign}${report.kpis.deltaPct.toFixed(1)}%)`,
    W - M,
    y + kpiH + 12,
    { align: "right" },
  );
  y += kpiH + 30;

  /* ---------- FLEET NUMBERS ---------- */
  sectionTitle("Números da frota");
  ensure(40);
  setText(INK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const fleetLine =
    `${report.fleet.size} carros · investido ${fmtUSD(report.fleet.invested)} · ` +
    `receita ${fmtUSD(report.fleet.revenue)} · despesas ${fmtUSD(report.fleet.expenses)} · ` +
    `retorno ${report.fleet.roi.toFixed(1)}% · ocupação média ${report.fleet.occupancy.toFixed(0)}%`;
  const flLines = pdf.splitTextToSize(fleetLine, W - M * 2) as string[];
  pdf.text(flLines, M, y);
  y += flLines.length * 13 + 18;

  /* ---------- TOP × WORST TABLES ---------- */
  sectionTitle("Melhores × piores retornos");
  const tblW = (W - M * 2 - gap) / 2;
  const drawTable = (
    x: number,
    title: string,
    rows: FleetReport["topVehicles"],
    positive: boolean,
  ) => {
    const rowH = 26;
    const headerH = 26;
    const totalH = headerH + rowH * Math.max(rows.length, 1) + 10;
    setFill([255, 255, 255]);
    pdf.roundedRect(x, y, tblW, totalH, 6, 6, "F");
    setDraw(positive ? EMERALD : ROSE);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(x, y, tblW, totalH, 6, 6, "S");

    setText(positive ? EMERALD : ROSE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(title.toUpperCase(), x + 12, y + 17, { charSpace: 1.5 });

    let ry = y + headerH + 12;
    if (!rows.length) {
      setText(MUTED);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      pdf.text("Sem dados suficientes.", x + 12, ry);
      return totalH;
    }
    rows.forEach((r, i) => {
      if (i % 2 === 0) {
        setFill(CREAM_D);
        pdf.rect(x + 6, ry - 12, tblW - 12, rowH - 2, "F");
      }
      setText(INK);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      const nm = r.name.length > 30 ? r.name.slice(0, 28) + "…" : r.name;
      pdf.text(nm, x + 12, ry);
      setText(MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.8);
      pdf.text(
        `Investido ${fmtUSD(r.invested)} · Receita ${fmtUSD(r.revenue)} · ${r.days}d`,
        x + 12,
        ry + 11,
      );
      setText(positive ? EMERALD : ROSE);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(`${r.roi.toFixed(0)}%`, x + tblW - 12, ry + 4, { align: "right" });
      ry += rowH;
    });
    return totalH;
  };
  const needTbl = 26 + 26 + Math.max(report.topVehicles.length, report.worstVehicles.length, 1) * 26 + 10;
  ensure(needTbl);
  const h1 = drawTable(M, "Melhores retornos", report.topVehicles, true);
  const h2 = drawTable(M + tblW + gap, "Piores retornos", report.worstVehicles, false);
  y += Math.max(h1, h2) + 26;

  /* ---------- ACTIONS ---------- */
  sectionTitle("Recomendações da semana");
  if (!report.actions.length) {
    ensure(30);
    setText(MUTED);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9.5);
    pdf.text("Nenhuma ação urgente identificada nesta semana.", M, y);
    y += 20;
  } else {
    report.actions.forEach((a) => {
      const priColor: RGB = a.prioridade === "alta" ? ROSE : a.prioridade === "media" ? GOLD : MUTED;
      const detailLines = pdf.splitTextToSize(a.detalhe, W - M * 2 - 22) as string[];
      const blockH = 18 + detailLines.length * 11 + 18;
      ensure(blockH + 6);

      setFill(priColor);
      pdf.rect(M, y - 10, 3, blockH - 2, "F");

      setText(INK);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.text(a.titulo, M + 12, y);

      setText(priColor);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text(a.prioridade.toUpperCase(), W - M, y, { align: "right", charSpace: 1.2 });

      setText(MUTED);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(detailLines, M + 12, y + 13);

      setText(EMERALD);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.text(a.impacto, M + 12, y + 15 + detailLines.length * 11 + 4);

      y += blockH + 6;
    });
  }

  /* ---------- HEADERS/FOOTERS on all pages ---------- */
  const totalPages = (pdf as any).internal.pages.length - 1;
  const drawHeader = () => {
    setFill(NAVY);
    pdf.rect(0, 0, W, 72, "F");
    setFill(GOLD);
    pdf.rect(0, 72, W, 1.5, "F");

    setText(GOLD_L);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(report.brandLabel.toUpperCase(), M, 28, { charSpace: 3.5 });

    setText(CREAM);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Relatório Executivo da Frota", M, 54);

    setText(GOLD_L);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const d = report.generatedAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    pdf.text(d, W - M, 54, { align: "right" });
    pdf.setFontSize(8);
    pdf.text("Análise gerada por IA · dados reais da operação", W - M, 28, {
      align: "right",
      charSpace: 1,
    });
  };
  const drawFooter = (pageIdx: number, total: number) => {
    setText(MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Página ${pageIdx} de ${total}`, W - M, H - 20, { align: "right" });
    pdf.text("Confidencial · uso interno", M, H - 20);
  };
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawHeader();
    drawFooter(i, totalPages);
  }

  pdf.save(filename);
}
