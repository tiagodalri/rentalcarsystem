// Marketing Studio - Social Post Generator
// Generates a polished social media image (feed or story) using Lovable AI:
// 1) Writes an impactful humanized phrase + caption + hashtags (Gemini Flash)
// 2) Composes the final image with vehicle photo + Zeus logo (Gemini 3 Pro Image)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  vehicleName: string;
  vehicleBrand?: string;
  vehiclePhotoUrl?: string | null;
  format: "feed" | "story";
  tone: "luxo" | "aventura" | "familia" | "promocao" | "lancamento";
  customPrompt?: string;
};

// Logotipo oficial da Zeus (mesmo usado na home do site) — versão alta resolução.
const ZEUS_LOGO_URL = "https://zeusrentalcar.lovable.app/zeus-logo-full.png";
const ZEUS_MARK_URL = "https://zeusrentalcar.lovable.app/zeus-z-mark.png";

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
    const { vehicleName, vehicleBrand, vehiclePhotoUrl, format, tone, customPrompt } = body;
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
    };

    // ── 1) Copywriting ────────────────────────────────────────────
    const copySys = `Voce e copywriter senior de uma agencia premium (estilo Wieden+Kennedy / Mother) trabalhando para a Zeus Rental Car, locadora premium em Orlando.
Escreva em portugues do Brasil impecavel (zero erros ortograficos), voz humana, calorosa, confiante e cinematografica.
PROIBIDO: emojis, ponto-e-virgula, travessao, jargao publicitario batido ("imperdivel", "incrivel", "nao perca", "venha conhecer").
Devolva SOMENTE JSON valido no formato:
{
  "headline": "frase principal curta (3 a 6 palavras, impactante, sem nome do carro)",
  "subheadline": "linha de apoio curta (4 a 8 palavras, complementa a headline)",
  "caption": "legenda do post (3 a 5 linhas fluidas, conta uma micro-historia)",
  "hashtags": ["#tag1","#tag2", ...]
}
Tom desejado: ${toneMap[tone] || toneMap.luxo}.
Hashtags: 6 a 10, misture portugues e ingles, sempre incluir #ZeusRentalCar e #Orlando.
ATENCAO: revise cada palavra. Erros de ortografia sao inaceitaveis.`;
    const copyUser = `Carro: ${vehicleBrand ? vehicleBrand + " " : ""}${vehicleName}
Formato: ${format === "feed" ? "feed quadrado" : "story vertical"}
Tom: ${tone}
${customPrompt ? `Direcionamento extra: ${customPrompt}` : ""}`;

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
      ? "logotipo oficial da Zeus posicionado no topo central, ocupando cerca de 18% da largura, com respiro generoso ao redor"
      : "logotipo oficial da Zeus posicionado no topo central, ocupando cerca de 22% da largura, com respiro generoso ao redor";

    const imagePrompt = `Crie uma arte EDITORIAL DE LUXO para social media (${aspect}) da Zeus Rental Car — locadora premium em Orlando, Florida. Padrao visual: campanha de revista (estilo Mr Porter, Robb Report, Architectural Digest Automotive).

═══ COMPOSICAO ═══
1. CARRO (imagem 1): ${vehicleBrand || ""} ${vehicleName} como heroi absoluto da arte. Tratamento color grading cinematografico:
   - Iluminacao tipo studio Peter Lik (rim light dourado nas bordas da carroceria, key light suave acima)
   - Contraste alto controlado, pretos profundos preservando detalhes
   - Reflexos sutis na pintura sugerindo um chao de marmore polido
   - Particulas douradas finas no ar, bokeh dourado discreto ao fundo
   - Angulo ligeiramente baixo (hero shot), carro ocupando 55-65% da composicao
   - Fundo: gradiente de preto absoluto (#000) para azul-marinho profundo (#0a1628) com vinheta dourada quente

2. LOGOTIPO (imagem 2): ${logoPosition}. Use o logotipo EXATAMENTE como fornecido, sem reinterpretar, sem trocar fontes, sem mudar cores, sem adicionar elementos. Preserve transparencia.

3. TIPOGRAFIA — REGRA CRITICA:
   - HEADLINE (parte inferior, centralizado): "${copy.headline}"
     -> Fonte serif display de luxo (estilo Didot, Bodoni 72, Playfair Display Black)
     -> Cor branco puro #ffffff
     -> Tamanho grande, peso regular, tracking levemente apertado
   - SUBHEADLINE (logo abaixo da headline, menor): "${copy.subheadline}"
     -> Fonte sans-serif fina em caixa alta (estilo Futura Light, Avenir Light)
     -> Cor dourado champagne #c9a861
     -> Letter-spacing largo (tracking +200)
   - ASSINATURA (rodape, bem pequena, caixa alta): "ZEUS RENTAL CAR  ·  ORLANDO"
     -> Sans-serif fina, dourado #c9a861, letter-spacing extra largo

═══ ORTOGRAFIA — OBRIGATORIO ═══
Renderize o texto EXATAMENTE como fornecido entre aspas. NAO invente, NAO traduza, NAO altere letras. Cada caractere conta. Se houver duvida sobre uma letra, prefira renderizar a frase mais limpa a errar.

═══ ELEMENTOS GRAFICOS ═══
- Uma linha fina horizontal dourada (1px, #c9a861) separando headline da assinatura
- Cantos da arte: respiro generoso (padding minimo 8% das bordas)
- Opcional: monograma "Z" muito sutil em marca d'agua no canto, opacidade 5%

═══ PROIBIDO ═══
SEM emojis, SEM stickers, SEM badges, SEM "Save", SEM precos, SEM CTA agressivo, SEM gradientes neon, SEM texturas de papel rasgado, SEM frames de polaroide, SEM clipart, SEM aspas decorativas grandes, SEM swooshes/curvas decorativas.

Resultado final: uma pagina de revista de luxo automotivo. Silencio visual, sofisticacao, peso editorial. Atemporal.`;

    const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: imagePrompt },
              ...(vehiclePhotoUrl
                ? [{ type: "image_url", image_url: { url: vehiclePhotoUrl } }]
                : []),
              { type: "image_url", image_url: { url: ZEUS_LOGO_URL } },
            ],
          },
        ],
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
    // Gateway normalizes to OpenAI-style: look for images array on message
    let imageBase64: string | null = null;
    const images = msg?.images;
    if (Array.isArray(images) && images.length > 0) {
      const u = images[0]?.image_url?.url || images[0]?.url || "";
      if (typeof u === "string" && u.startsWith("data:image")) {
        imageBase64 = u.split(",")[1] || null;
      }
    }
    // fallback: search inside content
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
        phrase: copy.phrase,
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
