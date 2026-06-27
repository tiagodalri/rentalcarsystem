import { supabase } from "@/integrations/supabase/client";

// Durante a fase de testes, todos os e-mails transacionais vão para o e-mail
// pessoal de controle. Quando entrarmos em produção, troque esta constante
// pelo destinatário real (ex.: o e-mail do cliente da reserva).
const TEST_RECIPIENT = "tiagodalri1@live.com";

export type ZeusTemplate =
  | "booking-confirmed"
  | "booking-updated"
  | "booking-cancelled"
  | "inspection-checkin"
  | "inspection-checkout";

interface SendOpts {
  templateName: ZeusTemplate;
  idempotencyKey: string;
  templateData: Record<string, unknown>;
  recipientEmail?: string;
}

/**
 * Dispara um e-mail transacional Zeus.
 * Falhas são silenciosas (apenas console.error) — nunca devem quebrar o
 * fluxo principal (criar reserva, finalizar inspeção, etc.).
 */
export async function sendZeusEmail(opts: SendOpts): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: opts.templateName,
        recipientEmail: opts.recipientEmail ?? TEST_RECIPIENT,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.templateData,
      },
    });
    if (error) {
      console.error("[zeus-email] send failed", opts.templateName, error);
    }
  } catch (err) {
    console.error("[zeus-email] send threw", opts.templateName, err);
  }
}
