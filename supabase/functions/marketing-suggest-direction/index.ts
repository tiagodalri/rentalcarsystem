// Marketing Studio - Direction Suggestion
// Returns a concise, high-impact creative direction string crafted in the
// voice of senior brand designers/marketers (Apple, Aesop, Mr Porter, W+K),
// tailored to the GoDrive brand and current generator context.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  vehicleName?: string;
  vehicleBrand?: string;
  format?: "feed" | "story";
  tone?: string;
  mode?: "promo" | "free" | "reference";
  carousel?: boolean;
  slidesCount?: number;
  seasonalLabel?: string;
  promo?: { priceDaily?: string; dateStart?: string; dateEnd?: string; hook?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b = (await req.json()) as Body;

    const ctx = [
      b.vehicleBrand || b.vehicleName ? `Carro: ${b.vehicleBrand || ""} ${b.vehicleName || ""}`.trim() : "Carro: a definir",
      `Formato: ${b.format === "story" ? "Story 9:16" : "Feed 1:1"}${b.carousel ? ` em carrossel de ${b.slidesCount || 3} slides` : ""}`,
      b.tone ? `Tom: ${b.tone}` : "",
      b.mode ? `Modo: ${b.mode}` : "",
      b.seasonalLabel ? `Tema sazonal: ${b.seasonalLabel}` : "",
      b.mode === "promo" && b.promo
        ? `Promo: USD ${b.promo.priceDaily}/dia de ${b.promo.dateStart} a ${b.promo.dateEnd}${b.promo.hook ? ` (gancho: ${b.promo.hook})` : ""}`
        : "",
    ].filter(Boolean).join("\n");

    const sys = `Voce e diretor de criacao senior (Apple, Aesop, Mr Porter, Wieden+Kennedy) trabalhando para a GoDrive — locadora premium em Orlando, publico brasileiro.
Sua tarefa: gerar UM unico paragrafo curto de DIRECIONAMENTO CRIATIVO para a IA que vai criar a arte. Tom editorial de revista, sofisticado, calmo, cinematografico.
Inclua quando fizer sentido: angulo/enquadramento do carro, luz e hora do dia, cenario/atmosfera de Orlando ou Florida, paleta complementar, mood emocional, e UMA ideia de copy curta (headline 3-6 palavras) ENTRE ASPAS.
Portugues do Brasil impecavel, sem emojis, sem travessao, sem ponto-e-virgula, sem jargao publicitario ("imperdivel", "incrivel", "nao perca", "garanta ja").
Maximo 50 palavras. NAO use bullets nem titulos. Devolva SOMENTE JSON: { "suggestion": "..." }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Contexto atual do gerador:\n${ctx}\n\nGere a sugestao de direcionamento criativo.` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.95,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `ai_${res.status}`, detail: t }), {
        status: res.status === 402 || res.status === 429 ? res.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await res.json();
    let suggestion = "";
    try {
      const parsed = JSON.parse(j.choices[0].message.content);
      suggestion = String(parsed.suggestion || "").trim();
    } catch {
      suggestion = String(j.choices?.[0]?.message?.content || "").trim();
    }
    if (!suggestion) {
      return new Response(JSON.stringify({ error: "empty" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
