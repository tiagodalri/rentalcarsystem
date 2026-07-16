import jsPDF from "jspdf";
import { parseDateOnly } from "@/lib/dateOnly";

export type ContractBooking = {
  id: string;
  booking_number: string | null;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  addons?: any;
  extra_driver?: boolean | null;
  deposit_amount?: number | null;
  franchise_amount?: number | null;
};

export type ContractCustomer = {
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number?: string | null;
  driver_license?: string | null;
  driver_license_expiry?: string | null;
  nationality?: string | null;
  address?: string | null;
  house_number?: string | null;
  complement?: string | null;
  zip_code?: string | null;
};

export type ContractVehicle = {
  name: string;
  category: string;
  license_plate?: string | null;
  year?: number | null;
  color?: string | null;
  current_odometer?: number | null;
  daily_price_usd?: number | null;
};

export type ContractTemplate = {
  company_name: string;
  company_address: string;
  company_ein: string;
  header_subtitle: string;
  clauses: string[];
  disclaimer: string;
  footer_text: string;
};

export const DEFAULT_CONTRACT_TEMPLATE: ContractTemplate = {
  company_name: "GoDrive LLC",
  company_address: "Orlando, FL — EUA",
  company_ein: "—",
  header_subtitle: "CONTRATO DE LOCAÇÃO DE VEÍCULO",
  clauses: [
    "1. O LOCATÁRIO declara possuir CNH válida durante toda a vigência da locação.",
    "2. O LOCATÁRIO é responsável por danos materiais, multas de trânsito e infrações cometidas durante o período de locação.",
    "3. A devolução deve ser feita no local e horário acordados. Atrasos podem incorrer em diária adicional.",
    "4. O LOCATÁRIO se compromete a não conduzir o veículo sob efeito de álcool, drogas ou em condições que comprometam a segurança.",
    "5. Em caso de sinistro, comunicar a LOCADORA imediatamente pelo WhatsApp oficial e acionar autoridades locais.",
  ],
  disclaimer:
    "* As cláusulas acima são versão inicial e estão sujeitas a revisão jurídica final pela LOCADORA antes de serem consideradas vinculativas.",
  footer_text: "Contrato gerado eletronicamente — GoDrive",
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const fmtMoney = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

export function generateContractPdf(
  booking: ContractBooking,
  customer: ContractCustomer,
  vehicle: ContractVehicle,
  template: ContractTemplate = DEFAULT_CONTRACT_TEMPLATE,
): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primary = [30, 58, 95] as [number, number, number];
  const gold = [191, 155, 48] as [number, number, number];
  const gray = [120, 120, 120] as [number, number, number];

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text((template.company_name || "GODRIVE").toUpperCase(), margin, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(template.header_subtitle || "CONTRATO DE LOCAÇÃO DE VEÍCULO", margin, 23);
  doc.setFontSize(8);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, margin, 30);

  // Contract number badge
  doc.setFillColor(...gold);
  doc.roundedRect(pageW - margin - 50, 8, 50, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("CONTRATO Nº", pageW - margin - 48, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(booking.booking_number || "—", pageW - margin - 48, 23);

  y = 42;

  const section = (title: string) => {
    checkPage(14);
    doc.setFillColor(...primary);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 5);
    y += 10;
  };

  const row = (label: string, value: string, xOffset = 0, colW = contentW) => {
    doc.setTextColor(...gray);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(label, margin + xOffset, y);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(value || "—", colW - 2);
    doc.text(lines, margin + xOffset, y + 4);
  };

  const twoCols = (
    l1: string, v1: string,
    l2: string, v2: string,
  ) => {
    checkPage(12);
    const half = contentW / 2;
    row(l1, v1, 0, half);
    row(l2, v2, half, half);
    y += 10;
  };

  // BLOCO 1 — LOCADORA
  section("LOCADORA");
  row("Razão Social", template.company_name);
  y += 8;
  twoCols("Endereço", template.company_address, "EIN / CNPJ", template.company_ein);

  // BLOCO 2 — LOCATÁRIO
  const fullAddress = [
    customer.address,
    customer.house_number,
    customer.complement,
    customer.zip_code,
  ].filter(Boolean).join(", ") || "—";

  section("LOCATÁRIO");
  twoCols("Nome completo", customer.full_name, "Nacionalidade", customer.nationality || "—");
  twoCols("E-mail", customer.email || "—", "Telefone", customer.phone || "—");
  twoCols("Documento (CPF / Passport / ID)", customer.document_number || "—", "CNH (número)", customer.driver_license || "—");
  twoCols("Validade da CNH", fmtDate(customer.driver_license_expiry), "Endereço", fullAddress);

  // BLOCO 3 — VEÍCULO
  section("VEÍCULO");
  twoCols("Marca / Modelo", vehicle.name, "Placa", vehicle.license_plate || "—");
  twoCols("Ano", vehicle.year?.toString() || "—", "Cor", vehicle.color || "—");
  twoCols("Categoria", vehicle.category || "—", "Odômetro inicial (mi)", vehicle.current_odometer?.toLocaleString("pt-BR") || "—");

  // BLOCO 4 — LOCAÇÃO
  const pickupMs = parseDateOnly(booking.pickup_date).getTime();
  const returnMs = parseDateOnly(booking.return_date).getTime();
  const days = Math.max(1, Math.round((returnMs - pickupMs) / (1000 * 60 * 60 * 24)));

  section("LOCAÇÃO");
  twoCols(
    "Retirada",
    `${fmtDate(booking.pickup_date)} às ${booking.pickup_time || "—"}`,
    "Devolução",
    `${fmtDate(booking.return_date)} às ${booking.return_time || "—"}`,
  );
  twoCols("Local de retirada", booking.pickup_location || "—", "Local de devolução", booking.return_location || "—");
  row("Total de dias", `${days} dia(s)`);
  y += 10;

  // BLOCO 5 — VALORES
  const dailyRate = vehicle.daily_price_usd ?? (booking.total_price ? booking.total_price / days : null);
  const addonsList: string[] = [];
  if (booking.addons && typeof booking.addons === "object") {
    for (const [k, v] of Object.entries(booking.addons)) {
      if (v && v !== false && v !== 0) {
        addonsList.push(`${k}: ${typeof v === "boolean" ? "Sim" : String(v)}`);
      }
    }
  }
  if (booking.extra_driver) addonsList.push("Condutor adicional");

  section("VALORES");
  twoCols("Diária", fmtMoney(dailyRate), "Total da locação", fmtMoney(booking.total_price));
  twoCols("Caução", fmtMoney(booking.deposit_amount), "Franquia / Deductible", fmtMoney(booking.franchise_amount));
  row("Extras contratados", addonsList.length ? addonsList.join(" • ") : "Nenhum");
  y += 10;

  // BLOCO 6 — CLÁUSULAS
  section("CLÁUSULAS GERAIS");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const clauses = template.clauses && template.clauses.length ? template.clauses : DEFAULT_CONTRACT_TEMPLATE.clauses;
  for (const c of clauses) {
    checkPage(10);
    const lines = doc.splitTextToSize(c, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }
  if (template.disclaimer) {
    checkPage(8);
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    const disclaimerLines = doc.splitTextToSize(template.disclaimer, contentW);
    doc.text(disclaimerLines, margin, y);
    y += disclaimerLines.length * 3.5 + 6;
  } else {
    y += 4;
  }

  // ASSINATURAS
  checkPage(50);
  section("ASSINATURAS");
  const sigW = (contentW - 10) / 2;
  y += 12;
  doc.setDrawColor(80, 80, 80);
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 10, y, margin + contentW, y);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("LOCATÁRIO", margin, y + 5);
  doc.text("LOCADORA", margin + sigW + 10, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(customer.full_name, margin, y + 10);
  doc.text(`Doc.: ${customer.document_number || "—"}`, margin, y + 14);
  doc.text(template.company_name, margin + sigW + 10, y + 10);
  y += 22;

  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text(`Orlando, FL — ${new Date().toLocaleDateString("pt-BR")}`, margin, y);

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  const ts = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...primary);
    doc.rect(0, pageH - 7, pageW, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`${template.footer_text} — ${ts}`, margin, pageH - 2.5);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin - 25, pageH - 2.5);
  }

  doc.save(`contrato-${booking.booking_number || booking.id}.pdf`);
}
