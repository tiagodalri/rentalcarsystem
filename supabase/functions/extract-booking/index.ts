// Edge function: extract booking data from image/pdf/text using Lovable AI (Gemini)
// Returns a partial booking JSON; UI prefills fields and flags missing as pendentes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um assistente especialista em extrair dados de reservas de aluguel de carro a partir de QUALQUER fonte: prints de conversas de WhatsApp/iMessage/SMS, fotos de anotações em papel (LETRA MANUSCRITA inclusive), PDFs de contratos/recibos, e-mails, transcrições de áudio em português ou inglês, ou texto livre.

Seu objetivo é entender a INTENÇÃO mesmo quando a informação está fragmentada, espalhada em várias mensagens, com abreviações, gírias ou rabiscos. Junte pedaços para formar a reserva completa.

Retorne SOMENTE JSON válido (sem markdown, sem comentários) com este schema:
{
  "customer_name": string|null,
  "customer_email": string|null,
  "customer_phone": string|null,
  "vehicle_name": string|null,
  "pickup_date": string|null,    // YYYY-MM-DD
  "pickup_time": string|null,    // HH:MM (24h)
  "return_date": string|null,    // YYYY-MM-DD
  "return_time": string|null,    // HH:MM (24h)
  "pickup_location": string|null,
  "return_location": string|null,
  "total_price": number|null,
  "currency": "USD"|"BRL"|null,
  "payment_method": string|null,
  "deposit_amount": number|null,
  "franchise_amount": number|null,
  "notes": string|null
}

Regras de interpretação inteligente:
- LETRA MANUSCRITA: leia com calma, considere o contexto. "9" vs "g", "1" vs "7", etc. Se dúvida real → null.
- WhatsApp: identifique quem é o CLIENTE (geralmente o interlocutor, não o atendente). O nome do contato no topo do print costuma ser o cliente.
- DATAS RELATIVAS: "amanhã", "sexta que vem", "dia 15", "próxima segunda" → calcule baseado em hoje = 2026-04-09. "Dia 12 a 15 de junho" → pickup 2026-06-12, return 2026-06-15.
- DATAS AMBÍGUAS: contexto Brasil = DD/MM, EUA = MM/DD. "12/06" sem contexto = junho 12 (Brasil).
- HORÁRIOS: "10 da manhã" = 10:00, "meio-dia" = 12:00, "umas 3 da tarde" = 15:00, "noite" = 19:00 (default).
- LOCAIS: aeroportos viram códigos quando claro (MCO = Orlando Airport). Senão mantenha o nome falado.
- VEÍCULO: extraia marca+modelo se houver ("BMW X5", "Tiguan Highline", "Mustang GT"). Cor/ano em notes.
- PREÇO: total da locação. Caução e franquia separados se mencionados. "300 de caução" → deposit_amount: 300.
- MOEDA: contexto Florida/Orlando = USD por padrão. Brasil = BRL.
- TELEFONE: mantenha código de país se houver (+55, +1).
- ÁUDIO TRANSCRITO: ignore "uh", "tipo assim", repetições. Foque na intenção.
- NUNCA invente. Se de verdade não estiver claro, null.
- Use null em vez de strings vazias.
- Coloque qualquer info útil que não cabe em outro campo (placa, observação especial, voo, etc.) em "notes".`;


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
