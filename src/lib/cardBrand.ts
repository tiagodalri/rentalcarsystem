// Lightweight card brand detection from BIN/PAN digits.
// Returns the brand name expected by the cambioreal gateway.
export function detectBrand(num: string): string {
  const n = (num || "").replace(/\D/g, "");
  if (!n) return "";
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65|64[4-9]|622)/.test(n)) return "discover";
  if (/^(3(0[0-5]|[689]))/.test(n)) return "diners";
  if (/^(35(2[89]|[3-8]))/.test(n)) return "jcb";
  if (/^(606282|3841)/.test(n)) return "hipercard";
  if (/^(4011|4312|4389|4514|4573|5041|5066|5067|509|6277|6362|6363|6504|6505|6506|6507|6509|6516|6550)/.test(n)) return "elo";
  return "unknown";
}

export function formatCardNumber(value: string): string {
  const isAmex = /^3[47]/.test((value || "").replace(/\D/g, ""));
  const d = (value || "").replace(/\D/g, "").slice(0, isAmex ? 15 : 19);
  if (isAmex) {
    // 4-6-5
    return d.replace(/(\d{4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" "));
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
