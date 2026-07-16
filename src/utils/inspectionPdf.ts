import jsPDF from "jspdf";
import { parseDateOnly } from "@/lib/dateOnly";
import { getSignedInspectionUrl } from "@/lib/inspectionStorage";

type InspectionData = {
  type: "checkin" | "checkout";
  booking: any;
  vehicle: any;
  inspection: any;
};

const ACCESSORIES_LABELS: Record<string, string> = {
  jack: "Macaco",
  antenna: "Antena",
  first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe",
  triangle: "Triângulo",
  floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};

const SEVERITY_LABELS: Record<string, string> = {
  light: "Leve", medium: "Moderada", heavy: "Grave",
};

async function loadImageAsBase64(value: string): Promise<string | null> {
  try {
    const resolved = (await getSignedInspectionUrl(value)) || value;
    const res = await fetch(resolved);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInspectionPDF(data: InspectionData): Promise<void> {
  const { type, booking, vehicle, inspection } = data;
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primaryColor = [30, 58, 95] as [number, number, number];
  const goldColor = [191, 155, 48] as [number, number, number];
  const grayColor = [120, 120, 120] as [number, number, number];
  const lightGray = [240, 240, 240] as [number, number, number];

  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GODRIVE", margin, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(type === "checkin" ? "RELATÓRIO DE ENTREGA DO VEÍCULO" : "RELATÓRIO DE DEVOLUÇÃO DO VEÍCULO", margin, 23);
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 30);

  // ID badge
  doc.setFillColor(...goldColor);
  doc.roundedRect(pageW - margin - 50, 8, 50, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("INSPEÇÃO", pageW - margin - 48, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(inspection.id?.substring(0, 8).toUpperCase() || "---", pageW - margin - 48, 23);

  y = 42;

  // Section helper
  const section = (title: string) => {
    checkPage(20);
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  const labelValue = (label: string, value: string, xOffset = 0) => {
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, margin + xOffset, y);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(value || "—", margin + xOffset, y + 5);
  };

  // Booking Info
  section("DADOS DA RESERVA");
  labelValue("Cliente", booking.customer_name);
  labelValue("E-mail", booking.customer_email || "—", contentW / 2);
  y += 12;
  labelValue("Telefone", booking.customer_phone || "—");
  labelValue("Veículo", vehicle?.name || "Não vinculado", contentW / 2);
  y += 12;
  labelValue("Retirada", `${parseDateOnly(booking.pickup_date).toLocaleDateString("pt-BR")} — ${booking.pickup_location || "—"}`);
  y += 7;
  labelValue("Devolução", `${parseDateOnly(booking.return_date).toLocaleDateString("pt-BR")} — ${booking.return_location || "—"}`);
  y += 12;

  // Odometer & Fuel
  section("ODÔMETRO & COMBUSTÍVEL");
  labelValue("Odômetro (mi)", inspection.odometer_reading?.toLocaleString("pt-BR") || "—");
  labelValue("Nível de Combustível", FUEL_LABELS[inspection.fuel_level] || inspection.fuel_level || "—", contentW / 2);
  y += 14;

  // Fuel gauge bar
  const fuelPcts: Record<string, number> = {
    empty: 0, "1/8": 12.5, "1/4": 25, "3/8": 37.5,
    "1/2": 50, "5/8": 62.5, "3/4": 75, "7/8": 87.5, full: 100,
  };
  const fuelPct = fuelPcts[inspection.fuel_level] ?? 100;
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentW, 5, 2, 2, "F");
  if (fuelPct > 0) {
    const fuelColor = fuelPct > 50 ? [34, 197, 94] : fuelPct > 25 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(fuelColor[0], fuelColor[1], fuelColor[2]);
    doc.roundedRect(margin, y, contentW * (fuelPct / 100), 5, 2, 2, "F");
  }
  y += 10;

  // Accessories
  section("CHECKLIST DE ACESSÓRIOS");
  const accCheck = (inspection.accessories_check as Record<string, boolean>) || {};
  const accEntries = Object.entries(ACCESSORIES_LABELS);
  const colW = contentW / 3;
  accEntries.forEach((entry, i) => {
    if (i > 0 && i % 3 === 0) y += 7;
    const col = i % 3;
    const checked = accCheck[entry[0]] !== false;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(checked ? 34 : 200, checked ? 150 : 50, checked ? 34 : 50);
    doc.text(`${checked ? "✓" : "✗"} ${entry[1]}`, margin + col * colW, y);
  });
  y += 12;

  // Damages
  const damages = (inspection.damages as any[]) || [];
  section(`AVARIAS (${damages.length})`);
  if (damages.length === 0) {
    doc.setTextColor(34, 150, 34);
    doc.setFontSize(9);
    doc.text("✓ Nenhuma avaria registrada", margin, y);
    y += 8;
  } else {
    for (const d of damages) {
      checkPage(25);
      doc.setFillColor(255, 245, 245);
      doc.roundedRect(margin, y - 2, contentW, 18, 2, 2, "F");
      doc.setTextColor(200, 50, 50);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`⚠ ${d.position} — ${SEVERITY_LABELS[d.severity] || d.severity}`, margin + 3, y + 3);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");
      doc.text(d.description || "Sem descrição", margin + 3, y + 10);
      y += 22;
    }
  }

  // Photos
  const photos = (inspection.exterior_photos as any[]) || [];
  if (photos.length > 0) {
    doc.addPage();
    y = margin;
    section("REGISTRO FOTOGRÁFICO");

    let col = 0;
    const imgW = (contentW - 5) / 2;
    const imgH = imgW * 0.65;

    for (const photo of photos) {
      checkPage(imgH + 15);
      const base64 = await loadImageAsBase64(photo.url);
      const xPos = margin + col * (imgW + 5);

      if (base64) {
        try {
          doc.addImage(base64, "JPEG", xPos, y, imgW, imgH);
        } catch {
          doc.setFillColor(...lightGray);
          doc.rect(xPos, y, imgW, imgH, "F");
          doc.setTextColor(...grayColor);
          doc.setFontSize(8);
          doc.text("Imagem indisponível", xPos + 10, y + imgH / 2);
        }
      }

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(7);
      doc.text(photo.position, xPos, y + imgH + 4);

      col++;
      if (col >= 2) {
        col = 0;
        y += imgH + 10;
      }
    }
    if (col !== 0) y += imgH + 10;
  }

  // Notes
  if (inspection.notes) {
    checkPage(30);
    section("OBSERVAÇÕES");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(inspection.notes, contentW - 6);
    doc.text(lines, margin + 3, y);
    y += lines.length * 5 + 5;
  }

  // Signatures
  checkPage(80);
  section("ASSINATURAS");
  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Ao assinar, ambas as partes declaram estar de acordo com o estado do veículo documentado.", margin, y);
  y += 8;

  const sigW = (contentW - 10) / 2;
  const sigH = 30;

  // Agent
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, sigW, sigH);
  if (inspection.agent_signature) {
    try {
      doc.addImage(inspection.agent_signature, "PNG", margin + 2, y + 2, sigW - 4, sigH - 4);
    } catch { /* skip */ }
  }
  doc.setTextColor(...grayColor);
  doc.setFontSize(7);
  doc.text("Assinatura do Agente", margin, y + sigH + 4);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(inspection.agent_name || "—", margin, y + sigH + 9);

  // Customer
  doc.rect(margin + sigW + 10, y, sigW, sigH);
  if (inspection.customer_signature) {
    try {
      doc.addImage(inspection.customer_signature, "PNG", margin + sigW + 12, y + 2, sigW - 4, sigH - 4);
    } catch { /* skip */ }
  }
  doc.setTextColor(...grayColor);
  doc.setFontSize(7);
  doc.text("Assinatura do Cliente", margin + sigW + 10, y + sigH + 4);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(booking.customer_name, margin + sigW + 10, y + sigH + 9);

  y += sigH + 15;

  // Completion date
  if (inspection.completed_at) {
    doc.setTextColor(...grayColor);
    doc.setFontSize(7);
    doc.text(`Inspeção finalizada em: ${new Date(inspection.completed_at).toLocaleString("pt-BR")}`, margin, y);
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...primaryColor);
    doc.rect(0, 290, pageW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("GoDrive — Inspeção Veicular", margin, 294.5);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin - 25, 294.5);
  }

  const fileName = `inspecao-${type === "checkin" ? "entrega" : "devolucao"}-${booking.customer_name.replace(/\s/g, "_")}.pdf`;
  doc.save(fileName);
}
