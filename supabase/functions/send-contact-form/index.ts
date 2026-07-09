import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { buildCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nome, email, telefone, mensagem, website } = await req.json();

    // Honeypot
    if (website && website.length > 0) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side validation
    if (!nome || nome.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!mensagem || mensagem.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Mensagem muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    // Check for test override
    const overrideTo = Deno.env.get("EMAIL_OVERRIDE_TO");
    const recipient = overrideTo || "contato@gruposigna.com.br";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Contato Sua Marca</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:30px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;border:1px solid #e0e0e0;">
    <h2 style="color:#0a0a0a;border-bottom:2px solid #d4af37;padding-bottom:10px;">Nova mensagem do site Sua Marca</h2>
    <p><strong>Nome:</strong> ${nome}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Telefone:</strong> ${telefone || "—"}</p>
    <p><strong>Mensagem:</strong></p>
    <p style="background:#f5f5f5;padding:15px;border-radius:6px;white-space:pre-wrap;">${mensagem}</p>
  </div>
</body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sua Marca <contato@rentalcarsystem.lovable.app>",
        to: [recipient],
        reply_to: email,
        subject: `Contato site — ${nome}`,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Resend retornou ${resp.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-contact-form error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
