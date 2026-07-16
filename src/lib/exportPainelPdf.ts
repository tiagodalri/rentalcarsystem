import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Captura a página inteira do AI Studio como PDF, fiel ao layout em tela.
 * Estratégia: renderiza o nó-alvo num único canvas alto, depois "fatia" em
 * páginas A4 evitando cortes no meio das linhas/cards (busca pixel mais escuro
 * próximo do limite da página = menor chance de cortar texto).
 */
export async function exportPainelPdf(opts: {
  target: HTMLElement;
  filename?: string;
}) {
  const { target, filename = "ai-studio.pdf" } = opts;

  // Aguarda imagens/fontes
  if ((document as any).fonts?.ready) {
    try { await (document as any).fonts.ready; } catch {}
  }
  await Promise.all(
    Array.from(target.querySelectorAll("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          })
    )
  );

  // Render do nó completo (mesmo o que está fora do viewport)
  const scale = Math.min(2, window.devicePixelRatio || 1.5);
  const canvas = await html2canvas(target, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#04060d",
    windowWidth: target.scrollWidth,
    windowHeight: target.scrollHeight,
    logging: false,
  });

  // PDF A4 retrato
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Margens em pontos (top maior pra header de identificação)
  const marginX = 18;
  const marginTop = 46;
  const marginBottom = 28;
  const contentW = pageW - marginX * 2;
  const contentH = pageH - marginTop - marginBottom;

  // px-por-pt na largura útil
  const pxPerPt = canvas.width / contentW;
  const sliceHpx = Math.floor(contentH * pxPerPt);

  // Helper: desenhar cabeçalho/rodapé na página atual
  const drawChrome = (pageIdx: number, totalPages: number) => {
    pdf.setFillColor(4, 6, 13);
    pdf.rect(0, 0, pageW, marginTop, "F");
    pdf.rect(0, pageH - marginBottom, pageW, marginBottom, "F");

    // Linha dourada/safira sob o header
    pdf.setDrawColor(140, 180, 230);
    pdf.setLineWidth(0.4);
    pdf.line(marginX, marginTop - 8, pageW - marginX, marginTop - 8);

    pdf.setTextColor(220, 230, 250);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("GODRIVE BRAIN", marginX, 22);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 160, 190);
    const date = new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    pdf.text(`Painel Inteligente · gerado em ${date}`, marginX, 36);

    // Rodapé
    pdf.setFontSize(8);
    pdf.setTextColor(120, 140, 170);
    pdf.text("GoDrive · Análise gerada por IA com base no histórico real da frota", marginX, pageH - 12);
    pdf.text(`${pageIdx} / ${totalPages}`, pageW - marginX, pageH - 12, { align: "right" });
  };

  // Encontra um "bom" ponto de corte (linha mais escura/uniforme próxima do limite)
  const ctx = canvas.getContext("2d");
  const findSafeCut = (startY: number, idealCut: number): number => {
    if (!ctx || idealCut >= canvas.height) return Math.min(idealCut, canvas.height);
    const searchBand = Math.min(80, Math.floor(sliceHpx * 0.06));
    const fromY = Math.max(startY + 1, idealCut - searchBand);
    const toY = Math.min(canvas.height - 1, idealCut + Math.min(searchBand, canvas.height - idealCut - 1));
    if (toY <= fromY) return idealCut;
    try {
      const band = ctx.getImageData(0, fromY, canvas.width, toY - fromY).data;
      let bestY = idealCut;
      let bestScore = Infinity;
      const w = canvas.width;
      for (let y = 0; y < toY - fromY; y++) {
        let sum = 0;
        // amostragem ao longo da linha (a cada 8 px) para performance
        for (let x = 0; x < w; x += 8) {
          const i = (y * w + x) * 4;
          sum += band[i] + band[i + 1] + band[i + 2];
        }
        // preferir linhas mais escuras (background) → corte limpo
        if (sum < bestScore) {
          bestScore = sum;
          bestY = fromY + y;
        }
      }
      return bestY;
    } catch {
      return idealCut;
    }
  };

  // Calcular páginas com cortes seguros
  const pageCuts: number[] = [0];
  let y = 0;
  while (y + sliceHpx < canvas.height) {
    const ideal = y + sliceHpx;
    const safe = findSafeCut(y, ideal);
    pageCuts.push(safe);
    y = safe;
  }
  pageCuts.push(canvas.height);

  const totalPages = pageCuts.length - 1;

  for (let i = 0; i < totalPages; i++) {
    const startY = pageCuts[i];
    const endY = pageCuts[i + 1];
    const hpx = endY - startY;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = hpx;
    const pctx = pageCanvas.getContext("2d");
    if (!pctx) continue;
    pctx.fillStyle = "#04060d";
    pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pctx.drawImage(canvas, 0, startY, canvas.width, hpx, 0, 0, canvas.width, hpx);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    drawChrome(i + 1, totalPages);

    const drawW = contentW;
    const drawH = hpx / pxPerPt;
    pdf.addImage(imgData, "JPEG", marginX, marginTop, drawW, drawH, undefined, "FAST");
  }

  pdf.save(filename);
}
