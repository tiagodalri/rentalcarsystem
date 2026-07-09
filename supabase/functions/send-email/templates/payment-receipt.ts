// ─── Payment Receipt Email Template ───
// Sent after a payment is successfully processed.

import {
  emailLayout,
  emailButton,
  emailDetailCard,
  emailInfoRow,
  colors,
} from "../email-components.ts";

interface PaymentReceiptData {
  firstName?: string;
  bookingNumber?: string;
  vehicleName?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  paymentDate?: string;
  transactionId?: string;
  bookingDetailsUrl?: string;
}

const content = {
  pt: {
    subject: (num: string) => `Comprovante de pagamento — ${num}`,
    greeting: (name: string) => name ? `Olá, ${name},` : "Olá,",
    intro: "Recebemos seu pagamento. Este é o comprovante oficial.",
    labels: {
      booking: "Reserva",
      vehicle: "Veículo",
      amount: "Valor pago",
      method: "Método",
      date: "Data",
      transaction: "ID da transação",
    },
    cta: "VER DETALHES DA RESERVA",
    closing: "Guarde este e-mail. Em caso de necessidade, ele serve como comprovante fiscal.",
    team: "— Equipe Sua Marca",
  },
  en: {
    subject: (num: string) => `Payment receipt — ${num}`,
    greeting: (name: string) => name ? `Hi ${name},` : "Hi,",
    intro: "Your payment was received. This is your official receipt.",
    labels: {
      booking: "Booking",
      vehicle: "Vehicle",
      amount: "Amount paid",
      method: "Method",
      date: "Date",
      transaction: "Transaction ID",
    },
    cta: "VIEW BOOKING DETAILS",
    closing: "Keep this email. It can be used as a payment proof if needed.",
    team: "— Sua Marca Team",
  },
} as const;

export function renderPaymentReceipt(
  data?: Record<string, unknown>,
  lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const t = content[lang];
  const d = (data || {}) as PaymentReceiptData;

  const firstName = (d.firstName || "").trim();
  const bookingNumber = d.bookingNumber || "—";
  const vehicleName = d.vehicleName || "—";
  const paymentAmount = d.paymentAmount || "—";
  const paymentMethod = d.paymentMethod || "—";
  const paymentDate = d.paymentDate || "—";
  const transactionId = d.transactionId || "—";
  const bookingDetailsUrl = d.bookingDetailsUrl || "https://rentalcarsystem.lovable.app";

  const detailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${emailInfoRow(`▸ ${t.labels.booking}`, bookingNumber)}
      ${emailInfoRow(`▸ ${t.labels.vehicle}`, vehicleName)}
      ${emailInfoRow(`▸ ${t.labels.amount}`, paymentAmount)}
      ${emailInfoRow(`▸ ${t.labels.method}`, paymentMethod)}
      ${emailInfoRow(`▸ ${t.labels.date}`, paymentDate)}
      ${emailInfoRow(`▸ ${t.labels.transaction}`, transactionId)}
    </table>
  `;

  const body = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: ${colors.textPrimary};">
      ${t.greeting(firstName)}
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.7;">
      ${t.intro}
    </p>

    ${emailDetailCard(detailsHtml)}

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
