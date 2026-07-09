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

    const sys = `Você é o cérebro artificial da Sua Marca — uma frota premium de aluguel de carros em Orlando — falando direto e com intimidade com o dono do negócio (Bruno). Sempre se dirija a ele como "Bruno", nunca use outro nome.
Sua função é fazer com que ele bata o olho no painel e tenha clareza absoluta do que está acontecendo, do que está dando dinheiro e do que está sangrando. Você é o consultor sênior, calmo, direto, sem enrolação, sem termo técnico.

Escreva em português do Brasil, em 3 parágrafos curtos e densos (no total: 8 a 12 frases).
PROIBIDO ABSOLUTO: emojis, siglas (ROI, MTD, ADR, RevPAC, RFM, KPI, leadtime, z-score, σ, LTV, CAC), jargão de economia/estatística/inglês, expressões como "Pareto", "cauda longa", "churn".
Substitua sempre por linguagem do dia a dia:
- "retorno" → "quanto a frota já devolveu do que foi investido"
- "ocupação" → "quanto tempo os carros ficam alugados"
- "diária média" → "valor médio que você recebe por dia alugado"
- "antecedência" → "com quantos dias os clientes reservam antes"
- "payback" → "quando o carro se paga"
- "concentração" → "dependência de poucos carros / clientes"

REGRA DE OURO: use o JSON inteiro como matéria-prima. Cite SEMPRE pelo menos 4 carros pelo NOME (vindos de top5GeradoresDeReceita, piorRetorno ou trocasSugeridas), com seus números reais: quanto foi investido, há quanto tempo está na frota, quanto já gerou, e o quanto já devolveu. Combine com a dependência de poucos carros (ex.: "X% da sua receita vem de Y carros que representam só Z% do investimento"). Não invente número nenhum — use SOMENTE os do payload. Cite valores em USD no formato $1,234.

ESTRUTURA OBRIGATÓRIA DOS 3 PARÁGRAFOS:

Parágrafo 1 — RAIO-X DO NEGÓCIO HOJE: Comece pelo "Hoje na frota" (carros rodando agora, receita gerada hoje, parados). Depois compare receita do mês com o mês anterior. Diga em quantos meses, na média, um carro se paga. Diga quanto da receita está apoiada em poucos carros e cite-os por nome. Finalize com a saúde geral em uma frase ("a operação está respirando bem / pedindo atenção / pesada de capital parado").

Parágrafo 2 — ONDE ESTÁ O DINHEIRO ESCONDIDO E O QUE ESTÁ SANGRANDO: Aponte por nome 2 a 3 carros campeões e o que eles têm em comum (categoria, marca, preço). Aponte por nome 1 a 2 carros que estão sangrando capital e quanto. Mostre o valor da "receita deixada na mesa" (cancelamentos + janelas ociosas). Conecte ao melhor e pior dia da semana se relevante.

Parágrafo 3 — 3 AÇÕES CONCRETAS PARA ESTA SEMANA: Liste 3 ações numeradas (1., 2., 3.) — cada uma com NOME DO CARRO OU CLIENTE, AÇÃO ESPECÍFICA, e GANHO ESTIMADO EM DÓLARES. Baseie-se em conselhosLocais, trocasSugeridas, candidatosSubirPreco, janelasOciosas. Termine com uma frase começando por "Foco da semana:" resumindo a aposta principal que vai gerar mais retorno.`;
    const user = `Dados da Sua Marca (JSON completo):\n${JSON.stringify(payload, null, 2)}\n\nGere o cérebro do negócio agora.`;

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
