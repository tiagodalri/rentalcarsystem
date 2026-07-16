import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1";

import { buildCorsHeaders } from "../_shared/cors.ts";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSIGN_API_TOKEN = Deno.env.get("CLICKSIGN_API_TOKEN")!;
const CLICKSIGN_AUTH_TOKEN = CLICKSIGN_API_TOKEN.replace(/^Bearer\s+/i, "").trim();
const CLICKSIGN_BASE_URL = (Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://app.clicksign.com").replace(/\/$/, "");
const ZEUS_SIGNER_EMAIL = Deno.env.get("ZEUS_SIGNER_EMAIL") ?? "zeusrentalcarorlando@gmail.com";
const ZEUS_SIGNER_NAME = Deno.env.get("ZEUS_SIGNER_NAME") ?? "GoDrive";
const ZEUS_AUTO_SIGN = (Deno.env.get("ZEUS_AUTO_SIGN") ?? "false").toLowerCase() === "true";

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const fmtMoney = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const dateLong = (d: Date) =>
  `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;

async function buildPdf(booking: any, customer: any, vehicle: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvI = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const pageW = 595;
  const pageH = 842;
  const margin = 64;
  const contentW = pageW - margin * 2;

  const COLOR_TEXT = rgb(26 / 255, 26 / 255, 26 / 255);
  const COLOR_BODY = rgb(44 / 255, 44 / 255, 44 / 255);
  const COLOR_MUTED = rgb(102 / 255, 102 / 255, 102 / 255);
  const COLOR_LINE = rgb(207 / 255, 207 / 255, 207 / 255);

  const HEADER_H = 88; // reserved area at top of every page
  const FOOTER_H = 34; // reserved area at bottom of every page
  const TOP_Y = pageH - HEADER_H;
  const BOTTOM_Y = FOOTER_H + 10;

  type PageState = { page: PDFPage; y: number; isFirst: boolean };
  const pages: PageState[] = [];
  let cur: PageState;

  const drawHeader = (page: PDFPage, isFirst: boolean) => {
    // GODRIVE — letterspaced via spacing
    const titleStr = "Z E U S   R E N T A L   C A R";
    const tSize = 22;
    const tw = timesB.widthOfTextAtSize(titleStr, tSize);
    page.drawText(titleStr, {
      x: (pageW - tw) / 2,
      y: pageH - 38,
      size: tSize,
      font: timesB,
      color: COLOR_TEXT,
    });
    const sub1 = "ORLANDO  ·  FLORIDA  ·  UNITED STATES";
    const s1w = helv.widthOfTextAtSize(sub1, 9);
    page.drawText(sub1, {
      x: (pageW - s1w) / 2,
      y: pageH - 52,
      size: 9,
      font: helv,
      color: COLOR_MUTED,
    });
    if (isFirst) {
      const sub2 = "rentalcarsystem.lovable.app";
      const s2w = helv.widthOfTextAtSize(sub2, 8);
      page.drawText(sub2, {
        x: (pageW - s2w) / 2,
        y: pageH - 64,
        size: 8,
        font: helv,
        color: COLOR_MUTED,
      });
    }
    // two thin black lines
    page.drawLine({
      start: { x: margin, y: pageH - 74 },
      end: { x: pageW - margin, y: pageH - 74 },
      thickness: 0.6,
      color: COLOR_TEXT,
    });
    page.drawLine({
      start: { x: margin, y: pageH - 78 },
      end: { x: pageW - margin, y: pageH - 78 },
      thickness: 0.3,
      color: COLOR_TEXT,
    });
  };

  const newPage = () => {
    const page = pdf.addPage([pageW, pageH]);
    const isFirst = pages.length === 0;
    drawHeader(page, isFirst);
    cur = { page, y: TOP_Y, isFirst };
    pages.push(cur);
    return cur;
  };

  const ensure = (h: number) => {
    if (cur.y - h < BOTTOM_Y) {
      newPage();
    }
  };

  const wrap = (text: string, maxW: number, size: number, f: PDFFont) => {
    const lines: string[] = [];
    const paragraphs = (text || "").split(/\n/);
    for (const para of paragraphs) {
      const words = para.split(/\s+/);
      let cur2 = "";
      for (const w of words) {
        const test = cur2 ? cur2 + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW) {
          if (cur2) lines.push(cur2);
          cur2 = w;
        } else cur2 = test;
      }
      lines.push(cur2);
    }
    return lines;
  };

  const drawText = (text: string, opts: { x: number; size: number; font: PDFFont; color?: any }) => {
    cur.page.drawText(text, { x: opts.x, y: cur.y, size: opts.size, font: opts.font, color: opts.color ?? COLOR_BODY });
  };

  const para = (text: string, opts?: { size?: number; font?: PDFFont; color?: any; indent?: number; gap?: number }) => {
    const size = opts?.size ?? 10.5;
    const f = opts?.font ?? helv;
    const color = opts?.color ?? COLOR_BODY;
    const indent = opts?.indent ?? 0;
    const lineH = size * 1.35;
    const lines = wrap(text, contentW - indent, size, f);
    for (const ln of lines) {
      ensure(lineH);
      cur.page.drawText(ln, { x: margin + indent, y: cur.y - size + 1, size, font: f, color });
      cur.y -= lineH;
    }
    cur.y -= opts?.gap ?? 4;
  };

  const sectionTitle = (title: string) => {
    ensure(30);
    cur.y -= 6;
    cur.page.drawText(title.toUpperCase(), {
      x: margin, y: cur.y - 11, size: 11, font: helvB, color: COLOR_TEXT,
    });
    cur.y -= 15;
    cur.page.drawLine({
      start: { x: margin, y: cur.y },
      end: { x: pageW - margin, y: cur.y },
      thickness: 0.6,
      color: COLOR_TEXT,
    });
    cur.y -= 10;
  };

  const subTitle = (title: string) => {
    ensure(18);
    cur.page.drawText(title, { x: margin, y: cur.y - 11, size: 11, font: helvB, color: COLOR_TEXT });
    cur.y -= 16;
  };

  const fieldRow = (label: string, value: string) => {
    const size = 10;
    const lineH = 16;
    ensure(lineH);
    cur.page.drawText(label, { x: margin, y: cur.y - 10, size, font: helv, color: COLOR_MUTED });
    const labelW = helv.widthOfTextAtSize(label, size);
    const valX = margin + Math.max(labelW + 14, 170);
    const dotsStart = margin + labelW + 6;
    const dotsEnd = valX - 6;
    if (dotsEnd > dotsStart) {
      cur.page.drawLine({
        start: { x: dotsStart, y: cur.y - 11 },
        end: { x: dotsEnd, y: cur.y - 11 },
        thickness: 0.4,
        color: COLOR_LINE,
      });
    }
    const val = value || " ";
    const maxValW = pageW - margin - valX;
    const lines = wrap(val, maxValW, size, helvB);
    let yy = cur.y - 10;
    for (const ln of lines.slice(0, 2)) {
      cur.page.drawText(ln, { x: valX, y: yy, size, font: helvB, color: COLOR_TEXT });
      yy -= 12;
    }
    cur.y -= Math.max(lineH, lines.length * 12 + 4);
    // bottom thin separator line
    cur.page.drawLine({
      start: { x: margin, y: cur.y + 2 },
      end: { x: pageW - margin, y: cur.y + 2 },
      thickness: 0.3,
      color: COLOR_LINE,
    });
    cur.y -= 4;
  };

  const checkbox = (x: number, y: number, checked = false) => {
    cur.page.drawRectangle({
      x, y, width: 9, height: 9,
      borderColor: COLOR_TEXT,
      borderWidth: 0.6,
    });
    if (checked) {
      cur.page.drawText("X", { x: x + 1.5, y: y + 1, size: 8, font: helvB, color: COLOR_TEXT });
    }
  };

  const checkboxLine = (items: { label: string; checked?: boolean }[], opts?: { indent?: number }) => {
    const size = 10;
    const lineH = 16;
    const indent = opts?.indent ?? 0;
    ensure(lineH);
    let x = margin + indent;
    for (const it of items) {
      checkbox(x, cur.y - 10, it.checked);
      cur.page.drawText(it.label, { x: x + 14, y: cur.y - 9, size, font: helv, color: COLOR_BODY });
      x += 14 + helv.widthOfTextAtSize(it.label, size) + 22;
    }
    cur.y -= lineH;
  };

  const numberedList = (items: string[], opts?: { gap?: number }) => {
    const size = 10.5;
    const lineH = size * 1.35;
    items.forEach((it, idx) => {
      const prefix = `${idx + 1}. `;
      const prefixW = helv.widthOfTextAtSize(prefix, size);
      const lines = wrap(it, contentW - prefixW, size, helv);
      ensure(lineH);
      cur.page.drawText(prefix, { x: margin, y: cur.y - size + 1, size, font: helv, color: COLOR_BODY });
      cur.page.drawText(lines[0] || "", { x: margin + prefixW, y: cur.y - size + 1, size, font: helv, color: COLOR_BODY });
      cur.y -= lineH;
      for (let i = 1; i < lines.length; i++) {
        ensure(lineH);
        cur.page.drawText(lines[i], { x: margin + prefixW, y: cur.y - size + 1, size, font: helv, color: COLOR_BODY });
        cur.y -= lineH;
      }
      cur.y -= opts?.gap ?? 2;
    });
  };

  const blankLine = () => {
    ensure(18);
    cur.page.drawLine({
      start: { x: margin, y: cur.y - 12 },
      end: { x: pageW - margin, y: cur.y - 12 },
      thickness: 0.4,
      color: COLOR_LINE,
    });
    cur.y -= 18;
  };

  // ====== Page 1 ======
  newPage();

  // META row
  const today = new Date();
  const longToday = dateLong(today);
  cur.page.drawText(`Contrato Nº: ${booking.booking_number || "—"}`, {
    x: margin, y: cur.y - 10, size: 10, font: helv, color: COLOR_TEXT,
  });
  const emit = `Data de emissão: ${longToday}`;
  const ew = helv.widthOfTextAtSize(emit, 10);
  cur.page.drawText(emit, {
    x: pageW - margin - ew, y: cur.y - 10, size: 10, font: helv, color: COLOR_TEXT,
  });
  cur.y -= 28;

  // TITLE
  const title = "CONTRATO DE LOCAÇÃO DE VEÍCULO";
  const titleW = timesB.widthOfTextAtSize(title, 18);
  cur.page.drawText(title, {
    x: (pageW - titleW) / 2, y: cur.y - 18, size: 18, font: timesB, color: COLOR_TEXT,
  });
  cur.y -= 24;
  const en = "Vehicle Rental Agreement";
  const enW = helv.widthOfTextAtSize(en, 9);
  cur.page.drawText(en, {
    x: (pageW - enW) / 2, y: cur.y - 10, size: 9, font: helv, color: COLOR_MUTED,
  });
  cur.y -= 22;

  // PREÂMBULO
  para(
    "Pelo presente instrumento particular, as partes adiante qualificadas têm entre si justo e contratado o presente Contrato de Locação de Veículo, que se regerá pelas cláusulas e condições a seguir estabelecidas.",
    { size: 10.5, gap: 10 }
  );

  // 1. IDENTIFICAÇÃO DAS PARTES
  sectionTitle("1. Identificação das Partes");
  subTitle("1.1 Locadora");
  para("GoDrive · Orlando, Florida, United States", { gap: 8 });

  subTitle("1.2 Locatário");
  const fullAddress = [customer.address, customer.house_number, customer.complement, customer.zip_code]
    .filter(Boolean).join(", ");
  fieldRow("Nome completo", customer.full_name || "");
  fieldRow("Data de nascimento", customer.date_of_birth ? fmtDate(customer.date_of_birth) : "");
  fieldRow("Documento (CPF / Passport / ID)", customer.document_number || "");
  fieldRow(
    "CNH / Driver License",
    customer.driver_license
      ? `${customer.driver_license}${customer.nationality ? " — " + customer.nationality : ""}`
      : ""
  );
  fieldRow("Endereço", fullAddress);
  fieldRow("Telefone", customer.phone || "");
  fieldRow("E-mail", customer.email || "");

  subTitle("1.3 Motoristas Autorizados Adicionais");
  para("(Preencher se aplicável)", { size: 9, font: helvI, color: COLOR_MUTED, gap: 4 });
  fieldRow("Nome", "");
  fieldRow("CNH / Driver License", "");
  fieldRow("Nome", "");
  fieldRow("CNH / Driver License", "");

  // 2. VEÍCULO
  sectionTitle("2. Identificação do Veículo");
  fieldRow("Marca / Modelo", vehicle.name || `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim());
  fieldRow("Ano", vehicle.year ? String(vehicle.year) : "");
  fieldRow("Placa", vehicle.license_plate || "");
  fieldRow("Cor", vehicle.color || "");
  fieldRow("Milhagem na retirada", vehicle.current_odometer ? `${vehicle.current_odometer.toLocaleString("pt-BR")} mi` : "");

  // 3. PERÍODO
  const pickupMs = new Date(booking.pickup_date).getTime();
  const returnMs = new Date(booking.return_date).getTime();
  const days = Math.max(1, Math.round((returnMs - pickupMs) / 86400000));
  sectionTitle("3. Período da Locação");
  fieldRow("Data e hora da retirada", `${fmtDate(booking.pickup_date)} às ${booking.pickup_time || "—"}`);
  fieldRow("Data e hora da devolução prevista", `${fmtDate(booking.return_date)} às ${booking.return_time || "—"}`);
  fieldRow("Total de dias", `${days} dia(s)`);
  fieldRow("Local de retirada", booking.pickup_location || "");
  fieldRow("Local de devolução", booking.return_location || "");

  // 4. VALORES
  sectionTitle("4. Valores e Forma de Pagamento");
  fieldRow("Total da locação (USD)", fmtMoney(booking.total_price));
  fieldRow("Caução / Security Deposit", fmtMoney(booking.deposit_amount));
  fieldRow("Franquia / Deductible", fmtMoney(booking.franchise_amount));
  fieldRow("Forma de pagamento", "Cartão de crédito internacional");
  fieldRow("Cartão (últimos 4 dígitos)", "");
  fieldRow("Titular do cartão", "");

  subTitle("4.1 Extras e Opcionais");
  const addons = (booking.addons && typeof booking.addons === "object") ? booking.addons : {};
  const has = (k: string) => !!(addons[k] || addons[k.toLowerCase()]);
  checkboxLine([
    { label: "Pedágios (por uso real + taxa adm)", checked: has("tolls_usage") },
    { label: "Pacote diário de pedágios", checked: has("tolls_daily") },
  ]);
  checkboxLine([
    { label: "Seguro CDW/LDW", checked: has("cdw") || has("insurance") },
    { label: "Motorista adicional", checked: !!booking.extra_driver || has("additional_driver") },
  ]);
  checkboxLine([
    { label: "Cadeirinha infantil", checked: has("child_seat") || has("car_seat") },
    { label: "Carrinho de bebê", checked: has("stroller") },
  ]);

  // 5. CONDIÇÕES DE USO
  sectionTitle("5. Condições de Uso do Veículo");
  subTitle("5.1 Uso Permitido");
  para(
    "O veículo deve ser utilizado exclusivamente por motorista(s) autorizado(s) neste contrato, com CNH/Driver License válida e em conformidade com as leis de trânsito da Flórida e dos Estados Unidos.",
    { gap: 8 }
  );

  subTitle("5.2 Uso Proibido");
  para("É expressamente proibido:", { gap: 4 });
  numberedList([
    "Dirigir sob influência de álcool, drogas ou medicamentos que comprometam a capacidade de condução.",
    "Usar o veículo para transporte remunerado de passageiros (Uber, Lyft, táxi e similares).",
    "Permitir que terceiros não autorizados neste contrato dirijam o veículo.",
    "Usar o veículo em competições, testes de velocidade ou qualquer conduta perigosa.",
    "Transportar mais passageiros ou carga além da capacidade homologada do veículo.",
    "Usar o veículo fora dos Estados Unidos sem autorização prévia e por escrito da Locadora.",
    "Fumar dentro do veículo.",
  ]);
  cur.y -= 4;

  subTitle("5.3 Devolução");
  para(
    "O veículo deve ser devolvido com o mesmo nível de combustível registrado na retirada, sem danos além do desgaste natural de uso, no local, data e horário acordados. Em caso de atraso, será cobrada uma diária adicional completa a cada 24 (vinte e quatro) horas ou fração. Em caso de combustível faltante, o valor será cobrado por galão abastecido pela Locadora ou pelo preço de mercado vigente.",
    { gap: 8 }
  );

  // 6. RESPONSABILIDADE
  sectionTitle("6. Responsabilidade por Danos, Multas e Taxas");
  subTitle("6.1 Danos");
  para(
    "O LOCATÁRIO é INTEGRALMENTE RESPONSÁVEL por qualquer dano, perda parcial ou total, roubo ou furto do veículo durante o período de locação, incluindo o valor de franquia do seguro, se contratado.",
    { gap: 8 }
  );
  subTitle("6.2 Multas");
  para(
    "Todas as multas de trânsito, taxas de estacionamento, violações de pedágio e demais penalidades aplicadas durante o período de locação são de responsabilidade do LOCATÁRIO, mesmo que notificadas após a devolução do veículo. Será aplicada taxa administrativa de USD $25,00 a USD $50,00 por multa processada.",
    { gap: 8 }
  );
  subTitle("6.3 Pedágios");
  para(
    "O veículo é equipado com SunPass/E-Pass. O LOCATÁRIO autoriza expressamente a cobrança dos pedágios efetivamente utilizados, ou do pacote diário, conforme cláusula 4.1. Os pedágios são processados pela placa do veículo e podem ser cobrados em até 60 (sessenta) dias após a devolução.",
    { gap: 8 }
  );

  // 7. AUTORIZAÇÃO DE CARTÃO
  sectionTitle("7. Autorização de Cartão e Cobranças Posteriores");
  subTitle("7.1 Caução e Pré-Autorização");
  para(
    "O LOCATÁRIO autoriza o bloqueio do valor de caução no cartão de crédito informado, que será liberado após a vistoria final do veículo e a liquidação de eventuais débitos, em prazo de 7 (sete) a 14 (catorze) dias úteis, conforme política do banco emissor.",
    { gap: 8 }
  );
  subTitle("7.2 Card on File");
  para(
    "O LOCATÁRIO AUTORIZA EXPRESSAMENTE a GoDrive a: (i) armazenar de forma segura os dados do cartão informado; (ii) cobrar no cartão ou descontar da caução todos os valores referentes à locação; (iii) processar cobranças mesmo após a devolução do veículo, incluindo pedágios, multas, danos, combustível, extensão de locação, estacionamento, taxas administrativas e demais despesas relacionadas.",
    { gap: 8 }
  );
  para("O LOCATÁRIO declara que o cartão informado:", { gap: 4 });
  numberedList([
    "Está em seu próprio nome.",
    "Possui limite suficiente para as cobranças previstas neste contrato.",
    "É um cartão internacional válido (Visa, Mastercard, American Express ou similar).",
    "Pode ser utilizado para pré-autorizações, caução e cobranças futuras.",
  ]);
  cur.y -= 4;
  subTitle("7.3 Comprovação");
  para(
    "A GoDrive compromete-se a enviar comprovante detalhado de qualquer cobrança posterior em até 15 (quinze) dias.",
    { gap: 8 }
  );

  // 8. SEGURO
  sectionTitle("8. Seguro e Cobertura");
  subTitle("8.1 Seguro Básico");
  para(
    "O veículo possui seguro comercial básico, conforme exigido pela legislação do Estado da Flórida.",
    { gap: 8 }
  );
  subTitle("8.2 Cobertura Opcional (CDW/LDW)");
  para(
    "Caso contratada (cláusula 4.1), a franquia poderá ser reduzida ou eliminada, conforme termos da apólice. Caso não contratada, o LOCATÁRIO responde pelo valor integral dos danos causados ao veículo.",
    { gap: 8 }
  );

  // 9. VISTORIA
  sectionTitle("9. Vistoria do Veículo");
  para(
    "O LOCATÁRIO declara ter vistoriado o veículo no momento da retirada e que o mesmo se encontra em perfeitas condições de uso, limpeza e conservação, conforme checklist abaixo.",
    { gap: 6 }
  );
  const checkItems = [
    "Lataria e pintura sem avarias aparentes.",
    "Vidros, faróis e espelhos intactos.",
    "Pneus em bom estado de uso.",
    "Interior limpo e sem danos.",
    "Documentos do veículo presentes.",
  ];
  for (const ci of checkItems) {
    ensure(16);
    checkbox(margin, cur.y - 11, false);
    cur.page.drawText(ci, { x: margin + 14, y: cur.y - 10, size: 10, font: helv, color: COLOR_BODY });
    cur.y -= 16;
  }
  // chave(s)
  ensure(16);
  checkbox(margin, cur.y - 11, false);
  cur.page.drawText("Chave(s) e controle(s) recebidos:", {
    x: margin + 14, y: cur.y - 10, size: 10, font: helv, color: COLOR_BODY,
  });
  cur.page.drawText("_____ un.", {
    x: margin + 14 + helv.widthOfTextAtSize("Chave(s) e controle(s) recebidos:", 10) + 8,
    y: cur.y - 10, size: 10, font: helv, color: COLOR_BODY,
  });
  cur.y -= 20;

  // fuel level
  ensure(18);
  cur.page.drawText("Nível de combustível na retirada:", {
    x: margin, y: cur.y - 10, size: 10, font: helv, color: COLOR_MUTED,
  });
  cur.y -= 16;
  checkboxLine([
    { label: "1/4" }, { label: "1/2" }, { label: "3/4" }, { label: "Full" },
  ]);
  fieldRow("Milhagem registrada", "");
  ensure(18);
  cur.page.drawText("Fotos registradas na retirada:", {
    x: margin, y: cur.y - 10, size: 10, font: helv, color: COLOR_MUTED,
  });
  cur.y -= 16;
  checkboxLine([{ label: "Sim" }, { label: "Não" }]);

  // 10. DISPOSIÇÕES GERAIS
  sectionTitle("10. Disposições Gerais");
  subTitle("10.1 Foro");
  para("Fica eleito o foro da comarca de Orlando, Estado da Flórida, EUA, para dirimir quaisquer controvérsias decorrentes deste contrato.", { gap: 6 });
  subTitle("10.2 Validade");
  para("Este contrato é válido e vinculante a partir da assinatura por ambas as partes.", { gap: 6 });
  subTitle("10.3 Alterações");
  para("Quaisquer alterações ao presente contrato deverão ser feitas por escrito e assinadas por ambas as partes.", { gap: 6 });
  subTitle("10.4 Aceitação");
  para("Ao assinar este contrato, o LOCATÁRIO declara ter lido, compreendido e concordado integralmente com todas as suas cláusulas.", { gap: 10 });

  // 11. ASSINATURAS
  sectionTitle("11. Assinaturas");
  para(`Orlando, Florida, ${longToday}.`, { gap: 30 });

  ensure(80);
  const sigW = (contentW - 30) / 2;
  const sigY = cur.y;
  cur.page.drawLine({
    start: { x: margin, y: sigY },
    end: { x: margin + sigW, y: sigY },
    thickness: 0.6, color: COLOR_TEXT,
  });
  cur.page.drawLine({
    start: { x: margin + sigW + 30, y: sigY },
    end: { x: margin + contentW, y: sigY },
    thickness: 0.6, color: COLOR_TEXT,
  });
  cur.page.drawText("Locatário", {
    x: margin, y: sigY - 12, size: 10, font: helvB, color: COLOR_TEXT,
  });
  cur.page.drawText(customer.full_name || "—", {
    x: margin, y: sigY - 25, size: 9.5, font: helv, color: COLOR_BODY,
  });
  cur.page.drawText("Locadora", {
    x: margin + sigW + 30, y: sigY - 12, size: 10, font: helvB, color: COLOR_TEXT,
  });
  cur.page.drawText("GoDrive", {
    x: margin + sigW + 30, y: sigY - 25, size: 9.5, font: helv, color: COLOR_BODY,
  });
  cur.y -= 50;

  // ====== ANEXO I ======
  newPage();
  cur.y -= 6;
  const annexTitle = "ANEXO I — TERMO DE AUTORIZAÇÃO DE CARTÃO DE CRÉDITO";
  const atw = timesB.widthOfTextAtSize(annexTitle, 14);
  cur.page.drawText(annexTitle, {
    x: (pageW - atw) / 2, y: cur.y - 14, size: 14, font: timesB, color: COLOR_TEXT,
  });
  cur.y -= 30;

  para(
    `Eu, ${customer.full_name || "_______________________________"}, portador(a) do documento ${customer.document_number || "_______________"}, na qualidade de locatário(a) do veículo objeto do Contrato Nº ${booking.booking_number || "_______"}, autorizo a GoDrive a utilizar meu cartão de crédito abaixo identificado:`,
    { gap: 10 }
  );

  subTitle("Identificação do Cartão");
  ensure(18);
  cur.page.drawText("Bandeira:", { x: margin, y: cur.y - 10, size: 10, font: helv, color: COLOR_MUTED });
  cur.y -= 16;
  checkboxLine([
    { label: "Visa" }, { label: "Master" }, { label: "Amex" }, { label: "Outra" },
  ]);
  fieldRow("Últimos 4 dígitos", "");
  fieldRow("Validade (MM/AA)", "");
  cur.y -= 4;

  para("Para as seguintes finalidades:", { gap: 4 });
  numberedList([
    "Cobrança do valor da locação (diária e opcionais contratados).",
    "Bloqueio de caução (security deposit).",
    "Cobranças posteriores à devolução do veículo, incluindo pedágios, multas, danos, limpeza, combustível, extensão da locação, estacionamento e taxas administrativas.",
  ]);
  cur.y -= 6;

  para("Declaro estar ciente de que:", { gap: 4 });
  numberedList([
    "Os dados do cartão serão armazenados de forma segura.",
    "Poderei ser cobrado(a) em até 60 (sessenta) dias após a devolução do veículo.",
    "Serei notificado(a) por e-mail ou WhatsApp antes de qualquer cobrança adicional.",
    "Receberei comprovante de todas as transações realizadas.",
  ]);
  cur.y -= 30;

  ensure(80);
  const sigY2 = cur.y;
  cur.page.drawLine({
    start: { x: margin, y: sigY2 },
    end: { x: margin + sigW, y: sigY2 },
    thickness: 0.6, color: COLOR_TEXT,
  });
  cur.page.drawLine({
    start: { x: margin + sigW + 30, y: sigY2 },
    end: { x: margin + contentW, y: sigY2 },
    thickness: 0.6, color: COLOR_TEXT,
  });
  cur.page.drawText("Locatário", {
    x: margin, y: sigY2 - 12, size: 10, font: helvB, color: COLOR_TEXT,
  });
  cur.page.drawText(customer.full_name || "—", {
    x: margin, y: sigY2 - 25, size: 9.5, font: helv, color: COLOR_BODY,
  });
  cur.page.drawText("Locadora", {
    x: margin + sigW + 30, y: sigY2 - 12, size: 10, font: helvB, color: COLOR_TEXT,
  });
  cur.page.drawText("GoDrive", {
    x: margin + sigW + 30, y: sigY2 - 25, size: 9.5, font: helv, color: COLOR_BODY,
  });

  // ====== FOOTERS ======
  const total = pdf.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i);
    p.drawLine({
      start: { x: margin, y: 30 },
      end: { x: pageW - margin, y: 30 },
      thickness: 0.4,
      color: COLOR_TEXT,
    });
    p.drawText("GoDrive — Orlando, FL · USA", {
      x: margin, y: 18, size: 8, font: helv, color: COLOR_MUTED,
    });
    const mid = `Contrato ${booking.booking_number || "—"}`;
    const mw = helv.widthOfTextAtSize(mid, 8);
    p.drawText(mid, { x: (pageW - mw) / 2, y: 18, size: 8, font: helv, color: COLOR_MUTED });
    const pg = `Página ${i + 1} de ${total}`;
    const pw = helv.widthOfTextAtSize(pg, 8);
    p.drawText(pg, { x: pageW - margin - pw, y: 18, size: 8, font: helv, color: COLOR_MUTED });
  }

  return await pdf.save();
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

async function cs(path: string, method: string, body?: unknown) {
  const res = await fetch(`${CLICKSIGN_BASE_URL}${path}`, {
    method,
    headers: {
      "Authorization": CLICKSIGN_AUTH_TOKEN,
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/vnd.api+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    throw new Error(`Clicksign ${method} ${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return parsed;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const bearer = authHeader.replace("Bearer ", "").trim();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Allow internal service-role calls (e.g. cambioreal-webhook trigger)
    const isServiceCall = bearer === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceCall) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(bearer);
      if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
      const userId = claimsData.claims.sub;

      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (roleRows ?? []).map((r: any) => r.role);
      if (!roles.some((r) => r === "admin" || r === "operations")) {
        return json(403, { error: "Forbidden" });
      }
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = body?.booking_id;
    if (!bookingId || typeof bookingId !== "string") {
      return json(400, { error: "booking_id obrigatorio" });
    }


    const { data: booking, error: bErr } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (bErr || !booking) return json(404, { error: "Reserva nao encontrada" });

    // Cliente vinculado é opcional — se não houver, monta a partir dos campos do próprio booking
    const [{ data: linkedCustomer }, { data: vehicle }] = await Promise.all([
      booking.customer_id
        ? admin.from("customers").select("*").eq("id", booking.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("vehicles").select("*").eq("id", booking.vehicle_id).maybeSingle(),
    ]);
    if (!vehicle) return json(400, { error: "Veiculo nao encontrado" });

    const customer: any = linkedCustomer ?? {
      full_name: booking.customer_name ?? "",
      email: booking.customer_email ?? "",
      phone: booking.customer_phone ?? "",
      document_number: "",
      driver_license: "",
      date_of_birth: null,
      nationality: "",
      address: "",
      house_number: "",
      complement: "",
      zip_code: "",
    };

    // Mínimo exigido pela Clicksign para criar signatário: nome + e-mail
    const FIELD_LABELS: Record<string, string> = {
      full_name: "Nome do cliente",
      email: "E-mail do cliente",
    };
    const missing: string[] = [];
    if (!customer.full_name || !String(customer.full_name).trim()) missing.push("full_name");
    if (!customer.email || !String(customer.email).trim()) missing.push("email");
    if (missing.length) {
      const labels = missing.map((f) => FIELD_LABELS[f] || f).join(", ");
      return json(400, {
        error: `Não é possível enviar o contrato. Campos obrigatórios faltando na reserva: ${labels}.`,
        missing_fields: missing,
        missing_labels: missing.map((f) => FIELD_LABELS[f] || f),
      });
    }

    // mark generating
    await admin.from("bookings").update({
      contract_status: "generating",
      contract_error: null,
    }).eq("id", bookingId);

    try {
      const pdfBytes = await buildPdf(booking, customer, vehicle);
      const pdfBase64 = bytesToBase64(pdfBytes);

      const envelopeName = `Contrato #${booking.booking_number || booking.id.slice(0, 8)}`;
      const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

      // 1) create envelope
      const envRes = await cs("/api/v3/envelopes", "POST", {
        data: {
          type: "envelopes",
          attributes: {
            name: envelopeName,
            locale: "pt-BR",
            auto_close: true,
            remind_interval: 3,
            deadline_at: deadline,
          },
        },
      });
      const envelopeId = envRes?.data?.id;
      if (!envelopeId) throw new Error("Envelope sem ID na resposta");

      // 2) upload document
      const docRes = await cs(`/api/v3/envelopes/${envelopeId}/documents`, "POST", {
        data: {
          type: "documents",
          attributes: {
            filename: `${envelopeName}.pdf`,
            content_base64: `data:application/pdf;base64,${pdfBase64}`,
          },
        },
      });
      const documentKey = docRes?.data?.id;

      // 3) signer cliente
      const signerCustomerRes = await cs(`/api/v3/envelopes/${envelopeId}/signers`, "POST", {
        data: {
          type: "signers",
          attributes: {
            name: customer.full_name,
            email: customer.email,
            has_documentation: false,
            refusable: true,
            communicate_events: {
              document_signed: "email",
              signature_request: "email",
              signature_reminder: "email",
            },
          },
        },
      });
      const signerCustomerId = signerCustomerRes?.data?.id;

      // 4) signer GoDrive (locadora)
      const signerZeusRes = await cs(`/api/v3/envelopes/${envelopeId}/signers`, "POST", {
        data: {
          type: "signers",
          attributes: {
            name: ZEUS_SIGNER_NAME,
            email: ZEUS_SIGNER_EMAIL,
            has_documentation: false,
            refusable: false,
            communicate_events: ZEUS_AUTO_SIGN
              ? { document_signed: "none", signature_request: "none", signature_reminder: "none" }
              : { document_signed: "email", signature_request: "email", signature_reminder: "email" },
          },
        },
      });
      const signerZeusId = signerZeusRes?.data?.id;

      // 5) requirements: cada signer precisa de AUTENTICAÇÃO (provide_evidence)
      // + QUALIFICAÇÃO/ASSINATURA (agree). Sem o "agree" a Clicksign não ativa
      // o envelope (422 "signatário(s) sem os requisitos necessários").
      const reqBodies: Array<{ signer: string; action: "provide_evidence" | "agree"; auth?: string; role?: string }> = [
        // cliente
        { signer: signerCustomerId, action: "provide_evidence", auth: "email" },
        { signer: signerCustomerId, action: "agree", role: "sign" },
        // GoDrive (locadora)
        { signer: signerZeusId, action: "provide_evidence", auth: ZEUS_AUTO_SIGN ? "api" : "email" },
        { signer: signerZeusId, action: "agree", role: "sign" },
      ];
      for (const r of reqBodies) {
        const attrs: any = { action: r.action };
        if (r.auth) attrs.auth = r.auth;
        if (r.role) attrs.role = r.role;
        await cs(`/api/v3/envelopes/${envelopeId}/requirements`, "POST", {
          data: {
            type: "requirements",
            attributes: attrs,
            relationships: {
              document: { data: { type: "documents", id: documentKey } },
              signer: { data: { type: "signers", id: r.signer } },
            },
          },
        });
      }

      // 6) running
      await cs(`/api/v3/envelopes/${envelopeId}`, "PATCH", {
        data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } },
      });

      // 7) Auto-assina como GoDrive (locadora) — desligado por padrão; ligar via ZEUS_AUTO_SIGN=true
      if (ZEUS_AUTO_SIGN) {
        try {
          await cs(`/api/v3/envelopes/${envelopeId}/signers/${signerZeusId}/sign`, "POST", undefined);
        } catch (signErr) {
          console.warn("[send-contract] auto-sign GoDrive falhou (envelope segue válido para cliente):", signErr instanceof Error ? signErr.message : signErr);
        }
      }

      // 8) Dispara e-mail de assinatura para todos os signatários
      // Sem isso, a Clicksign não envia o e-mail automaticamente após o envelope entrar em "running".
      // Doc: https://developers.clicksign.com/reference/api-notificar-envelope
      try {
        const notifyRes = await cs(`/api/v3/envelopes/${envelopeId}/notifications`, "POST", {});
        console.log("[send-contract] notifications enviadas:", JSON.stringify(notifyRes));
      } catch (notifyErr) {
        const m = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
        console.warn("[send-contract] notify failed (envelope segue ativo, possível reenvio manual):", m);
      }

      await admin.from("bookings").update({
        contract_status: "sent",
        clicksign_envelope_id: envelopeId,
        clicksign_document_key: documentKey,
        contract_sent_at: new Date().toISOString(),
        contract_error: null,
      }).eq("id", bookingId);

      return json(200, { ok: true, envelope_id: envelopeId, document_key: documentKey });

    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      console.error("[send-contract] error:", msg);
      await admin.from("bookings").update({
        contract_status: "failed",
        contract_error: msg.slice(0, 1000),
      }).eq("id", bookingId);
      return json(500, { error: msg });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-contract] outer error:", msg);
    return json(500, { error: msg });
  }
});
