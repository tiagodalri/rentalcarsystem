// Marketing Studio - Social Post Generator
// Generates a polished social media image (feed or story) using Lovable AI.
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
};

const ZEUS_LOGO_URL = "https://zeusrentalcar.com/zeus-logo-full.png";

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  } catch { return iso; }
}

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
    } = body;
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
        ? `tema sazonal "${seasonalTheme.label}" — ${seasonalTheme.copyHint}. Mantenha a sofisticacao Zeus, jamais kitsch.`
        : "tema sazonal contextual da data atual, sofisticado",
    };

    const promoBlock = mode === "promo" && promo
      ? `\nPROMOCAO ATIVA:\n- Valor diaria: USD ${promo.priceDaily}\n- Periodo: ${fmtDate(promo.dateStart)} ate ${fmtDate(promo.dateEnd)}${promo.hook ? `\n- Gancho: ${promo.hook}` : ""}\nA headline DEVE comunicar oportunidade sem soar apelativa. A caption deve mencionar o valor e o periodo de forma elegante.`
      : "";

    // ── 1) Copywriting ────────────────────────────────────────────
    const copySys = `Voce e copywriter senior de uma agencia premium (Wieden+Kennedy / Mother) trabalhando para a Zeus Rental Car, locadora premium em Orlando.
Escreva em portugues do Brasil impecavel (zero erros), voz humana, calorosa, confiante, cinematografica.
PROIBIDO: emojis, ponto-e-virgula, travessao, jargao publicitario ("imperdivel", "incrivel", "nao perca").
Devolva SOMENTE JSON valido:
{
  "headline": "frase principal curta (3 a 6 palavras)",
  "subheadline": "linha de apoio curta (4 a 8 palavras)",
  "caption": "legenda do post (3 a 5 linhas, micro-historia)",
  "hashtags": ["#tag1","#tag2"]
}
Tom: ${toneMap[tone] || toneMap.luxo}.
Hashtags: 6 a 10, misture portugues e ingles, sempre incluir #ZeusRentalCar e #Orlando.`;

    const copyUser = `Carro: ${vehicleBrand ? vehicleBrand + " " : ""}${vehicleName}
Formato: ${format === "feed" ? "feed quadrado" : "story vertical"}
Tom: ${tone}
Modo: ${mode}${promoBlock}
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
    let copy: { headline: string; subheadline: string; caption: string; hashtags: string[] };
    try {
      const parsed = JSON.parse(copyJson.choices[0].message.content);
      copy = {
        headline: parsed.headline || parsed.phrase || `${vehicleName}`,
        subheadline: parsed.subheadline || "",
        caption: parsed.caption || `${vehicleName} disponivel agora.`,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : ["#ZeusRentalCar", "#Orlando"],
      };
    } catch {
      copy = {
        headline: vehicleName,
        subheadline: "Premium em Orlando",
        caption: `${vehicleName} disponivel na Zeus Rental Car.`,
        hashtags: ["#ZeusRentalCar", "#Orlando"],
      };
    }

    // ── 2) Image composition ──────────────────────────────────────
    const isFeed = format === "feed";
    const aspect = isFeed ? "quadrado 1:1 (1024x1024)" : "vertical 9:16 (1024x1792)";
    const logoPosition = isFeed
      ? "logotipo oficial Zeus no topo central, cerca de 18% da largura, respiro generoso"
      : "logotipo oficial Zeus no topo central, cerca de 22% da largura, respiro generoso";

    const promoVisualBlock = mode === "promo" && promo
      ? `\n\n═══ BLOCO DE OFERTA (OBRIGATORIO NA ARTE) ═══
- Renderize um bloco discreto e elegante na arte com:
  -> Valor "USD ${promo.priceDaily} /dia" em fonte serif media, cor dourado #c9a861
  -> Periodo "${fmtDate(promo.dateStart)} - ${fmtDate(promo.dateEnd)}" em sans-serif fina caixa alta, cor branco
- Posicione o bloco no terco inferior, alinhado com a headline. NUNCA como badge circular ou sticker. Trate como linha editorial de revista.
- NAO use a palavra "PROMO", "OFERTA", "SALE", "DESCONTO". Apenas o valor e o periodo falam por si.`
      : "";

    const referenceBlock = mode === "reference"
      ? `\n\n═══ REFERENCIA VISUAL (imagem extra fornecida) ═══
A ultima imagem anexada e APENAS uma referencia de estilo: capture paleta de cores, mood, tipo de iluminacao, ritmo da composicao e tratamento tipografico. NAO copie o logo da referencia. NAO inclua textos da referencia. O carro Zeus continua sendo o heroi e o logo OFICIAL da Zeus e obrigatorio.`
      : "";

    const seasonalBlock = tone === "sazonal" && seasonalTheme
      ? `\n\n═══ TEMA SAZONAL — ${seasonalTheme.label.toUpperCase()} (OBRIGATORIO) ═══
- Paleta auxiliar: ${seasonalTheme.palette}. Aplique como detalhes (vinheta, particulas, reflexos) SEM dominar o carro.
- Motivos visuais: ${seasonalTheme.motifs}. Sempre sutis, sofisticados, atmosfericos — NUNCA stickers, ilustracoes, clipart ou icones literais.
- Mantenha o padrao editorial Zeus: silencio visual, atemporal, premium. Nada de kitsch, nada caricato.`
      : "";

    const imagePrompt = `Crie uma arte EDITORIAL DE LUXO para social media (${aspect}) da Zeus Rental Car — locadora premium em Orlando, Florida. Padrao visual: campanha de revista (Mr Porter, Robb Report, Architectural Digest Automotive).

═══ COMPOSICAO ═══
1. CARRO (imagem 1): ${vehicleBrand || ""} ${vehicleName} como heroi absoluto:
   - Iluminacao tipo studio Peter Lik (rim light dourado nas bordas, key light suave acima)
   - Contraste alto controlado, pretos profundos com detalhes preservados
   - Reflexos sutis na pintura sugerindo chao de marmore polido
   - Particulas douradas finas, bokeh dourado discreto ao fundo
   - Angulo ligeiramente baixo (hero shot), 55-65% da composicao
   - Fundo: gradiente preto absoluto (#000) para azul-marinho (#0a1628) com vinheta dourada

2. LOGOTIPO (imagem 2): ${logoPosition}. Use EXATAMENTE como fornecido, sem reinterpretar.

3. TIPOGRAFIA:
   - HEADLINE (parte inferior centralizada): "${copy.headline}"
     Fonte serif display (Didot, Bodoni 72, Playfair Display Black), branco #ffffff, tracking apertado
   - SUBHEADLINE (abaixo): "${copy.subheadline}"
     Sans-serif fina caixa alta (Futura Light, Avenir Light), dourado #c9a861, tracking +200
   - ASSINATURA (rodape): "ZEUS RENTAL CAR  ·  ORLANDO"
     Sans-serif fina, dourado #c9a861, tracking extra largo${promoVisualBlock}

═══ ORTOGRAFIA — OBRIGATORIO ═══
Renderize textos EXATAMENTE como entre aspas. NAO invente, NAO traduza.

═══ ELEMENTOS GRAFICOS ═══
- Linha fina horizontal dourada (1px, #c9a861) separando headline da assinatura
- Respiro generoso (padding minimo 8% das bordas)

═══ PROIBIDO ═══
SEM emojis, stickers, badges, "Save", CTA agressivo, gradientes neon, polaroide, clipart, aspas decorativas grandes, swooshes.${referenceBlock}

Resultado: pagina de revista de luxo automotivo. Silencio visual, sofisticacao, atemporal.`;

    const contentParts: any[] = [{ type: "text", text: imagePrompt }];
    if (vehiclePhotoUrl) contentParts.push({ type: "image_url", image_url: { url: vehiclePhotoUrl } });
    contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
    if (mode === "reference" && referenceImageDataUrl && referenceImageDataUrl.startsWith("data:image")) {
      contentParts.push({ type: "image_url", image_url: { url: referenceImageDataUrl } });
    }

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
      console.error("image error", imgRes.status, t);
      return new Response(JSON.stringify({ error: `image_${imgRes.status}`, detail: t, copy }), {
        status: imgRes.status === 402 || imgRes.status === 429 ? imgRes.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imgJson = await imgRes.json();
    const msg = imgJson.choices?.[0]?.message;
    let imageBase64: string | null = null;
    const images = msg?.images;
    if (Array.isArray(images) && images.length > 0) {
      const u = images[0]?.image_url?.url || images[0]?.url || "";
      if (typeof u === "string" && u.startsWith("data:image")) {
        imageBase64 = u.split(",")[1] || null;
      }
    }
    if (!imageBase64 && Array.isArray(msg?.content)) {
      for (const part of msg.content) {
        const u = part?.image_url?.url;
        if (typeof u === "string" && u.startsWith("data:image")) {
          imageBase64 = u.split(",")[1] || null;
          break;
        }
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "no_image_returned", raw: imgJson, copy }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        imageBase64,
        phrase: copy.headline,
        headline: copy.headline,
        subheadline: copy.subheadline,
        caption: copy.caption,
        hashtags: copy.hashtags,
        format,
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
