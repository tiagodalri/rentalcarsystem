// Edge function: extract booking data from image/pdf/text using Lovable AI (Gemini)
// Returns a partial booking JSON; UI prefills fields and flags missing as pendentes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um assistente que extrai dados de reservas de aluguel de carro a partir de prints de conversas de WhatsApp, fotos, PDFs ou texto livre em português ou inglês.

Retorne SOMENTE JSON válido (sem markdown, sem comentários) com este schema:
{
  "customer_name": string|null,
  "customer_email": string|null,
  "customer_phone": string|null, // formato livre, mantenha como aparece
  "vehicle_name": string|null,   // nome do carro como mencionado (ex: "Tiguan", "BMW X5", "Corvette")
  "pickup_date": string|null,    // YYYY-MM-DD
  "pickup_time": string|null,    // HH:MM
  "return_date": string|null,    // YYYY-MM-DD
  "return_time": string|null,    // HH:MM
  "pickup_location": string|null,
  "return_location": string|null,
  "total_price": number|null,    // apenas o número
  "currency": "USD"|"BRL"|null,
  "payment_method": string|null, // ex: "Cartão de Crédito", "PIX", "Zelle", "Stripe", "PayPal", "Dinheiro"
  "deposit_amount": number|null,
  "franchise_amount": number|null,
  "notes": string|null           // qualquer informação extra relevante encontrada
}

Regras:
- Se algum campo não estiver claro, coloque null. NUNCA invente.
- Datas: interprete formatos brasileiros (DD/MM) e americanos (MM/DD) com contexto. Ano atual = 2026 se não especificado.
- Telefone: mantenha código de país se houver.
- Use null em vez de strings vazias.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { imageBase64, mimeType, text } = await req.json();
    if (!imageBase64 && !text) {
      return new Response(JSON.stringify({ error: "Envie imageBase64 ou text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    if (text) userContent.push({ type: "text", text: `Extraia os dados desta mensagem:\n\n${text}` });
    if (imageBase64) {
      userContent.push({ type: "text", text: "Extraia os dados de reserva desta imagem:" });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType || "image/png"};base64,${imageBase64}` },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error ${aiResp.status}: ${errTxt}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // fallback: tentar extrair JSON do texto
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-booking error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
