export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 8) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${clean}${text}`;
}

export function defaultClientMessage(name?: string | null): string {
  const firstName = (name || "").split(" ")[0] || "";
  return firstName
    ? `Olá ${firstName}, aqui é da Sua Marca.`
    : `Olá, aqui é da Sua Marca.`;
}
