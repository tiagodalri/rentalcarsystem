/**
 * Padroniza descrições curtas de avarias para manter linguagem profissional
 * e consistente em todo o sistema (laudos, e-mails, links públicos).
 *
 * Só atua quando o texto é claramente uma única palavra/expressão de tipo
 * de avaria (ex.: "arranhao", "Aranhão", "amassado leve"). Descrições longas
 * — com vírgulas, frases ou mais de 4 palavras — passam intactas, para não
 * sobrescrever observações do operador.
 */

type Rule = { match: RegExp; replacement: string };

// Ordem importa: regras mais específicas primeiro.
const RULES: Rule[] = [
  { match: /\b(arranh(a|ã)o|aranh(a|ã)o|risc(o|ado|ada)|riskad(o|a))\b/i, replacement: "Peça riscada" },
  { match: /\b(amass(ado|ada|amento)|amasad(o|a)|batid(o|a)|amolgad(o|a))\b/i, replacement: "Peça amassada" },
  { match: /\b(quebrad(o|a)|kebrad(o|a)|partid(o|a))\b/i, replacement: "Peça quebrada" },
  { match: /\b(trincad(o|a)|rachad(o|a)|fissurad(o|a))\b/i, replacement: "Peça trincada" },
  { match: /\b(furad(o|a)|perfurad(o|a))\b/i, replacement: "Peça furada" },
  { match: /\b(manchad(o|a)|sujid(a|ade)|encardid(o|a))\b/i, replacement: "Peça manchada" },
  { match: /\b(descascad(o|a)|desbotad(o|a)|despintad(o|a))\b/i, replacement: "Pintura descascada" },
  { match: /\b(enferrujad(o|a)|ferrug(em|inha)|oxidad(o|a))\b/i, replacement: "Peça oxidada" },
];

export function normalizeDamageText(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return raw;

  // Não toca em descrições longas ou frases (preserva observações do operador)
  const wordCount = raw.split(/\s+/).length;
  const hasSentencePunctuation = /[.,;:!?]/.test(raw);
  if (wordCount > 4 || hasSentencePunctuation) return raw;

  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.replacement;
  }

  // Capitaliza primeira letra para padronizar
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
