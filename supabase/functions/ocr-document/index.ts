// OCR de CNH / Documento via Lovable AI Gateway (Gemini 2.5 Flash multimodal).
// Recebe { imageBase64, mimeType } e retorna campos extraídos para revisão pelo usuário.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM_PROMPT = `Você é um assistente de OCR especializado em documentos brasileiros e americanos (CNH brasileira, Driver License americana, RG, CPF, passaporte, SSN/ID card).

Analise a imagem do documento enviado e extraia EXATAMENTE estes campos, retornando como JSON:

{
  "driver_license": string | null,           // Número da CNH / Driver License number (apenas dígitos/letras, sem espaços/pontos)
  "driver_license_expiry": string | null,    // Validade da CNH no formato YYYY-MM-DD
  "full_name": string | null,                // Nome completo como aparece no documento
  "document_number": string | null,          // CPF / Passport / ID number (sem máscara — só dígitos/letras)
  "date_of_birth": string | null             // Data de nascimento no formato YYYY-MM-DD
}

Regras:
- Se o documento for CNH brasileira, "driver_license" = número de registro da CNH (11 dígitos geralmente). "document_number" = CPF se visível.
- Se for Driver License americana, "driver_license" = DL number. "document_number" = SSN/ID se aparecer; senão null.
- Se for Passaporte, "driver_license" = null, "document_number" = número do passaporte.
- Datas SEMPRE em YYYY-MM-DD. Se não conseguir ler, retorne null.
- Não invente dados. Se um campo não estiver visível ou ilegível, retorne null.
- Retorne APENAS o JSON puro, sem markdown, sem explicação.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
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
              { type: "text", text: "Extraia os campos deste documento conforme o schema. Retorne só o JSON." },
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
      return new Response(JSON.stringify({ error: "Falha ao processar documento." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let extracted: Record<string, string | null> = {};
    try {
      extracted = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      // Try to extract JSON block
      const m = String(content).match(/\{[\s\S]*\}/);
      extracted = m ? JSON.parse(m[0]) : {};
    }

    // Normalize: keep only known keys + trim strings
    const allowed = ["driver_license", "driver_license_expiry", "full_name", "document_number", "date_of_birth"];
    const result: Record<string, string | null> = {};
    for (const k of allowed) {
      const v = (extracted as any)?.[k];
      result[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ocr-document error", err);
    return new Response(JSON.stringify({ error: err?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
