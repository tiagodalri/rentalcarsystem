// Helper compartilhado para envio de e-mails do módulo Parceiros.
// Reutiliza a infra Lovable Emails já existente (send-transactional-email + pgmq).
// FALHAS SÃO NÃO-FATAIS: nenhuma função aqui pode lançar exceção — a lógica
// principal da edge function chamadora deve continuar mesmo se o e-mail falhar.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const APP_BASE_URL =
  Deno.env.get("APP_BASE_URL") ?? "https://rentalcarsystem.lovable.app";

export function appUrl(path: string): string {
  const base = APP_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

type TemplateName =
  | "partner-application-received"
  | "partner-welcome"
  | "partner-proposal-accepted"
  | "partner-payout-processed";

interface SendOpts {
  templateName: TemplateName;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, unknown>;
}

/**
 * Envia um e-mail invocando a edge function send-transactional-email.
 * Nunca lança — apenas loga em caso de falha.
 */
export async function sendPartnerEmail(opts: SendOpts): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[partner-email] missing SUPABASE_URL / SERVICE_ROLE_KEY");
      return;
    }
    if (!opts.recipientEmail || !opts.recipientEmail.includes("@")) {
      console.warn("[partner-email] skipping: invalid recipient", opts.templateName);
      return;
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        templateName: opts.templateName,
        recipientEmail: opts.recipientEmail,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.templateData,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(
        `[partner-email] send failed [${resp.status}] ${opts.templateName} -> ${opts.recipientEmail}: ${body}`,
      );
    }
  } catch (err) {
    console.error(
      `[partner-email] threw ${opts.templateName} -> ${opts.recipientEmail}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Retorna a lista de e-mails de usuários com role platform_admin.
 * Nunca lança — retorna [] em caso de falha.
 */
export async function listPlatformAdminEmails(
  admin: SupabaseClient,
): Promise<string[]> {
  try {
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "platform_admin");
    if (rErr) {
      console.error("[partner-email] platform_admin lookup failed:", rErr.message);
      return [];
    }
    const ids = Array.from(new Set((roles ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean)));
    if (ids.length === 0) return [];

    const emails: string[] = [];
    for (const id of ids) {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error) {
          console.warn("[partner-email] getUserById failed", id, error.message);
          continue;
        }
        const email = data?.user?.email;
        if (email) emails.push(email.toLowerCase());
      } catch (e) {
        console.warn("[partner-email] getUserById threw", id, e);
      }
    }
    return Array.from(new Set(emails));
  } catch (e) {
    console.error("[partner-email] listPlatformAdminEmails threw:", e);
    return [];
  }
}

// Re-export para conveniência caso um edge function precise instanciar admin client
export { createClient };
