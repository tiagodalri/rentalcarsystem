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

const ALLOWED = [
  "agency_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "notes",
  // Company
  "legal_name",
  "cnpj",
  "state_registration",
  "contact_role",
  // Address
  "address_zip",
  "address_street",
  "address_number",
  "address_complement",
  "address_neighborhood",
  "address_city",
  "address_state",
  // Bank
  "bank_name",
  "bank_agency",
  "bank_account",
  "bank_account_type",
  "bank_account_holder_name",
  "bank_account_holder_document",
  // PIX
  "pix_key_type",
  "pix_key",
] as const;

const DIGIT_FIELDS = new Set([
  "cnpj",
  "bank_account_holder_document",
  "address_zip",
]);

const BANK_ACCOUNT_TYPES = new Set(["corrente", "poupanca"]);
const PIX_KEY_TYPES = new Set(["cpf", "cnpj", "email", "telefone", "aleatoria"]);
const BR_UFS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);

function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

// Standard CNPJ verifier digit algorithm
function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const weights = base.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + d1);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { ok: false, error: "Missing Authorization" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Invalid token" });
    const callerId = userData.user.id;

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("partner_id")
      .eq("user_id", callerId)
      .eq("role", "partner")
      .maybeSingle();
    if (roleErr) return json(500, { ok: false, error: roleErr.message });
    if (!roleRow?.partner_id) return json(403, { ok: false, error: "Forbidden: partner role required" });
    const partnerId = roleRow.partner_id as string;

    const body = await req.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const k of ALLOWED) {
      if (k in (body ?? {})) {
        const raw = body[k];
        let v = typeof raw === "string" ? raw.trim() : raw;
        if (v === "" || v === undefined) v = null;
        if (v !== null && DIGIT_FIELDS.has(k) && typeof v === "string") v = onlyDigits(v);
        update[k] = v;
      }
    }
    if (!Object.keys(update).length) {
      return json(400, { ok: false, error: "No allowed fields provided" });
    }
    if ("agency_name" in update && (!update.agency_name || String(update.agency_name).length < 2)) {
      return json(400, { ok: false, error: "agency_name must be at least 2 chars" });
    }
    if ("cnpj" in update && update.cnpj !== null) {
      if (!isValidCnpj(update.cnpj)) return json(400, { ok: false, error: "CNPJ inválido" });
    }
    if ("bank_account_type" in update && update.bank_account_type !== null) {
      if (!BANK_ACCOUNT_TYPES.has(String(update.bank_account_type))) {
        return json(400, { ok: false, error: "bank_account_type inválido" });
      }
    }
    if ("pix_key_type" in update && update.pix_key_type !== null) {
      if (!PIX_KEY_TYPES.has(String(update.pix_key_type))) {
        return json(400, { ok: false, error: "pix_key_type inválido" });
      }
    }
    if ("address_state" in update && update.address_state !== null) {
      const uf = String(update.address_state).toUpperCase();
      if (!BR_UFS.has(uf)) return json(400, { ok: false, error: "UF inválida" });
      update.address_state = uf;
    }
    if ("address_zip" in update && update.address_zip !== null) {
      if (String(update.address_zip).length !== 8) {
        return json(400, { ok: false, error: "CEP inválido" });
      }
    }
    if ("bank_account_holder_document" in update && update.bank_account_holder_document !== null) {
      const d = String(update.bank_account_holder_document);
      if (d.length !== 11 && d.length !== 14) {
        return json(400, { ok: false, error: "CPF/CNPJ do titular inválido" });
      }
    }

    const { data, error } = await admin
      .from("partners")
      .update(update)
      .eq("id", partnerId)
      .select("*")
      .single();
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, partner: data });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
