// Marketing Studio - Social Post Generator
// Generates a polished social media image (feed or story) using Lovable AI.
// Supports single post or carousel (3-5 slides) with cover / content / CTA structure.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Mode = "promo" | "free" | "reference";

type Promo = {
  priceDaily?: string;
  dateStart?: string;
  dateEnd?: string;
  hook?: string;
};

type Body = {
  vehicleName: string;
  vehicleBrand?: string;
  vehiclePhotoUrl?: string | null;
  logoDataUrl?: string | null;
  format: "feed" | "story";
  tone: "luxo" | "aventura" | "familia" | "promocao" | "lancamento" | "sazonal";
  mode?: Mode;
  customPrompt?: string;
  promo?: Promo;
  referenceImageDataUrl?: string | null;
  seasonalTheme?: { key: string; label: string; palette: string; motifs: string; copyHint: string };
  // NEW
  carousel?: boolean;
  slidesCount?: number; // 3..5 when carousel
};

const ZEUS_LOGO_URL = "https://rentalcarsystem.lovable.app/brand-mark.png";

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  } catch { return iso; }
}

type SlidePlan = {
  role: "cover" | "content" | "cta";
  headline: string;
  subheadline: string;
  body?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const {
      vehicleName, vehicleBrand, vehiclePhotoUrl, logoDataUrl,
      format, tone, customPrompt,
      mode = "free", promo, referenceImageDataUrl, seasonalTheme,
      carousel = false,
    } = body;
    const slidesCount = carousel ? Math.min(5, Math.max(3, body.slidesCount || 3)) : 1;
    const logoUrl = logoDataUrl && logoDataUrl.startsWith("data:image") ? logoDataUrl : ZEUS_LOGO_URL;
    if (!vehicleName) {
      return new Response(JSON.stringify({ error: "vehicleName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toneMap: Record<string, string> = {
      luxo: "sofisticado, exclusivo, premium — desperta desejo e status",
      aventura: "vibrante, livre, espirito de viagem e descoberta em Orlando",
      familia: "acolhedor, seguro, perfeito para criar memorias em familia",
      promocao: "urgencia leve, oportunidade unica, sem soar apelativo",
      lancamento: "novidade, exclusividade, primeira chance de experimentar",
      sazonal: seasonalTheme
        ? `tema sazonal "${seasonalTheme.label}" — ${seasonalTheme.copyHint}. Mantenha a sofisticacao GoDrive, jamais kitsch.`
        : "tema sazonal contextual da data atual, sofisticado",
    };

    const promoBlock = mode === "promo" && promo
      ? `\nPROMOCAO ATIVA:\n- Valor diaria: USD ${promo.priceDaily}\n- Periodo: ${fmtDate(promo.dateStart)} ate ${fmtDate(promo.dateEnd)}${promo.hook ? `\n- Gancho: ${promo.hook}` : ""}\nA headline DEVE comunicar oportunidade sem soar apelativa. A caption deve mencionar o valor e o periodo de forma elegante.`
      : "";

    // ── 0) Reference brief extraction ─────────────────────────────
    // When the user uploads a reference, FIRST analyze it with vision to extract
    // theme, concept, copy ideas, promo info and key visual elements. Without this
    // step the image model only mimics palette/mood and ignores the actual idea.
    let refBrief: {
      tema: string;
      conceito: string;
      headlinesSugeridas: string[];
      promo?: string;
      elementosVisuais: string[];
      paleta: string;
      mood: string;
    } | null = null;

    if (mode === "reference" && referenceImageDataUrl?.startsWith("data:image")) {
      try {
        const refRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Voce e diretor de arte. Analise a imagem de referencia que o usuario envia e devolva SOMENTE JSON valido com esta estrutura:
{
  "tema": "tema/conceito central em 1 frase (ex: 'campanha rumo ao hexa da Copa do Mundo')",
  "conceito": "ideia criativa central em 1-2 frases",
  "headlinesSugeridas": ["3 a 5 headlines no espirito da referencia, adaptaveis para a marca GoDrive em Orlando"],
  "promo": "se houver desconto/oferta/condicao, descreva (ex: '60% OFF condicional'), caso contrario string vazia",
  "elementosVisuais": ["lista de elementos visuais marcantes — ex: 'bandeiras do Brasil', 'familia no carro', 'beira-mar com palmeiras', 'tipografia 3D dourada'"],
  "paleta": "paleta dominante em palavras (ex: 'verde-amarelo Brasil + dourado + branco')",
  "mood": "mood/sentimento em 1 frase (ex: 'celebracao patriotica calorosa e familiar')"
}
Importante: EXTRAIA o tema e conceito reais — nao se limite a 'estilo'. Se a referencia comunica uma campanha (ex: Copa, Natal, Black Friday), o tema deve refletir isso.`,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: `Analise esta referencia para uma campanha da GoDrive com o carro "${vehicleBrand || ""} ${vehicleName}" em Orlando.` },
                  { type: "image_url", image_url: { url: referenceImageDataUrl } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (refRes.ok) {
          const j = await refRes.json();
          try {
            refBrief = JSON.parse(j.choices[0].message.content);
          } catch { /* fallthrough */ }
        } else {
          console.error("ref brief error", refRes.status, await refRes.text());
        }
      } catch (e) {
        console.error("ref brief exception", e);
      }
    }

    const refBriefBlock = refBrief
      ? `\n\nBRIEFING EXTRAIDO DA REFERENCIA (use como base criativa):
- Tema: ${refBrief.tema}
- Conceito: ${refBrief.conceito}
- Headlines sugeridas: ${refBrief.headlinesSugeridas.join(" | ")}
- Promo/oferta: ${refBrief.promo || "nenhuma"}
- Elementos visuais marcantes: ${refBrief.elementosVisuais.join(", ")}
- Paleta: ${refBrief.paleta}
- Mood: ${refBrief.mood}
ADAPTE o tema, conceito e tom para a marca GoDrive (premium, sofisticada, Orlando). Nao copie a marca da referencia. Se houver qualquer nome de concorrente no briefing acima, IGNORE e substitua por GoDrive.`
      : "";

    // ── 1) Copywriting ────────────────────────────────────────────
    const carouselCopyInstructions = carousel ? `
Este post e um CARROSSEL de ${slidesCount} slides. Devolva tambem o array "slides" com EXATAMENTE ${slidesCount} itens, na ordem:
- Slide 1: "cover" (capa impactante, headline curta de 2-4 palavras, subheadline curta).
- Slides 2 a ${slidesCount - 1}: "content" (cada um com uma ideia/beneficio diferente — conforto, performance, lugares para visitar em Orlando, experiencia, etc).
- Slide ${slidesCount}: "cta" (chamada final, ex: "Reserve agora", "Garanta sua data") — sem soar apelativo.
Cada slide tem: { "role", "headline" (3-6 palavras), "subheadline" (4-8 palavras), "body" (opcional, 1 frase curta de apoio) }.
Os slides devem fluir narrativamente, NUNCA repetir a mesma headline.` : "";

    const copyJsonShape = carousel
      ? `{
  "headline": "frase principal do post (capa)",
  "subheadline": "linha de apoio curta",
  "caption": "legenda unica do carrossel (3 a 5 linhas)",
  "hashtags": ["#tag1","#tag2"],
  "slides": [{ "role":"cover|content|cta", "headline":"...", "subheadline":"...", "body":"..." }]
}`
      : `{
  "headline": "frase principal curta (3 a 6 palavras)",
  "subheadline": "linha de apoio curta (4 a 8 palavras)",
  "caption": "legenda do post (3 a 5 linhas, micro-historia)",
  "hashtags": ["#tag1","#tag2"]
}`;

    const copySys = `Voce e copywriter senior de uma agencia premium (Wieden+Kennedy / Mother) trabalhando para a GoDrive, locadora premium em Orlando.
Escreva em portugues do Brasil impecavel (zero erros), voz humana, calorosa, confiante, cinematografica.
PROIBIDO: emojis, ponto-e-virgula, travessao, jargao publicitario ("imperdivel", "incrivel", "nao perca").
PROIBIDO MENCIONAR nomes, marcas ou logotipos de concorrentes (locadoras, automotivas ou outras empresas). Qualquer referencia externa deve ser substituida por GoDrive.
Devolva SOMENTE JSON valido:
${copyJsonShape}
Tom: ${toneMap[tone] || toneMap.luxo}.
Hashtags: 6 a 10, misture portugues e ingles, sempre incluir #SuaMarca e #Orlando.${carouselCopyInstructions}`;

    const copyUser = `Carro: ${vehicleBrand ? vehicleBrand + " " : ""}${vehicleName}
Formato: ${format === "feed" ? "feed quadrado" : "story vertical"}${carousel ? ` em CARROSSEL de ${slidesCount} slides` : ""}
Tom: ${tone}
Modo: ${mode}${promoBlock}${refBriefBlock}
${customPrompt ? `Direcionamento extra do usuario: ${customPrompt}` : ""}`;

    const copyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: copySys },
          { role: "user", content: copyUser },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!copyRes.ok) {
      const t = await copyRes.text();
      console.error("copy error", copyRes.status, t);
      return new Response(JSON.stringify({ error: `copy_${copyRes.status}`, detail: t }), {
        status: copyRes.status === 402 || copyRes.status === 429 ? copyRes.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const copyJson = await copyRes.json();
    let copy: {
      headline: string; subheadline: string; caption: string; hashtags: string[];
      slides?: SlidePlan[];
    };
    try {
      const parsed = JSON.parse(copyJson.choices[0].message.content);
      copy = {
        headline: parsed.headline || parsed.phrase || `${vehicleName}`,
        subheadline: parsed.subheadline || "",
        caption: parsed.caption || `${vehicleName} disponivel agora.`,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ["#SuaMarca", "#Orlando"],
        slides: Array.isArray(parsed.slides) ? parsed.slides : undefined,
      };
    } catch {
      copy = {
        headline: vehicleName,
        subheadline: "Premium em Orlando",
        caption: `${vehicleName} disponivel na GoDrive.`,
        hashtags: ["#SuaMarca", "#Orlando"],
      };
    }

    // Build plan list
    let plan: SlidePlan[];
    if (carousel) {
      if (copy.slides && copy.slides.length === slidesCount) {
        plan = copy.slides;
      } else {
        // Fallback synthetic plan
        plan = [];
        for (let i = 0; i < slidesCount; i++) {
          const role: SlidePlan["role"] = i === 0 ? "cover" : i === slidesCount - 1 ? "cta" : "content";
          plan.push({
            role,
            headline: i === 0 ? copy.headline : role === "cta" ? "Reserve agora" : `Detalhe ${i}`,
            subheadline: i === 0 ? copy.subheadline : "",
          });
        }
      }
    } else {
      plan = [{ role: "cover", headline: copy.headline, subheadline: copy.subheadline }];
    }

    // ── 2) Image composition (per slide) ──────────────────────────
    const isFeed = format === "feed";
    const aspect = isFeed ? "quadrado 1:1 (1024x1024)" : "vertical 9:16 (1024x1792)";
    const logoPosition = isFeed
      ? "logotipo oficial GoDrive no topo central, cerca de 18% da largura, respiro generoso, DIRETAMENTE sobre o fundo escuro da arte (SEM faixa, SEM card, SEM retangulo branco ou claro atras do logo)"
      : "logotipo oficial GoDrive no topo central, cerca de 22% da largura, respiro generoso, DIRETAMENTE sobre o fundo escuro da arte (SEM faixa, SEM card, SEM retangulo branco ou claro atras do logo)";

    const promoVisualBlock = mode === "promo" && promo
      ? `\n\n═══ BLOCO DE OFERTA (OBRIGATORIO NA ARTE) ═══
- Renderize um bloco discreto e elegante com:
  -> Valor "USD ${promo.priceDaily} /dia" em fonte serif media, cor dourado #c9a861
  -> Periodo "${fmtDate(promo.dateStart)} - ${fmtDate(promo.dateEnd)}" em sans-serif fina caixa alta, branco
- Trate como linha editorial de revista. Nunca como badge circular ou sticker.
- NAO use as palavras "PROMO", "OFERTA", "SALE", "DESCONTO".`
      : "";

    const referenceBlock = mode === "reference"
      ? `\n\n═══ REFERENCIA CRIATIVA (OBRIGATORIO RESPEITAR) ═══
A primeira imagem anexada e a REFERENCIA criativa. Use-a como base de TEMA, CONCEITO, COMPOSICAO, paleta, mood, iluminacao, tipografia e elementos visuais marcantes.${refBrief ? `

Briefing extraido da referencia:
- Tema/campanha: ${refBrief.tema}
- Conceito: ${refBrief.conceito}
- Elementos visuais a incorporar (adaptados): ${refBrief.elementosVisuais.join(", ")}
- Paleta: ${refBrief.paleta}
- Mood: ${refBrief.mood}
${refBrief.promo ? `- Oferta a comunicar visualmente: ${refBrief.promo} (renderize como bloco editorial, fonte serif dourada elegante)` : ""}

REGRAS:
- TRADUZA o tema/campanha para a identidade GoDrive (premium, sofisticada, Orlando).
- INCORPORE os elementos visuais marcantes (bandeiras, motivos, cenario etc) de forma elegante.
- SUBSTITUA a marca/logo da referencia pelo logo oficial GoDrive fornecido na ultima imagem.
- NAO copie pessoas, fotos especificas, nem o logotipo da referencia.
- O carro heroi DEVE ser o ${vehicleBrand || ""} ${vehicleName} da foto fornecida (cor, modelo e identidade EXATAS).
- PROIBIDO renderizar nomes, logotipos ou identidade visual de concorrentes (locadoras, marcas automotivas, empresas). Remova ou substitua genericamente antes de compor.` : `
Capture tema, conceito, paleta, composicao e elementos visuais marcantes — adapte para a GoDrive.
NAO copie pessoas, logos nem textos literais da referencia.
PROIBIDO renderizar nomes, logotipos ou identidade visual de concorrentes.`}`
      : "";

    const seasonalBlock = tone === "sazonal" && seasonalTheme
      ? `\n\n═══ TEMA SAZONAL — ${seasonalTheme.label.toUpperCase()} ═══
- Paleta auxiliar: ${seasonalTheme.palette}. Apenas detalhes sutis.
- Motivos: ${seasonalTheme.motifs}. Sempre sofisticados, nunca clipart.`
      : "";

    function buildPrompt(slide: SlidePlan, idx: number): string {
      const carouselHeader = carousel
        ? `\n═══ CARROSSEL — SLIDE ${idx + 1} de ${slidesCount} (${slide.role.toUpperCase()}) ═══
Este slide faz parte de um carrossel coeso. Mantenha IDENTICOS: paleta, tipografia, grade, iluminacao, tratamento de cor, posicao do logo, linha dourada. Variacao APENAS no conteudo e no enquadramento do carro.`
        : "";

      const roleDirective = !carousel
        ? `\n3. TIPOGRAFIA:
   - HEADLINE: "${slide.headline}" (serif display, branco, tracking apertado, parte inferior centralizada)
   - SUBHEADLINE: "${slide.subheadline}" (sans-serif fina caixa alta, dourado #c9a861)
   - ASSINATURA RODAPE: "GODRIVE  ·  ORLANDO"`
        : slide.role === "cover"
          ? `\n3. TIPOGRAFIA (CAPA):
   - HEADLINE GRANDE: "${slide.headline}" (serif display Didot/Bodoni, branco, dominante)
   - SUBHEADLINE: "${slide.subheadline}" (sans-serif fina dourada caixa alta)
   - O carro e o heroi visual.`
          : slide.role === "cta"
            ? `\n3. TIPOGRAFIA (CTA — slide final):
   - CHAMADA: "${slide.headline}" centralizada, serif display branco
   - APOIO: "${slide.subheadline}" sans-serif fina dourada caixa alta
   - "GODRIVE  ·  ORLANDO" no rodape em dourado tracking largo
   - Composicao mais limpa: o carro pode aparecer em silhueta lateral ou parcial, dando peso ao texto.`
            : `\n3. TIPOGRAFIA (CONTEUDO):
   - TITULO: "${slide.headline}" (serif display branco, alinhado a esquerda ou centro)
   - APOIO: "${slide.subheadline}" (sans-serif fina dourada caixa alta)
   ${slide.body ? `- TEXTO CURTO: "${slide.body}" (sans-serif fina branca, 1-2 linhas)` : ""}
   - Enquadre o carro com detalhe diferente da capa (faro, lateral, interior em sugestao, traseira).`;

      return `Crie uma arte EDITORIAL DE LUXO para social media (${aspect}) da GoDrive — locadora premium em Orlando, Florida. Padrao visual: campanha de revista (Mr Porter, Robb Report, Architectural Digest Automotive).${carouselHeader}

═══ COMPOSICAO ═══
1. CARRO (imagem 1): ${vehicleBrand || ""} ${vehicleName} como heroi:
   - Iluminacao tipo studio Peter Lik (rim light dourado, key light suave acima)
   - Contraste alto controlado, pretos profundos com detalhes preservados
   - Reflexos sutis na pintura, particulas douradas finas, bokeh dourado discreto
   - Fundo: gradiente preto absoluto (#000) para azul-marinho (#0a1628) com vinheta dourada

2. LOGOTIPO (imagem 2): ${logoPosition}. Use EXATAMENTE como fornecido.${roleDirective}${promoVisualBlock}

═══ ORTOGRAFIA — OBRIGATORIO ═══
Renderize textos EXATAMENTE como entre aspas. NAO invente, NAO traduza.

═══ ELEMENTOS GRAFICOS ═══
- Linha fina horizontal dourada (1px, #c9a861) como separador editorial
- Respiro generoso (padding minimo 8% das bordas)

═══ PROIBIDO ═══
SEM emojis, stickers, badges, "Save", CTA agressivo, gradientes neon, polaroide, clipart, swooshes. SEM faixa/barra/retangulo branco ou claro atras do logotipo (o logo deve ficar diretamente sobre o fundo escuro da arte). SEM numeracao de slide / indicador de pagina (NAO renderize "01 / 03", "02/3", "Slide 1", paginacao ou similares em lugar nenhum da arte).${referenceBlock}${seasonalBlock}

Resultado: pagina de revista de luxo automotivo. Silencio visual, sofisticacao, atemporal.`;
    }

    async function renderSlide(slide: SlidePlan, idx: number): Promise<string | null> {
      const prompt = buildPrompt(slide, idx);
      // Interleave text labels + images so Gemini understands the role of each image.
      const contentParts: any[] = [];

      // For "reference" mode, put the reference image FIRST and label it strongly.
      if (mode === "reference" && referenceImageDataUrl && referenceImageDataUrl.startsWith("data:image")) {
        contentParts.push({
          type: "text",
          text: "IMAGEM A SEGUIR = REFERENCIA CRIATIVA principal. Inspire-se em TEMA, CONCEITO, COMPOSICAO, paleta, iluminacao, tipografia E elementos visuais marcantes (bandeiras, cenarios, motivos, ofertas). Adapte tudo para a GoDrive. NAO copie pessoas, logos de terceiros, nem fotos literais — recrie o espirito.",
        });
        contentParts.push({ type: "image_url", image_url: { url: referenceImageDataUrl } });
      }

      if (vehiclePhotoUrl) {
        contentParts.push({
          type: "text",
          text: `IMAGEM A SEGUIR = FOTO REAL do carro "${vehicleBrand || ""} ${vehicleName}". Este e o produto que deve aparecer como heroi da arte. Mantenha cor, modelo e identidade visual EXATAMENTE como na foto.`,
        });
        contentParts.push({ type: "image_url", image_url: { url: vehiclePhotoUrl } });
      }

      contentParts.push({
        type: "text",
        text: "IMAGEM A SEGUIR = LOGOTIPO OFICIAL GoDrive. Use EXATAMENTE como fornecido, sem deformar, recolorir ou recriar. Posicione conforme instrucoes do briefing principal.",
      });
      contentParts.push({ type: "image_url", image_url: { url: logoUrl } });

      contentParts.push({ type: "text", text: prompt });

      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image",
          modalities: ["image", "text"],
          messages: [{ role: "user", content: contentParts }],
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text();
        console.error("image error slide", idx, imgRes.status, t);
        throw new Error(`image_${imgRes.status}:${t.slice(0, 200)}`);
      }
      const imgJson = await imgRes.json();
      const msg = imgJson.choices?.[0]?.message;
      const images = msg?.images;
      if (Array.isArray(images) && images.length > 0) {
        const u = images[0]?.image_url?.url || images[0]?.url || "";
        if (typeof u === "string" && u.startsWith("data:image")) return u.split(",")[1] || null;
      }
      if (Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          const u = part?.image_url?.url;
          if (typeof u === "string" && u.startsWith("data:image")) return u.split(",")[1] || null;
        }
      }
      console.error("image no_data slide", idx, JSON.stringify(imgJson).slice(0, 500));
      return null;
    }

    // Render slides in PARALLEL to fit edge-function timeout for carousels.
    // Each gemini-3-pro-image call takes 15-40s; sequential 5x would risk timeout.
    const renderedSlides: { role: SlidePlan["role"]; imageBase64: string; headline: string; subheadline: string }[] = [];
    try {
      const results = await Promise.all(
        plan.map(async (p, i) => {
          const b64 = await renderSlide(p, i);
          if (!b64) throw new Error(`slide_${i}_no_image`);
          return { role: p.role, imageBase64: b64, headline: p.headline, subheadline: p.subheadline };
        }),
      );
      renderedSlides.push(...results);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.startsWith("image_402") || msg.includes(":402")) {
        return new Response(JSON.stringify({ error: "image_402", detail: msg }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.startsWith("image_429") || msg.includes(":429")) {
        return new Response(JSON.stringify({ error: "image_429", detail: msg }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "slide_failed", detail: msg, copy }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        // legacy single-image shape (kept for compatibility)
        imageBase64: renderedSlides[0].imageBase64,
        phrase: copy.headline,
        headline: copy.headline,
        subheadline: copy.subheadline,
        caption: copy.caption,
        hashtags: copy.hashtags,
        format,
        // NEW carousel shape
        carousel,
        slidesCount: renderedSlides.length,
        slides: renderedSlides,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("marketing-generate-post fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
