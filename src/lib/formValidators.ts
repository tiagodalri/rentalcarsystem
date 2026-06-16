// Email + phone validation helpers used by the booking driver form.

const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "me.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "globo.com",
  "proton.me",
  "protonmail.com",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Suggest a completion when the user typed "name@gma" -> "name@gmail.com". */
export function suggestEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 1) return null;
  const local = v.slice(0, at);
  const domainPart = v.slice(at + 1);
  if (!domainPart) return null;
  // already a complete known domain
  if (COMMON_EMAIL_DOMAINS.includes(domainPart)) return null;
  // prefix match
  const match = COMMON_EMAIL_DOMAINS.find((d) => d.startsWith(domainPart));
  if (match && match !== domainPart) return `${local}@${match}`;
  // typo: missing .com when looks like "gmail"
  if (!domainPart.includes(".")) {
    const guess = COMMON_EMAIL_DOMAINS.find((d) => d.split(".")[0] === domainPart);
    if (guess) return `${local}@${guess}`;
  }
  return null;
}

// ------------- PHONE -------------

export interface PhoneRule {
  /** number of digits in the national number (after country code) */
  digits: number;
  /** mask using 9 as digit placeholder */
  mask: string;
  example: string;
}

const PHONE_RULES: Record<string, PhoneRule> = {
  BR: { digits: 11, mask: "(99) 99999-9999", example: "(11) 99999-0000" },
  US: { digits: 10, mask: "(999) 999-9999", example: "(305) 555-0123" },
  CA: { digits: 10, mask: "(999) 999-9999", example: "(416) 555-0123" },
  AR: { digits: 10, mask: "99 9999-9999", example: "11 9876-5432" },
  CL: { digits: 9, mask: "9 9999 9999", example: "9 1234 5678" },
  CO: { digits: 10, mask: "999 999 9999", example: "300 123 4567" },
  MX: { digits: 10, mask: "(999) 999-9999", example: "(55) 1234-5678" },
  PY: { digits: 9, mask: "999 999 999", example: "981 123 456" },
  UY: { digits: 8, mask: "9999 9999", example: "9123 4567" },
  PE: { digits: 9, mask: "999 999 999", example: "987 654 321" },
  VE: { digits: 10, mask: "999-999-9999", example: "412-123-4567" },
  EC: { digits: 9, mask: "99 999 9999", example: "99 123 4567" },
  BO: { digits: 8, mask: "9999 9999", example: "7012 3456" },
  GB: { digits: 10, mask: "9999 999 999", example: "7400 123456" },
  DE: { digits: 11, mask: "999 99999999", example: "151 23456789" },
  FR: { digits: 9, mask: "9 99 99 99 99", example: "6 12 34 56 78" },
  ES: { digits: 9, mask: "999 999 999", example: "612 345 678" },
  IT: { digits: 10, mask: "999 999 9999", example: "312 345 6789" },
  PT: { digits: 9, mask: "999 999 999", example: "912 345 678" },
  JP: { digits: 10, mask: "99 9999 9999", example: "90 1234 5678" },
  CN: { digits: 11, mask: "999 9999 9999", example: "131 2345 6789" },
  IN: { digits: 10, mask: "99999 99999", example: "98765 43210" },
  AU: { digits: 9, mask: "999 999 999", example: "412 345 678" },
  AE: { digits: 9, mask: "99 999 9999", example: "50 123 4567" },
  IL: { digits: 9, mask: "99 999 9999", example: "50 123 4567" },
  ZA: { digits: 9, mask: "99 999 9999", example: "71 123 4567" },
  CH: { digits: 9, mask: "99 999 99 99", example: "78 123 45 67" },
  AT: { digits: 11, mask: "999 99999999", example: "664 12345678" },
  NL: { digits: 9, mask: "9 99999999", example: "6 12345678" },
  SE: { digits: 9, mask: "99 999 9999", example: "70 123 4567" },
  NO: { digits: 8, mask: "999 99 999", example: "412 34 567" },
};

export function getPhoneRule(iso: string): PhoneRule {
  return PHONE_RULES[iso] || { digits: 10, mask: "999 999 9999", example: "999 999 9999" };
}

export function formatPhone(iso: string, raw: string): string {
  const rule = getPhoneRule(iso);
  const digits = raw.replace(/\D/g, "").slice(0, rule.digits);
  let out = "";
  let di = 0;
  for (const ch of rule.mask) {
    if (di >= digits.length) break;
    if (ch === "9") {
      out += digits[di++];
    } else {
      out += ch;
    }
  }
  return out;
}

export function isValidPhone(iso: string, raw: string): boolean {
  const rule = getPhoneRule(iso);
  return raw.replace(/\D/g, "").length === rule.digits;
}
