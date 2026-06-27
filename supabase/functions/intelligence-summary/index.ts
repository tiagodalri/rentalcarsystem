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

    const sys = `Você é o consultor de inteligência da Zeus Rental Car, uma frota premium de aluguel de carros em Orlando.
Escreva em português do Brasil, em UM parágrafo único de 4 a 6 frases curtas, conversando com o dono da frota como se ele não fosse técnico.
PROIBIDO: emojis, siglas (ROI, MTD, ADR, RevPAC, RFM, KPI, leadtime, z-score, σ), jargão de economia/estatística, palavras em inglês.
Sempre que houver um termo técnico, traduza para linguagem do dia a dia:
- ROI -> "retorno sobre o que foi investido nos carros"
- ADR / diária média -> "valor médio recebido por dia alugado"
- MTD -> "o que já entrou neste mês até hoje"
- ocupação -> "quanto tempo os carros ficam alugados"
- leadtime -> "antecedência com que os clientes reservam"
- cancelamento -> use "reservas que foram canceladas"
Conecte os números entre si de forma humana (ex.: "os carros estão muito alugados mas o valor recebido por dia está baixo — dá pra subir preço").
Cite valores em USD no formato $1,234. Não invente números: use apenas os do payload.
Termine SEMPRE com uma frase começando por "Próxima ação:" trazendo a recomendação mais valiosa e prática (1 ação concreta).`;


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
