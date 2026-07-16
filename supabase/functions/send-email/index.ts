import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailLayout, emailButton, colors } from "./email-components.ts";
import { renderWelcome } from "./templates/welcome.ts";
import { renderBookingConfirmation } from "./templates/booking-confirmation.ts";
import { renderPickupReminder } from "./templates/pickup-reminder.ts";
import { renderPaymentReceipt } from "./templates/payment-receipt.ts";
import { renderBookingCancellation } from "./templates/booking-cancellation.ts";
import { renderPasswordChanged } from "./templates/password-changed.ts";

import { buildCorsHeaders } from "../_shared/cors.ts";
// Resend direct API
const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "GoDrive <noreply@rentalcarsystem.lovable.app>";
const REPLY_TO = "contato@rentalcarsystem.lovable.app";

// Retry config: 1s, 4s, 9s
const RETRY_DELAYS = [1000, 4000, 9000];

interface SendEmailRequest {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
  language?: "pt" | "en";
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!RESEND_API_KEY) {
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  // Allow override for dev/testing
  const overrideTo = Deno.env.get("EMAIL_OVERRIDE_TO");
  const finalTo = overrideTo || to;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [finalTo],
      subject,
      html,
      reply_to: REPLY_TO,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { success: false, error: `Resend ${response.status}: ${body}` };
  }

  await response.json(); // consume body
  return { success: true };
}

async function sendWithRetry(
  to: string,
  subject: string,
  html: string,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  logId: string
): Promise<{ success: boolean; attempts: number; error?: string }> {
  let lastError = "";

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    // Update attempt count
    await supabase
      .from("email_logs")
      .update({ attempt_count: attempt + 1, status: "sending" })
      .eq("id", logId);

    const result = await sendViaResend(to, subject, html);

    if (result.success) {
      return { success: true, attempts: attempt + 1 };
    }

    lastError = result.error || "Unknown error";
    console.error(`Attempt ${attempt + 1} failed: ${lastError}`);
  }

  return {
    success: false,
    attempts: RETRY_DELAYS.length + 1,
    error: lastError,
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SendEmailRequest = await req.json();
    const { templateName, recipientEmail, idempotencyKey, templateData, language } = body;

    // Input validation
    if (!templateName || !recipientEmail || !idempotencyKey) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: templateName, recipientEmail, idempotencyKey",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseAdmin();

    // Idempotency check — if already sent, skip
    const { data: existing } = await supabase
      .from("email_logs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      if (existing.status === "sent") {
        return new Response(
          JSON.stringify({ success: true, message: "Already sent (idempotent)", logId: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // If pending/failed, we'll retry below using existing log
    }

    // Render template — this is a placeholder until Phase 3/4 adds React Email
    const rendered = renderTemplate(templateName, templateData, language || "pt");

    if (!rendered) {
      return new Response(
        JSON.stringify({ error: `Unknown template: ${templateName}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or reuse log entry
    let logId: string;
    if (existing) {
      logId = existing.id;
      await supabase
        .from("email_logs")
        .update({ status: "pending", error_message: null })
        .eq("id", logId);
    } else {
      const { data: logEntry, error: logError } = await supabase
        .from("email_logs")
        .insert({
          template_name: templateName,
          recipient_email: recipientEmail,
          idempotency_key: idempotencyKey,
          status: "pending",
          metadata: { templateData, language: language || "pt" },
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Failed to create email log:", logError);
        return new Response(
          JSON.stringify({ error: "Failed to log email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      logId = logEntry.id;
    }

    // Send with retry
    const result = await sendWithRetry(
      recipientEmail,
      rendered.subject,
      rendered.html,
      supabase,
      logId
    );

    // Update final status
    await supabase
      .from("email_logs")
      .update({
        status: result.success ? "sent" : "failed",
        attempt_count: result.attempts,
        error_message: result.error || null,
      })
      .eq("id", logId);

    if (result.success) {
      console.log(`Email sent: ${templateName} -> ${recipientEmail} (${result.attempts} attempt(s))`);

      // Set welcome_sent flag on customer after successful welcome send
      if (templateName === "welcome" && templateData?.customerId) {
        const { error: flagErr } = await supabase
          .from("customers")
          .update({ welcome_sent: true })
          .eq("id", templateData.customerId as string);
        if (flagErr) {
          console.error("Failed to set welcome_sent flag:", flagErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, logId, attempts: result.attempts }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error(`Email failed: ${templateName} -> ${recipientEmail}: ${result.error}`);
      return new Response(
        JSON.stringify({ success: false, error: result.error, logId, attempts: result.attempts }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Template Registry ───

interface RenderedEmail {
  subject: string;
  html: string;
}

function renderTemplate(
  templateName: string,
  _data?: Record<string, unknown>,
  lang: string = "pt"
): RenderedEmail | null {
  const l = (lang === "en" ? "en" : "pt") as "pt" | "en";

  const templates: Record<string, () => RenderedEmail> = {
    test: () => ({
      subject: "GoDrive — Test Email",
      html: emailLayout(
        `
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 800; color: ${colors.textPrimary};">
            ${l === "pt" ? "Pipeline funcionando!" : "Pipeline is working!"}
          </h1>
          <p style="margin: 0 0 12px; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.6;">
            ${l === "pt"
              ? "Este é um e-mail de teste da Edge Function send-email. O layout base GoDrive está ativo."
              : "This is a test email from the send-email Edge Function. The GoDrive base layout is active."}
          </p>
          ${emailButton(l === "pt" ? "VISITAR SITE" : "VISIT WEBSITE", "https://rentalcarsystem.lovable.app")}
          <p style="margin: 16px 0 0; font-size: 12px; color: ${colors.textMuted};">
            Template: test | Layout: emailLayout v1
          </p>
        `,
        l
      ),
    }),
    welcome: () => renderWelcome(_data, l),
    "booking-confirmation": () => renderBookingConfirmation(_data, l),
    "pickup-reminder": () => renderPickupReminder(_data, l),
    "payment-receipt": () => renderPaymentReceipt(_data, l),
    "booking-cancellation": () => renderBookingCancellation(_data, l),
    "password-changed": () => renderPasswordChanged(_data, l),
  };

  const factory = templates[templateName];
  return factory ? factory() : null;
}
