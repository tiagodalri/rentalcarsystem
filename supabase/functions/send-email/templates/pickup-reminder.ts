// ─── Pickup Reminder Email Template (D-1) ───
// Sent 1 day before the scheduled pickup date.

import {
  emailLayout,
  emailButton,
  emailDetailCard,
  emailInfoRow,
  colors,
} from "../email-components.ts";

interface PickupReminderData {
  firstName?: string;
  bookingNumber?: string;
  vehicleName?: string;
  pickupDate?: string;
  pickupTime?: string;
  pickupLocation?: string;
  pickupAddress?: string;
  bookingDetailsUrl?: string;
}

const content = {
  pt: {
    subject: (num: string) => `Sua retirada é amanhã — ${num}`,
    greeting: (name: string) => name ? `Olá, ${name},` : "Olá,",
    intro: "Lembrete: sua retirada é amanhã. Confira os detalhes e prepare-se:",
    labels: {
      booking: "Reserva",
      vehicle: "Veículo",
      dateTime: "Data / Hora",
      location: "Local",
      address: "Endereço",
    },
    checklistTitle: "O que levar:",
    checklist: [
      "CNH válida (original)",
      "Cartão de crédito em nome do titular",
      "Comprovante da reserva (este e-mail)",
      "Chegue 15 minutos antes do horário agendado",
    ],
    cta: "VER DETALHES",
    closing: "Em caso de imprevistos, responda este e-mail ou chame no WhatsApp.",
    team: "— Equipe Sua Marca",
  },
  en: {
    subject: (num: string) => `Your pickup is tomorrow — ${num}`,
    greeting: (name: string) => name ? `Hi ${name},` : "Hi,",
    intro: "Reminder: your pickup is tomorrow. Here are the details to prepare:",
    labels: {
      booking: "Booking",
      vehicle: "Vehicle",
      dateTime: "Date / Time",
      location: "Location",
      address: "Address",
    },
    checklistTitle: "What to bring:",
    checklist: [
      "Valid driver's license (original)",
      "Credit card in the driver's name",
      "Booking confirmation (this email)",
      "Arrive 15 minutes before your scheduled time",
    ],
    cta: "VIEW DETAILS",
    closing: "If anything comes up, reply to this email or text us on WhatsApp.",
    team: "— Sua Marca Team",
  },
} as const;

export function renderPickupReminder(
  data?: Record<string, unknown>,
  lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const t = content[lang];
  const d = (data || {}) as PickupReminderData;

  const firstName = (d.firstName || "").trim();
  const bookingNumber = d.bookingNumber || "—";
  const vehicleName = d.vehicleName || "—";
  const pickupDate = d.pickupDate || "—";
  const pickupTime = d.pickupTime || "";
  const pickupLocation = d.pickupLocation || "—";
  const pickupAddress = (d.pickupAddress || "").trim();
  const bookingDetailsUrl = d.bookingDetailsUrl || "https://rentalcarsystem.lovable.app";

  const dateTimeFull = pickupTime ? `${pickupDate} · ${pickupTime}` : pickupDate;

  let detailRows = `
    ${emailInfoRow(`▸ ${t.labels.booking}`, bookingNumber)}
    ${emailInfoRow(`▸ ${t.labels.vehicle}`, vehicleName)}
    ${emailInfoRow(`▸ ${t.labels.dateTime}`, dateTimeFull)}
    ${emailInfoRow(`▸ ${t.labels.location}`, pickupLocation)}
  `;
  if (pickupAddress) {
    detailRows += emailInfoRow(`▸ ${t.labels.address}`, pickupAddress);
  }

  const detailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${detailRows}
    </table>
  `;

  const checklistItems = t.checklist
    .map(
      (item) =>
        `<tr><td style="padding: 6px 0; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.5;">• ${item}</td></tr>`
    )
    .join("");

  const checklistHtml = `
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 1px;">
      ${t.checklistTitle}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${checklistItems}
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

    ${emailDetailCard(checklistHtml)}

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
