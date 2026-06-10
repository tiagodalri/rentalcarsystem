// Title-case Brazilian/Latin person names: capitalize each word but keep
// connector particles in lowercase (de, da, do, das, dos, e, di, du, la, le, van, von).
// Preserves O' / D' / Mc / Mac prefixes and hyphenated names ("Anna-Maria").

const PARTICLES = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "la", "le", "van", "von", "den", "der", "del", "della",
]);

function capWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  // Hyphenated: capitalize each side
  if (lower.includes("-")) {
    return lower.split("-").map(capWord).join("-");
  }
  // Apostrophe prefixes: o'brien, d'angelo
  if (/^[od]'/.test(lower)) {
    return lower.charAt(0).toUpperCase() + "'" + capWord(lower.slice(2));
  }
  // Mc / Mac
  if (/^mc[a-z]/.test(lower)) return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
  if (/^mac[a-z]/.test(lower)) return "Mac" + lower.charAt(3).toUpperCase() + lower.slice(4);
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatPersonName(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const words = trimmed.split(" ");
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      // Particles stay lowercase, except as first word
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return capWord(w);
    })
    .join(" ");
}
