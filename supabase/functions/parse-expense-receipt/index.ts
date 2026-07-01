// Parse expense receipt (nota fiscal) via Lovable AI Gateway (Gemini 2.5 Flash multimodal).
// Recebe { fileBase64, mimeType } e devolve dados pré-preenchidos da despesa.
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um extrator de dados de notas fiscais e recibos de despesas automotivas (manutenção, mecânica, lavagem, combustível, peças, seguro, documentação, multas, etc.).

Analise a imagem da nota/recibo e devolva JSON estrito:

{
  "amount": number | null,               // valor total pago (USD, número puro, sem cifrão)
  "expense_date": "YYYY-MM-DD" | null,   // data do documento
  "supplier": string | null,             // nome do estabelecimento/loja/oficina
  "type": "maintenance" | "fuel" | "cleaning" | "parts" | "insurance" | "fine" | "documentation" | "other",
  "description": string | null,          // resumo curto do que foi comprado/serviço (máx 120 caracteres)
  "payment_method": string | null,       // "credit_card" | "debit_card" | "cash" | "pix" | "other" se identificável
  "confidence": number                    // 0 a 1, quão confiante você está da extração
}

Regras:
- Se moeda estiver em BRL/R$ mantenha o número como está e note na description.
- Se não conseguir extrair um campo, use null (mas NUNCA invente).
- "type" deve ser o melhor palpite baseado no que aparece na nota. Combustível → fuel. Lava-jato → cleaning. Auto-peças → parts. Oficina/serviço → maintenance. Multa de trânsito → fine. Seguro → insurance. Documentação (DMV/registro) → documentation.
- Retorne APENAS o JSON puro, sem markdown, sem comentário.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    if (!LOVABLE_API_KEY) return json({ error: "AI service não configurado" }, 500);

    const body = await req.json();
    const { fileBase64, mimeType } = body ?? {};
    if (!fileBase64) return json({ error: "Envie fileBase64 + mimeType." }, 400);

    const mt = mimeType || "image/jpeg";
    const dataUrl = String(fileBase64).startsWith("data:")
      ? String(fileBase64)
      : `data:${mt};base64,${fileBase64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta nota/recibo de despesa. Retorne apenas o JSON." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Limite de requisições. Tente novamente em instantes." }, 429);
    if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("parse-expense-receipt AI", aiRes.status, txt);
      return json({ error: "Falha ao processar a nota." }, 502);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const ALLOWED = ["maintenance","fuel","cleaning","parts","insurance","fine","documentation","other"];
    const type = ALLOWED.includes(parsed?.type) ? parsed.type : "other";

    return json({
      data: {
        amount: typeof parsed?.amount === "number" ? parsed.amount : (parsed?.amount ? parseFloat(String(parsed.amount).replace(/[^0-9.\-]/g, "")) : null),
        expense_date: typeof parsed?.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.expense_date) ? parsed.expense_date : null,
        supplier: typeof parsed?.supplier === "string" ? parsed.supplier : null,
        type,
        description: typeof parsed?.description === "string" ? parsed.description.slice(0, 120) : null,
        payment_method: typeof parsed?.payment_method === "string" ? parsed.payment_method : null,
        confidence: typeof parsed?.confidence === "number" ? parsed.confidence : 0.5,
      },
    });
  } catch (err: any) {
    console.error("parse-expense-receipt error", err);
    return json({ error: err?.message || "Erro inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
