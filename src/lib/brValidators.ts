// Brazilian document / format helpers (client-side)

export const onlyDigits = (s: string): string => (s || "").replace(/\D+/g, "");

export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const weights = base.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + d1);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "/" + p4;
  if (p5) out += "-" + p5;
  return out;
}

export function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "-" + p4;
  return out;
}

export function formatCpfCnpj(raw: string): string {
  const d = onlyDigits(raw);
  return d.length <= 11 ? formatCpf(d) : formatCnpj(d);
}

export function formatCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}

export function formatBrPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const BR_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export function isValidPixKey(type: PixKeyType, key: string): boolean {
  const k = (key || "").trim();
  if (!k) return false;
  switch (type) {
    case "cpf": return isValidCpf(k);
    case "cnpj": return isValidCnpj(k);
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
    case "telefone": {
      const d = onlyDigits(k);
      return d.length >= 10 && d.length <= 13;
    }
    case "aleatoria":
      return /^[0-9a-fA-F-]{32,36}$/.test(k);
    default:
      return false;
  }
}

export function maskTail(value: string | null | undefined, visible = 4): string {
  const s = (value ?? "").toString();
  if (!s) return "—";
  if (s.length <= visible) return "•".repeat(Math.max(0, s.length - 1)) + s.slice(-1);
  return "•".repeat(4) + " " + s.slice(-visible);
}
