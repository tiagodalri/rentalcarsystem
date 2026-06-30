// E-Pass PDF parser via Lovable AI Gateway (Gemini 2.5 Flash multimodal).
// Recebe { pdfBase64 } com o PDF do portal E-Pass e devolve { tolls: [...], account_number, period_label }.
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um extrator de dados de extratos do portal E-Pass (sistema de pedágios da Flórida/EUA).

O PDF contém uma seção chamada "Vehicle Activity" (atividade por veículo) com colunas:
Transponder Number | Date | Time | Posting Date | Location | Amount | Toll Type

Sua tarefa: identificar TODAS as linhas de pedágio do PDF e devolver um JSON estrito:

{
  "account_number": string | null,
  "period_label": string | null,
  "tolls": [
    {
      "transponder_number": string,
      "date": "YYYY-MM-DD",
      "time": "HH:MM:SS",
      "posting_date": "YYYY-MM-DD",
      "location": string,
      "amount": number,
      "toll_type": string
    }
  ]
}

Regras estritas:
- Datas SEMPRE no formato ISO YYYY-MM-DD (interprete "1-May-26", "18-MAY-2026", "05/01/2026" etc.).
- "time" no formato 24h HH:MM:SS. Se vier "16:18", complete com ":00".
- "amount" como número decimal positivo (sem cifrão, sem vírgula). Use ponto como separador.
- "transponder_number" exatamente como aparece, sem espaços.
- NÃO invente linhas. Se uma célula estiver ilegível, omita a linha inteira.
- Ignore totais, subtotais, descontos, créditos e cabeçalhos.
- Inclua somente eventos da seção de pedágios por veículo.
- Retorne APENAS o JSON puro, sem markdown, sem comentário.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    if (!LOVABLE_API_KEY) return json({ error: "AI service não configurado" }, 500);

    const body = await req.json();
    const { pdfBase64, filename } = body ?? {};
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json({ error: "pdfBase64 é obrigatório" }, 400);
    }
    const dataUrl = pdfBase64.startsWith("data:")
      ? pdfBase64
      : `data:application/pdf;base64,${pdfBase64}`;

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
              {
                type: "text",
                text: `Extraia todos os pedágios deste PDF do E-Pass${filename ? ` (arquivo: ${filename})` : ""}. Retorne só o JSON conforme o schema.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Limite de requisições. Tente novamente em alguns segundos." }, 429);
    if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("epass-pdf-parse AI gateway", aiRes.status, txt);
      return json({ error: "Falha ao processar PDF do E-Pass." }, 502);
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

    const tolls = Array.isArray(parsed?.tolls) ? parsed.tolls : [];
    const cleaned = tolls
      .map((t: any) => ({
        transponder_number: String(t?.transponder_number ?? "").trim(),
        date: String(t?.date ?? "").trim(),
        time: String(t?.time ?? "").trim(),
        posting_date: String(t?.posting_date ?? t?.date ?? "").trim(),
        location: String(t?.location ?? "").trim(),
        amount: typeof t?.amount === "number" ? t.amount : parseFloat(String(t?.amount ?? "").replace(/[^0-9.\-]/g, "")),
        toll_type: String(t?.toll_type ?? "").trim(),
      }))
      .filter(
        (t: any) =>
          t.transponder_number &&
          /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
          !isNaN(t.amount)
      );

    return json({
      data: {
        account_number: typeof parsed?.account_number === "string" ? parsed.account_number : null,
        period_label: typeof parsed?.period_label === "string" ? parsed.period_label : null,
        tolls: cleaned,
      },
    });
  } catch (err: any) {
    console.error("epass-pdf-parse error", err);
    return json({ error: err?.message || "Erro inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
