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

    const sys = `Você é o consultor de inteligência da Zeus Rental Car, uma frota premium de aluguel de carros em Orlando, falando direto com o dono da frota.
Escreva em português do Brasil, em 2 parágrafos curtos (5 a 8 frases no total), conversando como se ele não fosse técnico.
PROIBIDO: emojis, siglas (ROI, MTD, ADR, RevPAC, RFM, KPI, leadtime, z-score, σ), jargão de economia/estatística, palavras em inglês.
Traduza qualquer termo técnico:
- retorno -> "retorno sobre o que foi investido"
- diária média -> "valor médio recebido por dia alugado"
- ocupação -> "quanto tempo os carros ficam alugados"
- antecedência -> "com quantos dias os clientes reservam antes"

REGRA DE OURO: use o JSON inteiro como base. Cite SEMPRE pelo menos 3 carros pelo NOME (do top5GeradoresDeReceita e/ou piorRetorno), com seus números: quanto foi investido, há quanto tempo está na frota, quanto já gerou, e o retorno. Combine isso com a concentração de receita (ex.: "X% da sua receita vem de Y carros que representam só Z% do investimento"). Relacione carros entre si quando fizer sentido (trocasSugeridas).
Cite valores em USD no formato $1,234. Não invente números: use SOMENTE os do payload.
O primeiro parágrafo é a leitura geral da frota (saúde do negócio, concentração de receita, retorno, ocupação, pipeline futuro).
O segundo parágrafo é onde está o dinheiro escondido: nomes de carros específicos para olhar, troca sugerida ou ajuste de preço, e termina com uma frase começando por "Próxima ação:" com 1 recomendação concreta e mensurável.`;


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
