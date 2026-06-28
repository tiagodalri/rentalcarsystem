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

const ZEUS_LOGO_URL = "https://zeusrentalcar.lovable.app/zeus-z-mark.png";

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
    const copySys = `Voce e copywriter senior da Zeus Rental Car, frota premium em Orlando.
Escreva em portugues do Brasil, voz humana, calorosa e confiante. PROIBIDO: emojis, ponto-e-virgula, travessao, jargao publicitario batido ("imperdivel", "incrivel", "nao perca").
Devolva SOMENTE JSON valido no formato:
{ "phrase": "frase curta de impacto para colocar dentro da arte (max 7 palavras)", "caption": "legenda do post (3 a 5 linhas, fluida)", "hashtags": ["#tag1","#tag2", ...] }
A frase precisa ser memoravel, especifica para o carro, com tom ${toneMap[tone] || toneMap.luxo}.
Hashtags: 6 a 10, misture portugues e ingles, sempre incluir #ZeusRentalCar e #Orlando.`;
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
    let copy: { phrase: string; caption: string; hashtags: string[] };
    try {
      copy = JSON.parse(copyJson.choices[0].message.content);
    } catch {
      copy = { phrase: `${vehicleName} esta na Zeus`, caption: `${vehicleName} disponivel agora.`, hashtags: ["#ZeusRentalCar", "#Orlando"] };
    }

    // ── 2) Image composition ──────────────────────────────────────
    const aspect = format === "feed" ? "quadrado 1:1 (1024x1024)" : "vertical 9:16 (1024x1792)";
    const imagePrompt = `Crie uma arte profissional de social media no formato ${aspect} para a Zeus Rental Car (locadora premium em Orlando).

Use a PRIMEIRA imagem (o carro ${vehicleBrand || ""} ${vehicleName}) como elemento central, tratada com look cinematografico: iluminacao premium, contraste alto, cores ricas, sombras suaves, fundo desfocado em tons escuros elegantes (preto/azul-marinho profundo) com sutil iluminacao dourada.

Use a SEGUNDA imagem (logotipo da Zeus, simbolo do "Z" dourado) posicionada de forma estrategica e elegante: no canto superior direito do feed, ou no topo central no story. Tamanho discreto mas legivel. Mantenha as cores originais do logo intactas.

Adicione a frase em destaque (texto bem renderizado, tipografia serif elegante tipo Cormorant Garamond, cor branco puro com leve sombra dourada): "${copy.phrase}"
Posicione a frase na parte inferior da arte, com bastante respiro.

Inclua um detalhe minimalista dourado: uma linha fina horizontal acima da frase OU um pequeno texto em caixa alta "ZEUS RENTAL CAR · ORLANDO" em letterspacing largo, cor dourado #c9a861.

Estetica final: private bank meets automotive luxury. Sofisticado, escuro, dourado, atemporal. SEM clichês de propaganda, SEM emojis, SEM stickers. Apenas o carro, a frase, o logo e o detalhe dourado.`;

    const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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
