// ─── Sua Marca — Reusable Email Components ───
// Pure HTML string builders for Deno Edge Functions.
// All 5 transactional templates inherit from emailLayout().

const LOGO_URL =
  "https://synnmssbvwbmlcxfgbwu.supabase.co/storage/v1/object/public/email-assets/zeus-logo-hd.png";

// ─── Brand Tokens ───
export const colors = {
  gold: "#D4AF37",
  goldDark: "#B8860B",
  goldLight: "#E8D48B",
  bgDark: "#0A0A0A",
  bgCard: "#141414",
  bgCardBorder: "#1E1E1E",
  textPrimary: "#FAFAFA",
  textSecondary: "#A3A3A3",
  textMuted: "#666666",
  white: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

// ─── Email Header ───
export function emailHeader(): string {
  return `
    <tr>
      <td align="center" style="padding: 40px 30px 24px;">
        <img
          src="${LOGO_URL}"
          alt="Sua Marca"
          width="180"
          height="auto"
          style="display: block; max-width: 180px; height: auto;"
        />
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px;">
        <div style="height: 1px; background: linear-gradient(to right, transparent, ${colors.gold}40, transparent);"></div>
      </td>
    </tr>
  `;
}

// ─── Email Footer ───
export function emailFooter(lang: "pt" | "en" = "pt"): string {
  const texts = {
    pt: {
      address: "Orlando, FL, EUA",
      whatsapp: "WhatsApp: +1 (555) 000-0000",
      rights: `© ${new Date().getFullYear()} Sua Marca. Todos os direitos reservados.`,
      unsubscribe: "Cancelar inscrição",
    },
    en: {
      address: "Orlando, FL, USA",
      whatsapp: "WhatsApp: +1 (555) 000-0000",
      rights: `© ${new Date().getFullYear()} Sua Marca. All rights reserved.`,
      unsubscribe: "Unsubscribe",
    },
  };
  const t = texts[lang];

  return `
    <tr>
      <td style="padding: 0 30px;">
        <div style="height: 1px; background: linear-gradient(to right, transparent, ${colors.gold}40, transparent); margin-top: 32px;"></div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 24px 30px 16px;">
        <a href="https://instagram.com/zeusrentalcar" style="color: ${colors.textMuted}; font-size: 13px; text-decoration: none; margin: 0 8px;">Instagram</a>
        <span style="color: ${colors.textMuted};">·</span>
        <a href="https://wa.me/15550000000" style="color: ${colors.textMuted}; font-size: 13px; text-decoration: none; margin: 0 8px;">${t.whatsapp}</a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 30px 8px;">
        <p style="margin: 0; font-size: 12px; color: ${colors.textMuted};">📍 ${t.address}</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 30px 32px;">
        <p style="margin: 0; font-size: 11px; color: ${colors.textMuted}60;">${t.rights}</p>
      </td>
    </tr>
  `;
}

// ─── CTA Button ───
export function emailButton(
  text: string,
  href: string,
  options?: { fullWidth?: boolean }
): string {
  const width = options?.fullWidth ? "width: 100%;" : "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${options?.fullWidth ? 'width="100%"' : ""} style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, ${colors.goldDark}, ${colors.gold});">
          <a href="${href}" target="_blank"
            style="display: inline-block; ${width} padding: 14px 32px; font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 700; color: ${colors.bgDark}; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Info Row (label: value) ───
export function emailInfoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid ${colors.bgCardBorder};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size: 13px; color: ${colors.textSecondary}; width: 40%;">${label}</td>
            <td style="font-size: 14px; color: ${colors.textPrimary}; font-weight: 600; text-align: right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ─── Detail Card (bordered box for booking details, etc.) ───
export function emailDetailCard(innerHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin: 20px 0; border: 1px solid ${colors.bgCardBorder}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: ${colors.bgCard};">
          ${innerHtml}
        </td>
      </tr>
    </table>
  `;
}

// ─── Full Email Layout Wrapper ───
export function emailLayout(bodyContent: string, lang: "pt" | "en" = "pt"): string {
  return `
<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Sua Marca</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bgDark}; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <!-- Preheader (hidden text for inbox preview) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.bgDark};">
    <tr>
      <td align="center" style="padding: 20px 16px;">
        <!-- Main card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width: 600px; width: 100%; background-color: ${colors.bgCard}; border: 1px solid ${colors.bgCardBorder}; border-radius: 16px; overflow: hidden;">
          
          ${emailHeader()}

          <!-- Body -->
          <tr>
            <td style="padding: 24px 30px;">
              ${bodyContent}
            </td>
          </tr>

          ${emailFooter(lang)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
