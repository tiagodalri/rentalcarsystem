// Detects a contextual seasonal/holiday theme based on the current date.
// Returns motifs and palette guidance used by the marketing image prompt.

export type SeasonalTheme = {
  key: string;
  label: string;
  palette: string; // hex/textual palette
  motifs: string;  // visual motifs (elegant, never kitsch)
  copyHint: string; // optional copy direction
};

const ALL_THEMES: SeasonalTheme[] = [
  {
    key: "natal",
    label: "Natal",
    palette: "verde-pinheiro profundo #0b3d2e, dourado champagne #c9a861, branco neve, vermelho bordo discreto #6b1a1a",
    motifs: "galhos de pinheiro com geada, particulas de neve finas, luzes warm bokeh, fita de cetim dourada sutil",
    copyHint: "espirito de Natal, presente, celebracao em familia",
  },
  {
    key: "ano-novo",
    label: "Ano Novo",
    palette: "preto absoluto, dourado champagne #c9a861, prata polida #c0c0c0, brilho cristal",
    motifs: "fogos de artificio dourados ao fundo desfocados, particulas de glitter fino, reflexos de tacas de champagne, contagem regressiva implicita",
    copyHint: "novo ciclo, recomecos, brinde ao novo ano",
  },
  {
    key: "valentim",
    label: "Dia dos Namorados (US)",
    palette: "bordo profundo #5a0f1a, rosa antigo, dourado rose #b8865c, creme",
    motifs: "petalas de rosa em queda lenta, luz quente de fim de tarde, reflexos suaves de velas",
    copyHint: "romance, escapada a dois, Orlando para casais",
  },
  {
    key: "carnaval",
    label: "Carnaval",
    palette: "dourado, marsala, esmeralda, ametista .  joia profunda",
    motifs: "confete dourado em camera lenta, mascara veneziana sugerida em silhueta, plumas discretas",
    copyHint: "festa sofisticada, ritmo, energia brasileira em Orlando",
  },
  {
    key: "spring-break",
    label: "Spring Break",
    palette: "azul piscina, coral suave, areia, dourado solar",
    motifs: "luz dourada de fim de tarde na Florida, palmeiras em silhueta, reflexos de piscina",
    copyHint: "ferias de marco, liberdade, dias longos em Orlando",
  },
  {
    key: "pascoa",
    label: "Pascoa",
    palette: "pastel sofisticado .  verde-agua, lavanda, dourado champagne",
    motifs: "luz suave matinal, flores brancas, ramos floridos discretos",
    copyHint: "tempo em familia, renovacao, feriado longo",
  },
  {
    key: "dia-das-maes",
    label: "Dia das Maes",
    palette: "rosa antigo, perola, dourado champagne",
    motifs: "buque de peonias discreto, luz suave de janela, conforto",
    copyHint: "presentear a mae, viagem em familia, cuidado",
  },
  {
    key: "memorial-day",
    label: "Memorial Day",
    palette: "navy profundo, branco, dourado discreto",
    motifs: "bandeira americana em desfoque suave, luz de inicio de verao",
    copyHint: "feriado prolongado, roadtrip pela Florida",
  },
  {
    key: "4-julho",
    label: "4 de Julho",
    palette: "navy #0d1d2e, branco neve, vermelho bordo, dourado champagne",
    motifs: "fogos de artificio dourados desfocados, ceu noturno azul-marinho, brilho metalico, bandeira sugerida em silhueta sutil",
    copyHint: "feriado americano, celebracao, liberdade em Orlando",
  },
  {
    key: "dia-dos-pais",
    label: "Dia dos Pais",
    palette: "navy, conhaque, dourado fosco, madeira escura",
    motifs: "luz dourada masculina, materiais nobres, atmosfera de club",
    copyHint: "presente para o pai, dirigir um sonho",
  },
  {
    key: "labor-day",
    label: "Labor Day",
    palette: "azul profundo, branco, dourado quente",
    motifs: "fim de verao, luz dourada, ultimos dias de praia",
    copyHint: "ultimo feriado longo do verao",
  },
  {
    key: "halloween",
    label: "Halloween",
    palette: "preto absoluto, laranja abobora queimado #b8552a, dourado escuro, roxo profundo",
    motifs: "neblina baixa, luz de lua, silhueta de abobora estilizada, atmosfera cinematografica de outubro em Orlando (Universal HHN)",
    copyHint: "noite de Halloween em Orlando, parques tematicos",
  },
  {
    key: "thanksgiving",
    label: "Thanksgiving",
    palette: "terracota, mostarda, conhaque, dourado quente, marrom-chocolate",
    motifs: "luz dourada de outono, folhas secas, atmosfera acolhedora de jantar em familia",
    copyHint: "gratidao, reunir a familia, feriado americano",
  },
  {
    key: "black-friday",
    label: "Black Friday",
    palette: "preto absoluto, dourado champagne, branco minimo",
    motifs: "tipografia editorial em alto contraste, silencio visual, luz teatral",
    copyHint: "oportunidade rara, sem griteria, exclusividade",
  },
  {
    key: "verao",
    label: "Verao em Orlando",
    palette: "azul piscina, coral, dourado solar, branco",
    motifs: "luz dourada de fim de tarde, palmeiras, reflexos de agua",
    copyHint: "verao, ferias, dias longos",
  },
  {
    key: "outono",
    label: "Outono",
    palette: "ambar, terracota, dourado quente, verde-musgo",
    motifs: "luz baixa quente, folhas em tom quente",
    copyHint: "estacao de transicao, atmosfera acolhedora",
  },
  {
    key: "inverno",
    label: "Inverno",
    palette: "navy, prata, branco neve, dourado frio",
    motifs: "luz fria limpa, ar cristalino, silencio",
    copyHint: "inverno suave de Orlando",
  },
  {
    key: "primavera",
    label: "Primavera",
    palette: "pastel sofisticado, verde-agua, lavanda, dourado champagne",
    motifs: "luz matinal suave, flores discretas",
    copyHint: "renovacao, leveza",
  },
];

export function pickRandomSeasonalTheme(): SeasonalTheme {
  const idx = Math.floor(Math.random() * ALL_THEMES.length);
  return ALL_THEMES[idx];
}

export function detectSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  const md = m * 100 + d;

  // Natal
  if ((m === 12 && d >= 10 && d <= 27)) return ALL_THEMES.find(t => t.key === "natal")!;
  // Ano Novo / Reveillon
  if ((m === 12 && d >= 28) || (m === 1 && d <= 5)) return ALL_THEMES.find(t => t.key === "ano-novo")!;
  // Sao Valentim
  if (md >= 208 && md <= 215) return ALL_THEMES.find(t => t.key === "valentim")!;
  // Carnaval (varia, aproximacao Fev/inicio Mar)
  if ((m === 2 && d >= 16) || (m === 3 && d <= 5)) return ALL_THEMES.find(t => t.key === "carnaval")!;
  // Spring Break Orlando
  if ((m === 3 && d >= 10) || (m === 4 && d <= 5)) return ALL_THEMES.find(t => t.key === "spring-break")!;
  // Pascoa (aproximacao final marco/abril)
  if ((m === 4 && d >= 1 && d <= 20)) return ALL_THEMES.find(t => t.key === "pascoa")!;
  // Dia das Maes (segundo domingo de maio — janela ampla)
  if (m === 5 && d >= 5 && d <= 15) return ALL_THEMES.find(t => t.key === "dia-das-maes")!;
  // Memorial Day weekend US
  if (m === 5 && d >= 24 && d <= 31) return ALL_THEMES.find(t => t.key === "memorial-day")!;
  // 4 de Julho — Independencia EUA
  if (m === 7 && d >= 1 && d <= 7) return ALL_THEMES.find(t => t.key === "4-julho")!;
  // Dia dos Pais BR (segundo domingo de agosto)
  if (m === 8 && d >= 8 && d <= 14) return ALL_THEMES.find(t => t.key === "dia-dos-pais")!;
  // Labor Day US
  if (m === 9 && d >= 1 && d <= 7) return ALL_THEMES.find(t => t.key === "labor-day")!;
  // Halloween
  if (m === 10 && d >= 20 && d <= 31) return ALL_THEMES.find(t => t.key === "halloween")!;
  // Thanksgiving (4a quinta de novembro — janela)
  if (m === 11 && d >= 20 && d <= 28) return ALL_THEMES.find(t => t.key === "thanksgiving")!;
  // Black Friday
  if (m === 11 && d >= 24 && d <= 30) return ALL_THEMES.find(t => t.key === "black-friday")!;

  // Fallback por estacao (hemisferio norte — Orlando)
  if (m >= 6 && m <= 8) return ALL_THEMES.find(t => t.key === "verao")!;
  if (m >= 9 && m <= 11) return ALL_THEMES.find(t => t.key === "outono")!;
  if (m === 12 || m <= 2) return ALL_THEMES.find(t => t.key === "inverno")!;
  return ALL_THEMES.find(t => t.key === "primavera")!;
}
