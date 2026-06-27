// OCR de painel automotivo (odômetro + nível de combustível) via Lovable AI Gateway.
// Recebe { imageBase64, mimeType } e retorna { odometer_miles, fuel_level } para autopreenchimento.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM_PROMPT = `Você é um assistente de OCR especializado em PAINÉIS DE INSTRUMENTOS de carros (dashboard).

Analise a foto do painel aceso e extraia EXATAMENTE estes campos, retornando JSON puro:

{
  "odometer_miles": number | null,           // Leitura do hodômetro em MILHAS (ignore "TRIP A/B"; use o ODO total).
  "fuel_level": "empty" | "1/8" | "1/4" | "3/8" | "1/2" | "5/8" | "3/4" | "7/8" | "full" | null,
  "confidence": "high" | "medium" | "low"
}

Regras:
- Se o painel mostrar km, CONVERTA para milhas (1 km = 0.621371 mi) e arredonde para inteiro.
- Para o tanque, observe quantos traços/segmentos acesos entre E (empty) e F (full) e mapeie ao valor fracionário mais próximo do enum.
- Se a agulha estiver exatamente em E retorne "empty"; em F retorne "full".
- Se um campo não puder ser lido com segurança, retorne null naquele campo.
- Retorne APENAS o JSON, sem markdown, sem explicação.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { imageBase64, mimeType } = body ?? {};
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mt = (mimeType && typeof mimeType === "string") ? mimeType : "image/jpeg";
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mt};base64,${imageBase64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia odômetro (em milhas) e nível de combustível deste painel. Retorne só o JSON." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em alguns segundos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "Falha ao analisar painel." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let extracted: any = {};
    try {
      extracted = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      extracted = m ? JSON.parse(m[0]) : {};
    }

    const VALID_FUEL = ["empty", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "full"];
    const odo = Number(extracted?.odometer_miles);
    const fuel = String(extracted?.fuel_level ?? "");
    const result = {
      odometer_miles: Number.isFinite(odo) && odo >= 0 && odo < 1_000_000 ? Math.round(odo) : null,
      fuel_level: VALID_FUEL.includes(fuel) ? fuel : null,
      confidence: ["high", "medium", "low"].includes(extracted?.confidence) ? extracted.confidence : "medium",
    };

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ocr-dashboard error", err);
    return new Response(JSON.stringify({ error: err?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
