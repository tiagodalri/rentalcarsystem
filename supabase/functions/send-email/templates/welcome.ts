// ─── Welcome Email Template ───
// Sent after a new customer signs up.

import {
  emailLayout,
  emailButton,
  emailDetailCard,
  emailInfoRow,
  colors,
} from "../email-components.ts";

interface WelcomeData {
  firstName?: string;
}

const content = {
  pt: {
    subject: "Bem-vindo à GoDrive",
    greeting: (name: string) =>
      name ? `Olá, ${name}!` : "Olá!",
    intro:
      "Seja muito bem-vindo à GoDrive. Estamos felizes em tê-lo conosco! Sua conta foi criada com sucesso e você já pode explorar nossa frota premium em Orlando.",
    benefitsTitle: "Por que a GoDrive?",
    benefit1Label: "Atendimento 24/7",
    benefit1Value: "Suporte premium via WhatsApp, a qualquer hora",
    benefit2Label: "Frota Selecionada",
    benefit2Value: "Veículos premium em Orlando, FL",
    benefit3Label: "100% Online",
    benefit3Value: "Reserve, acompanhe e gerencie pelo site",
    cta: "EXPLORAR FROTA",
    closing:
      "Se precisar de ajuda, fale conosco pelo WhatsApp. Estamos sempre disponíveis!",
    team: "— Equipe GoDrive",
  },
  en: {
    subject: "Welcome to GoDrive",
    greeting: (name: string) =>
      name ? `Hello, ${name}!` : "Hello!",
    intro:
      "Welcome to GoDrive! We're thrilled to have you. Your account has been created successfully and you can now explore our premium fleet in Orlando.",
    benefitsTitle: "Why GoDrive?",
    benefit1Label: "24/7 Support",
    benefit1Value: "Premium support via WhatsApp, anytime",
    benefit2Label: "Curated Fleet",
    benefit2Value: "Premium vehicles in Orlando, FL",
    benefit3Label: "100% Online",
    benefit3Value: "Book, track, and manage from the website",
    cta: "EXPLORE FLEET",
    closing:
      "Need help? Reach out via WhatsApp. We're always available!",
    team: "— GoDrive Team",
  },
} as const;

export function renderWelcome(
  data?: Record<string, unknown>,
  lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const t = content[lang];
  const firstName = ((data as WelcomeData)?.firstName || "").trim();

  const benefitsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${emailInfoRow(`▸ ${t.benefit1Label}`, t.benefit1Value)}
      ${emailInfoRow(`▸ ${t.benefit2Label}`, t.benefit2Value)}
      ${emailInfoRow(`▸ ${t.benefit3Label}`, t.benefit3Value)}
    </table>
  `;

  const body = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: ${colors.textPrimary};">
      ${t.greeting(firstName)}
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.7;">
      ${t.intro}
    </p>

    <h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 1px;">
      ${t.benefitsTitle}
    </h2>
    ${emailDetailCard(benefitsHtml)}

    ${emailButton(t.cta, "https://rentalcarsystem.lovable.app")}

    <p style="margin: 0 0 4px; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
      ${t.closing}
    </p>
    <p style="margin: 16px 0 0; font-size: 13px; color: ${colors.textMuted}; font-style: italic;">
      ${t.team}
    </p>
  `;

  return {
    subject: t.subject,
    html: emailLayout(body, lang),
  };
}
