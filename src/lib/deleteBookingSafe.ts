import { supabase } from "@/integrations/supabase/client";

/**
 * Exclusão SEGURA de reserva — sempre cancela cobrança no Câmbio Real antes do soft delete.
 *
 * Fluxo:
 *  1) Lê payment_status da reserva + última payment_request
 *  2) Se PAGA → bloqueia (precisa estornar primeiro no Câmbio Real)
 *  3) Se tem cobrança aberta → chama `cambioreal-cancel` (POST /checkout/cancel/{token})
 *  4) Soft delete com status="cancelled" → trigger marca financial_transactions como is_cancelled
 *
 * Use em qualquer tela admin que ofereça botão de excluir reserva.
 */
export type DeleteBookingResult =
  | { ok: true; cancelledCharge: boolean }
  | { ok: false; reason: "paid" | "user_cancelled" | "error"; message: string };

export interface DeleteBookingHandlers {
  /** Confirma com o usuário. Receba a mensagem e retorne true/false. */
  confirm: (message: string) => boolean | Promise<boolean>;
  /** Mostra alerta bloqueante (reserva paga). */
  alert: (message: string) => void;
}

export async function deleteBookingSafe(
  bookingId: string,
  handlers: DeleteBookingHandlers
): Promise<DeleteBookingResult> {
  // 1) Estado da reserva
  const { data: booking } = await supabase
    .from("bookings")
    .select("payment_status, status, booking_number")
    .eq("id", bookingId)
    .maybeSingle();

  // 2) Última cobrança Câmbio Real
  const { data: pr } = await supabase
    .from("payment_requests")
    .select("id, cr_token, status, payment_method")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPaid =
    booking?.payment_status === "paid" || pr?.status === "SOLICITACAO_PAGO";
  const isAlreadyCancelled = booking?.status === "cancelled";

  // 3) Bloqueia reserva paga — EXCETO quando já está cancelada
  //    (se status='cancelled', o estorno já foi processado OU é reserva de
  //    teste; em qualquer caso o admin pode remover da lista).
  if (isPaid && !isAlreadyCancelled) {
    handlers.alert(
      "Esta reserva está PAGA e não pode ser apenas excluída.\n\n" +
        'Para cancelar, abra a reserva, use "Cancelar reserva" e processe o estorno ' +
        "no Câmbio Real. Só então a exclusão fica liberada."
    );
    return { ok: false, reason: "paid", message: "Reserva paga .  requer estorno." };
  }

  const closedStatuses = [
    "SOLICITACAO_CANCELADA",
    "SOLICITACAO_EXPIRADA",
    "BOLETO_EXPIRADO",
    "CANCELADO",
    "EXPIRADO",
  ];
  const hasOpenCharge = !!(pr && !closedStatuses.includes(pr.status || ""));

  const msg = hasOpenCharge
    ? `Esta reserva tem uma cobrança ABERTA no Câmbio Real (${pr!.status}).\n\n` +
      "Ao excluir, a cobrança será CANCELADA automaticamente no Câmbio Real e a reserva irá para a lixeira. Deseja continuar?"
    : "Tem certeza que deseja excluir esta reserva? (Pode ser restaurada por um administrador)";

  const proceed = await handlers.confirm(msg);
  if (!proceed) {
    return { ok: false, reason: "user_cancelled", message: "Cancelado pelo usuário." };
  }

  // 4) Cancela cobrança no gateway
  if (hasOpenCharge && pr?.cr_token) {
    try {
      const { error } = await supabase.functions.invoke("cambioreal-cancel", {
        body: { token: pr.cr_token, booking_id: bookingId },
      });
      if (error) throw error;
    } catch (e: any) {
      const force = await handlers.confirm(
        `Falha ao cancelar a cobrança no Câmbio Real: ${e?.message || e}.\n\n` +
          "Deseja excluir a reserva mesmo assim? (a cobrança permanecerá aberta no gateway)"
      );
      if (!force) {
        return { ok: false, reason: "user_cancelled", message: "Cancelado após erro." };
      }
    }
  }

  // 5) Soft delete
  const { data: { user } } = await supabase.auth.getUser();
  const { error: delErr } = await supabase
    .from("bookings")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      status: "cancelled",
    })
    .eq("id", bookingId);

  if (delErr) {
    return { ok: false, reason: "error", message: delErr.message };
  }

  return { ok: true, cancelledCharge: hasOpenCharge };
}
