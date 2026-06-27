import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();

    const sys = `Você é um analista de revenue management e operações de uma frota premium de aluguel de carros em Orlando.
Responda em português do Brasil, em UM parágrafo único de 4 a 6 frases, tom executivo de CEO, direto e acionável.
Nunca use emojis. Use cifras em USD com formato $1,234. Cite números do payload quando relevantes.
Conecte os indicadores entre si (ex: ocupação alta + ADR baixo = oportunidade de pricing).
Termine com a recomendação mais valiosa em uma frase final começando por "Próxima ação:".`;

    const user = `Métricas atuais da frota (JSON):\n${JSON.stringify(payload, null, 2)}\n\nGere o briefing executivo.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: `gateway_${res.status}` }), {
        status: res.status === 402 || res.status === 429 ? res.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
