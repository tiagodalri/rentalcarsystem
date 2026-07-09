// ─── Booking Cancellation Email Template ───
// Sent after a booking is canceled, with refund details.

import {
  emailLayout,
  emailButton,
  emailDetailCard,
  emailInfoRow,
  colors,
} from "../email-components.ts";

interface BookingCancellationData {
  firstName?: string;
  bookingNumber?: string;
  vehicleName?: string;
  originalPickupDate?: string;
  cancellationDate?: string;
  refundAmount?: string;
  refundMethod?: string;
  refundDeadline?: string;
  bookingDetailsUrl?: string;
}

const content = {
  pt: {
    subject: (num: string) => `Reserva cancelada — ${num}`,
    greeting: (name: string) => name ? `Olá, ${name},` : "Olá,",
    intro: "Sua reserva foi cancelada com sucesso. Veja os detalhes do reembolso abaixo.",
    bookingLabels: {
      booking: "Reserva",
      vehicle: "Veículo",
      originalPickup: "Data original de retirada",
      cancellation: "Data do cancelamento",
    },
    refundTitle: "Detalhes do reembolso",
    refundLabels: {
      amount: "Valor reembolsado",
      method: "Método",
      deadline: "Prazo",
    },
    cta: "VER HISTÓRICO",
    closing: "Em caso de dúvidas sobre o reembolso, responda este e-mail ou chame no WhatsApp.",
    team: "— Equipe Sua Marca",
  },
  en: {
    subject: (num: string) => `Booking canceled — ${num}`,
    greeting: (name: string) => name ? `Hi ${name},` : "Hi,",
    intro: "Your booking has been successfully canceled. See refund details below.",
    bookingLabels: {
      booking: "Booking",
      vehicle: "Vehicle",
      originalPickup: "Original pickup date",
      cancellation: "Cancellation date",
    },
    refundTitle: "Refund details",
    refundLabels: {
      amount: "Refund amount",
      method: "Method",
      deadline: "Deadline",
    },
    cta: "VIEW HISTORY",
    closing: "For questions about your refund, reply to this email or text us on WhatsApp.",
    team: "— Sua Marca Team",
  },
} as const;

export function renderBookingCancellation(
  data?: Record<string, unknown>,
  lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const t = content[lang];
  const d = (data || {}) as BookingCancellationData;

  const firstName = (d.firstName || "").trim();
  const bookingNumber = d.bookingNumber || "—";
  const vehicleName = d.vehicleName || "—";
  const originalPickupDate = d.originalPickupDate || "—";
  const cancellationDate = d.cancellationDate || "—";
  const refundAmount = d.refundAmount || "—";
  const refundMethod = d.refundMethod || "—";
  const refundDeadline = d.refundDeadline || "—";
  const bookingDetailsUrl = d.bookingDetailsUrl || "https://rentalcarsystem.lovable.app";

  const bookingDetailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${emailInfoRow(`▸ ${t.bookingLabels.booking}`, bookingNumber)}
      ${emailInfoRow(`▸ ${t.bookingLabels.vehicle}`, vehicleName)}
      ${emailInfoRow(`▸ ${t.bookingLabels.originalPickup}`, originalPickupDate)}
      ${emailInfoRow(`▸ ${t.bookingLabels.cancellation}`, cancellationDate)}
    </table>
  `;

  const refundDetailsHtml = `
    <p style="margin: 0 0 14px; font-size: 14px; font-weight: 700; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 1px;">
      ${t.refundTitle}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${emailInfoRow(`▸ ${t.refundLabels.amount}`, refundAmount)}
      ${emailInfoRow(`▸ ${t.refundLabels.method}`, refundMethod)}
      ${emailInfoRow(`▸ ${t.refundLabels.deadline}`, refundDeadline)}
    </table>
  `;

  const body = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: ${colors.textPrimary};">
      ${t.greeting(firstName)}
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.7;">
      ${t.intro}
    </p>

    ${emailDetailCard(bookingDetailsHtml)}

    ${emailDetailCard(refundDetailsHtml)}

    ${emailButton(t.cta, bookingDetailsUrl)}

    <p style="margin: 0 0 4px; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
      ${t.closing}
    </p>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${colors.textMuted}; font-style: italic;">
      ${t.team}
    </p>
  `;

  return {
    subject: t.subject(bookingNumber),
    html: emailLayout(body, lang),
  };
}
