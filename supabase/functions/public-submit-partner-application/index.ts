// Public onboarding endpoint. Anyone can POST here — this is the "become a partner" form.
// No auth required. Anti-abuse:
//  - Honeypot: if the invisible `honeypot` field is filled, silently return ok:true (bot bait).
//  - CNPJ format + verifier-digit validation when provided.
//  - Duplicate check (pending application with same email OR same CNPJ) → 409.
// Never accepts bank/PIX data — those are collected later by the partner in the authenticated portal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isValidCnpj, onlyDigits } from "../_shared/cnpj.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BR_UFS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STR_FIELDS = [
  "agency_name","legal_name","state_registration",
  "contact_name","contact_role","contact_email","contact_phone",
  "address_street","address_number","address_complement",
  "address_neighborhood","address_city","message",
] as const;

function normStr(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Honeypot: bots fill hidden fields. Fake success silently — no DB write, no signal.
    if (typeof body?.honeypot === "string" && body.honeypot.trim().length > 0) {
      return json(200, { ok: true });
    }

    const agency_name = normStr(body?.agency_name, 200);
    const contact_name = normStr(body?.contact_name, 150);
    const contact_email_raw = normStr(body?.contact_email, 255);
    const contact_phone_raw = normStr(body?.contact_phone, 40);

    if (!agency_name || agency_name.length < 2) {
      return json(400, { ok: false, error: "Nome da agência é obrigatório." });
    }
    if (!contact_name) {
      return json(400, { ok: false, error: "Nome do contato é obrigatório." });
    }
    if (!contact_email_raw || !EMAIL_RE.test(contact_email_raw)) {
      return json(400, { ok: false, error: "E-mail de contato inválido." });
    }
    if (!contact_phone_raw || onlyDigits(contact_phone_raw).length < 8) {
      return json(400, { ok: false, error: "Telefone de contato inválido." });
    }
    const contact_email = contact_email_raw.toLowerCase();

    // Optional CNPJ — normalize + verify digits
    let cnpj: string | null = null;
    if (typeof body?.cnpj === "string" && body.cnpj.trim()) {
      const d = onlyDigits(body.cnpj);
      if (d.length !== 14 || !isValidCnpj(d)) {
        return json(400, { ok: false, error: "CNPJ inválido." });
      }
      cnpj = d;
    }

    // Optional address
    let address_zip: string | null = null;
    if (typeof body?.address_zip === "string" && body.address_zip.trim()) {
      const d = onlyDigits(body.address_zip);
      if (d.length !== 8) {
        return json(400, { ok: false, error: "CEP inválido." });
      }
      address_zip = d;
    }
    let address_state: string | null = null;
    if (typeof body?.address_state === "string" && body.address_state.trim()) {
      const uf = body.address_state.trim().toUpperCase();
      if (!BR_UFS.has(uf)) return json(400, { ok: false, error: "UF inválida." });
      address_state = uf;
    }

    const record: Record<string, unknown> = {
      agency_name,
      contact_name,
      contact_email,
      contact_phone: contact_phone_raw,
      cnpj,
      address_zip,
      address_state,
    };
    for (const k of STR_FIELDS) {
      if (k === "agency_name" || k === "contact_name" || k === "contact_email" || k === "contact_phone") continue;
      record[k] = normStr((body as Record<string, unknown>)[k]);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Duplicate check: another pending application with same email OR same CNPJ.
    const dupFilters: string[] = [`contact_email.eq.${contact_email}`];
    if (cnpj) dupFilters.push(`cnpj.eq.${cnpj}`);
    const { data: dup, error: dupErr } = await admin
      .from("partner_applications")
      .select("id")
      .eq("status", "pending")
      .or(dupFilters.join(","))
      .limit(1)
      .maybeSingle();
    if (dupErr) return json(500, { ok: false, error: dupErr.message });
    if (dup) {
      return json(409, { ok: false, error: "Já existe uma solicitação em análise com esses dados." });
    }

    const { data, error } = await admin
      .from("partner_applications")
      .insert(record)
      .select("id")
      .single();
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, application_id: data.id });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
