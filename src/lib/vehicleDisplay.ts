// Helpers to render a clean vehicle label (without color words baked in)
// and resolve a CSS color from a Portuguese/English color name.

const COLOR_WORDS = [
  "preto", "preta", "branco", "branca", "prata", "prateado", "prateada",
  "cinza", "grafite", "chumbo",
  "vermelho", "vermelha", "rubi", "bordo", "bordô",
  "azul", "azulado",
  "verde",
  "amarelo", "amarela",
  "dourado", "dourada", "ouro",
  "bege",
  "marrom", "café", "cafe",
  "laranja",
  "roxo", "roxa", "violeta",
  "rosa", "pink",
  "black", "white", "silver", "gray", "grey",
  "red", "blue", "green", "yellow", "gold", "brown", "orange", "purple",
];

const COLOR_HEX: Record<string, string> = {
  preto: "#0a0a0a", preta: "#0a0a0a", black: "#0a0a0a",
  branco: "#f4f4f5", branca: "#f4f4f5", white: "#f4f4f5",
  prata: "#c0c4c8", prateado: "#c0c4c8", prateada: "#c0c4c8", silver: "#c0c4c8",
  cinza: "#6b7280", grafite: "#3f3f46", chumbo: "#52525b", gray: "#6b7280", grey: "#6b7280",
  vermelho: "#b91c1c", vermelha: "#b91c1c", rubi: "#9f1239", bordo: "#7f1d1d", "bordô": "#7f1d1d", red: "#b91c1c",
  azul: "#1d4ed8", azulado: "#1d4ed8", blue: "#1d4ed8",
  verde: "#15803d", green: "#15803d",
  amarelo: "#eab308", amarela: "#eab308", yellow: "#eab308",
  dourado: "#b8860b", dourada: "#b8860b", ouro: "#b8860b", gold: "#b8860b",
  bege: "#d6c6a8",
  marrom: "#7c4a1e", café: "#5a3a1e", cafe: "#5a3a1e", brown: "#7c4a1e",
  laranja: "#ea580c", orange: "#ea580c",
  roxo: "#6d28d9", roxa: "#6d28d9", violeta: "#7c3aed", purple: "#6d28d9",
  rosa: "#db2777", pink: "#db2777",
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Strip trailing color word(s) from a vehicle name. */
export function stripColorFromName(name: string): string {
  if (!name) return name;
  const tokens = name.trim().split(/\s+/);
  while (tokens.length > 1) {
    const last = normalize(tokens[tokens.length - 1]);
    if (COLOR_WORDS.includes(last)) {
      tokens.pop();
    } else {
      break;
    }
  }
  return tokens.join(" ").trim();
}

/** Try to detect the color of a vehicle from explicit field or from the name. */
export function detectVehicleColor(vehicle: { color?: string | null; name?: string | null }): string | null {
  if (vehicle.color && vehicle.color.trim()) {
    const k = normalize(vehicle.color.trim().split(/\s+/)[0]);
    if (COLOR_HEX[k]) return COLOR_HEX[k];
  }
  if (vehicle.name) {
    const tokens = vehicle.name.trim().split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const k = normalize(tokens[i]);
      if (COLOR_HEX[k]) return COLOR_HEX[k];
    }
  }
  return null;
}

/** Public-facing display label: name without color suffix. */
export function getVehicleDisplayName(vehicle: { name?: string | null }): string {
  return stripColorFromName(vehicle?.name || "");
}
