// ─── Password Changed Notification ───
// Sent after a user successfully changes their account password.

import { emailLayout, emailButton, emailDetailCard, colors } from "../email-components.ts";

interface PasswordChangedData {
  userName?: string;
  changedAt?: string; // ISO timestamp
}

function formatOrlando(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/New_York",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
  } catch {
    return d.toISOString();
  }
}

export function renderPasswordChanged(
  data?: Record<string, unknown>,
  _lang: "pt" | "en" = "pt"
): { subject: string; html: string } {
  const d = (data || {}) as PasswordChangedData;
  const name = (d.userName || "").trim();
  const when = formatOrlando(d.changedAt);

  const greeting = name ? `Olá, ${name}!` : "Olá!";

  const alertBox = emailDetailCard(`
    <p style="margin: 0 0 12px; font-size: 14px; color: ${colors.textPrimary}; font-weight: 700;">
      Não reconhece esta alteração?
    </p>
    <p style="margin: 0; font-size: 13px; color: ${colors.textSecondary}; line-height: 1.6;">
      Se não foi você que fez essa alteração, redefina sua senha imediatamente clicando no botão abaixo. Recomendamos também verificar a segurança da sua conta.
    </p>
  `);

  const body = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: ${colors.textPrimary};">
      ${greeting}
    </h1>
    <p style="margin: 0 0 20px; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.7;">
      Identificamos que a senha da sua conta GoDrive foi alterada em
      <strong style="color: ${colors.textPrimary};">${when}</strong>
      (fuso horário de Orlando, EUA).
    </p>

    ${alertBox}

    ${emailButton("REDEFINIR SENHA", "https://rentalcarsystem.lovable.app/reset-password")}

    <p style="margin: 8px 0 0; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
      Se foi você que alterou a senha, pode ignorar este email com segurança.
    </p>

    <p style="margin: 24px 0 0; font-size: 13px; color: ${colors.textMuted}; font-style: italic;">
      — Equipe GoDrive
    </p>
  `;

  return {
    subject: "Sua senha foi alterada — GoDrive",
    html: emailLayout(body, "pt"),
  };
}
