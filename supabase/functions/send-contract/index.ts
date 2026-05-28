import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSIGN_API_TOKEN = Deno.env.get("CLICKSIGN_API_TOKEN")!;
const CLICKSIGN_BASE_URL = Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://app.clicksign.com";
const ZEUS_SIGNER_EMAIL = Deno.env.get("ZEUS_SIGNER_EMAIL") ?? "zeusrentalcarorlando@gmail.com";
const ZEUS_SIGNER_NAME = Deno.env.get("ZEUS_SIGNER_NAME") ?? "Zeus Rental Car";

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const fmtMoney = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";

async function buildPdf(booking: any, customer: any, vehicle: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontI = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const pageW = 595.28; // A4
  const pageH = 841.89;
  const margin = 42;
  const contentW = pageW - margin * 2;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const primary = rgb(30 / 255, 58 / 255, 95 / 255);
  const gold = rgb(191 / 255, 155 / 255, 48 / 255);
  const white = rgb(1, 1, 1);
  const gray = rgb(120 / 255, 120 / 255, 120 / 255);
  const dark = rgb(30 / 255, 30 / 255, 30 / 255);

  const ensure = (h: number) => {
    if (y - h < margin + 30) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  // Header band
  page.drawRectangle({ x: 0, y: pageH - 70, width: pageW, height: 70, color: primary });
  page.drawText("ZEUS RENTAL CAR", { x: margin, y: pageH - 30, size: 16, font: fontB, color: white });
  page.drawText("CONTRATO DE LOCACAO DE VEICULO", { x: margin, y: pageH - 48, size: 10, font, color: white });
  page.drawText(`Emissao: ${new Date().toLocaleDateString("pt-BR")}`, { x: margin, y: pageH - 62, size: 7, font, color: white });

  page.drawRectangle({ x: pageW - margin - 130, y: pageH - 56, width: 130, height: 40, color: gold });
  page.drawText("CONTRATO No", { x: pageW - margin - 124, y: pageH - 30, size: 7, font, color: white });
  page.drawText(booking.booking_number || "-", { x: pageW - margin - 124, y: pageH - 46, size: 11, font: fontB, color: white });

  y = pageH - 90;

  const section = (title: string) => {
    ensure(20);
    page.drawRectangle({ x: margin, y: y - 14, width: contentW, height: 14, color: primary });
    page.drawText(title, { x: margin + 6, y: y - 10, size: 9, font: fontB, color: white });
    y -= 22;
  };

  const wrap = (text: string, maxW: number, size: number, f = font) => {
    const words = (text || "-").split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxW) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const labelVal = (label: string, value: string, x: number, colW: number) => {
    page.drawText(label, { x, y, size: 7, font, color: gray });
    const lines = wrap(value || "-", colW - 4, 8, fontB);
    let yy = y - 9;
    for (const ln of lines.slice(0, 2)) {
      page.drawText(ln, { x, y: yy, size: 8, font: fontB, color: dark });
      yy -= 9;
    }
  };

  const twoCols = (l1: string, v1: string, l2: string, v2: string) => {
    ensure(22);
    const half = contentW / 2;
    labelVal(l1, v1, margin, half);
    labelVal(l2, v2, margin + half, half);
    y -= 22;
  };

  const oneCol = (l: string, v: string) => {
    ensure(22);
    labelVal(l, v, margin, contentW);
    y -= 22;
  };

  // Locadora
  section("LOCADORA");
  oneCol("Razao Social", "Zeus Rental Car LLC");
  twoCols("Endereco", "Orlando, FL - EUA", "EIN", "Zeus Rental Car LLC");

  // Locatario
  const fullAddress = [customer.address, customer.house_number, customer.complement, customer.zip_code]
    .filter(Boolean).join(", ") || "-";
  section("LOCATARIO");
  twoCols("Nome completo", customer.full_name || "-", "Nacionalidade", customer.nationality || "-");
  twoCols("E-mail", customer.email || "-", "Telefone", customer.phone || "-");
  twoCols("Documento (CPF/Passaporte)", customer.document_number || "-", "CNH (numero)", customer.driver_license || "-");
  twoCols("Validade da CNH", fmtDate(customer.driver_license_expiry), "Endereco", fullAddress);

  // Veiculo
  section("VEICULO");
  twoCols("Marca / Modelo", vehicle.name || "-", "Placa", vehicle.license_plate || "-");
  twoCols("Ano", vehicle.year?.toString() || "-", "Cor", vehicle.color || "-");
  twoCols("Categoria", vehicle.category || "-", "Odometro inicial (km)", vehicle.current_odometer?.toLocaleString("pt-BR") || "-");

  // Locacao
  const pickupMs = new Date(booking.pickup_date).getTime();
  const returnMs = new Date(booking.return_date).getTime();
  const days = Math.max(1, Math.round((returnMs - pickupMs) / 86400000));

  section("LOCACAO");
  twoCols(
    "Retirada",
    `${fmtDate(booking.pickup_date)} as ${booking.pickup_time || "-"}`,
    "Devolucao",
    `${fmtDate(booking.return_date)} as ${booking.return_time || "-"}`
  );
  twoCols("Local de retirada", booking.pickup_location || "-", "Local de devolucao", booking.return_location || "-");
  oneCol("Total de dias", `${days} dia(s)`);

  // Valores
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
  twoCols("Diaria", fmtMoney(dailyRate), "Total da locacao", fmtMoney(booking.total_price));
  twoCols("Caucao", fmtMoney(booking.deposit_amount), "Franquia / Deductible", fmtMoney(booking.franchise_amount));
  oneCol("Extras contratados", addonsList.length ? addonsList.join(" - ") : "Nenhum");

  // Clausulas
  section("CLAUSULAS GERAIS");
  const clauses = [
    "1. O LOCATARIO declara possuir CNH valida durante toda a vigencia da locacao.",
    "2. O LOCATARIO e responsavel por danos materiais, multas de transito e infracoes cometidas durante o periodo de locacao.",
    "3. A devolucao deve ser feita no local e horario acordados. Atrasos podem incorrer em diaria adicional.",
    "4. O LOCATARIO se compromete a nao conduzir o veiculo sob efeito de alcool, drogas ou em condicoes que comprometam a seguranca.",
    "5. Em caso de sinistro, comunicar a LOCADORA imediatamente pelo WhatsApp oficial e acionar autoridades locais.",
  ];
  for (const c of clauses) {
    const lines = wrap(c, contentW, 8.5);
    ensure(lines.length * 11 + 4);
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y, size: 8.5, font, color: dark });
      y -= 11;
    }
    y -= 3;
  }

  const disclaimer = "* As clausulas acima sao versao inicial e estao sujeitas a revisao juridica final pela LOCADORA antes de serem consideradas vinculativas.";
  const dLines = wrap(disclaimer, contentW, 7, fontI);
  ensure(dLines.length * 9 + 10);
  for (const ln of dLines) {
    page.drawText(ln, { x: margin, y, size: 7, font: fontI, color: gray });
    y -= 9;
  }
  y -= 10;

  // Assinaturas
  ensure(70);
  section("ASSINATURAS");
  y -= 20;
  const sigW = (contentW - 20) / 2;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + sigW, y },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawLine({
    start: { x: margin + sigW + 20, y },
    end: { x: margin + contentW, y },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText("LOCATARIO", { x: margin, y: y - 10, size: 8, font: fontB, color: dark });
  page.drawText("LOCADORA", { x: margin + sigW + 20, y: y - 10, size: 8, font: fontB, color: dark });
  page.drawText(customer.full_name || "-", { x: margin, y: y - 22, size: 8, font, color: dark });
  page.drawText(`Doc.: ${customer.document_number || "-"}`, { x: margin, y: y - 32, size: 8, font, color: dark });
  page.drawText("Zeus Rental Car LLC", { x: margin + sigW + 20, y: y - 22, size: 8, font, color: dark });
  y -= 50;
  page.drawText(`Orlando, FL - ${new Date().toLocaleDateString("pt-BR")}`, { x: margin, y, size: 8, font, color: gray });

  // Footer todas paginas
  const total = pdf.getPageCount();
  const ts = new Date().toLocaleString("pt-BR");
  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i);
    p.drawRectangle({ x: 0, y: 0, width: pageW, height: 18, color: primary });
    p.drawText(`Contrato gerado eletronicamente em ${ts} - Zeus Rental Car`, {
      x: margin, y: 6, size: 7, font, color: white,
    });
    p.drawText(`Pagina ${i + 1} de ${total}`, { x: pageW - margin - 70, y: 6, size: 7, font, color: white });
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
      "Authorization": `Bearer ${CLICKSIGN_API_TOKEN}`,
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.some((r) => r === "admin" || r === "operations")) {
      return json(403, { error: "Forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = body?.booking_id;
    if (!bookingId || typeof bookingId !== "string") {
      return json(400, { error: "booking_id obrigatorio" });
    }

    const { data: booking, error: bErr } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (bErr || !booking) return json(404, { error: "Reserva nao encontrada" });

    if (!booking.customer_id) return json(400, { error: "Reserva sem cliente vinculado" });

    const [{ data: customer }, { data: vehicle }] = await Promise.all([
      admin.from("customers").select("*").eq("id", booking.customer_id).maybeSingle(),
      admin.from("vehicles").select("*").eq("id", booking.vehicle_id).maybeSingle(),
    ]);
    if (!customer) return json(400, { error: "Cliente nao encontrado" });
    if (!vehicle) return json(400, { error: "Veiculo nao encontrado" });

    const missing: string[] = [];
    if (!customer.document_number) missing.push("document_number");
    if (!customer.driver_license) missing.push("driver_license");
    if (!customer.email) missing.push("email");
    if (!customer.full_name) missing.push("full_name");
    if (missing.length) {
      return json(400, { error: "Dados do cliente incompletos", missing_fields: missing });
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
            auths: ["email"],
          },
        },
      });
      const signerCustomerId = signerCustomerRes?.data?.id;

      // 4) signer Zeus
      const signerZeusRes = await cs(`/api/v3/envelopes/${envelopeId}/signers`, "POST", {
        data: {
          type: "signers",
          attributes: {
            name: ZEUS_SIGNER_NAME,
            email: ZEUS_SIGNER_EMAIL,
            has_documentation: false,
            refusable: true,
            communicate_events: {
              document_signed: "email",
              signature_request: "email",
              signature_reminder: "email",
            },
            auths: ["email"],
          },
        },
      });
      const signerZeusId = signerZeusRes?.data?.id;

      // 5) requirements (sign + auth) for each signer
      const reqBodies = [
        { signer: signerCustomerId, action: "agree" },
        { signer: signerCustomerId, action: "provide_evidence", auth: "email" },
        { signer: signerZeusId, action: "agree" },
        { signer: signerZeusId, action: "provide_evidence", auth: "email" },
      ];
      for (const r of reqBodies) {
        const attrs: any = { action: r.action, role: "sign" };
        if (r.auth) attrs.auth = r.auth;
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
