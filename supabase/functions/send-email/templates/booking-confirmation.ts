// ─── Booking Confirmation Email Template ───
// Sent after a customer completes a booking.

import {
  emailLayout,
  emailButton,
  emailDetailCard,
  emailInfoRow,
  colors,
} from "../email-components.ts";

interface BookingConfirmationData {
  firstName?: string;
  bookingNumber?: string;
  vehicleName?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  pickupLocation?: string;
  totalPrice?: string;
  bookingDetailsUrl?: string;
}

const content = {
  pt: {
    subject: (num: string) => `Reserva confirmada — ${num}`,
    greeting: (name: string) => name ? `Olá, ${name},` : "Olá,",
    intro: "Sua reserva está confirmada! Aqui estão os detalhes:",
    labels: {
      booking: "Reserva",
      vehicle: "Veículo",
      pickup: "Retirada",
      location: "Local",
      return: "Devolução",
      total: "Total",
    },
    cta: "VER DETALHES DA RESERVA",
    closing: "Em caso de dúvidas ou alteração, responda este e-mail.",
    team: "— Equipe GoDrive",
  },
  en: {
    subject: (num: string) => `Booking confirmed — ${num}`,
    greeting: (name: string) => name ? `Hi ${name},` : "Hi,",
    intro: "Your booking is confirmed! Here are the details:",
    labels: {
      booking: "Booking",
      vehicle: "Vehicle",
      pickup: "Pick-up",
      location: "Location",
      return: "Return",
      total: "Total",
    },
    cta: "VIEW BOOKING DETAILS",
    closing: "For questions or changes, reply to this email.",
    team: "— GoDrive Team",
  },
} as const;

export function renderBookingConfirmation(
  data?: Record<string, unknown>,
  lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const t = content[lang];
  const d = (data || {}) as BookingConfirmationData;

  const firstName = (d.firstName || "").trim();
  const bookingNumber = d.bookingNumber || "—";
  const vehicleName = d.vehicleName || "—";
  const pickupDate = d.pickupDate || "—";
  const pickupTime = d.pickupTime || "";
  const returnDate = d.returnDate || "—";
  const returnTime = d.returnTime || "";
  const pickupLocation = d.pickupLocation || "—";
  const totalPrice = d.totalPrice || "—";
  const bookingDetailsUrl = d.bookingDetailsUrl || "https://rentalcarsystem.lovable.app";

  const pickupFull = pickupTime ? `${pickupDate} · ${pickupTime}` : pickupDate;
  const returnFull = returnTime ? `${returnDate} · ${returnTime}` : returnDate;

  const detailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${emailInfoRow(`▸ ${t.labels.booking}`, bookingNumber)}
      ${emailInfoRow(`▸ ${t.labels.vehicle}`, vehicleName)}
      ${emailInfoRow(`▸ ${t.labels.pickup}`, pickupFull)}
      ${emailInfoRow(`▸ ${t.labels.location}`, pickupLocation)}
      ${emailInfoRow(`▸ ${t.labels.return}`, returnFull)}
      ${emailInfoRow(`▸ ${t.labels.total}`, totalPrice)}
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
