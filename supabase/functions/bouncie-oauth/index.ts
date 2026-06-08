// Bouncie OAuth callback — exchanges ?code= for an access_token and stores it.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

const REDIRECT_SUCCESS = "https://zeusrentalcar.com/admin?bouncie=connected";
const REDIRECT_ERROR = "https://zeusrentalcar.com/admin?bouncie=error";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return Response.redirect(`${REDIRECT_ERROR}&reason=missing_code`, 302);
    }

    const tokenResp = await fetch("https://auth.bouncie.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: BOUNCIE_CLIENT_ID,
        client_secret: BOUNCIE_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: BOUNCIE_REDIRECT_URI,
      }).toString(),
    });

    const tokenBody = await tokenResp.text();
    if (!tokenResp.ok) {
      console.error("[bouncie-oauth] token exchange failed:", tokenResp.status, tokenBody);
      return Response.redirect(`${REDIRECT_ERROR}&reason=token_exchange`, 302);
    }

    let parsed: any = {};
    try { parsed = JSON.parse(tokenBody); } catch { /* ignore */ }
    const accessToken: string | undefined = parsed.access_token;
    const expiresIn: number | undefined = parsed.expires_in;

    if (!accessToken) {
      console.error("[bouncie-oauth] no access_token in response:", tokenBody);
      return Response.redirect(`${REDIRECT_ERROR}&reason=no_token`, 302);
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString()
      : null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin.from("bouncie_integration").upsert({
      id: 1,
      client_id: BOUNCIE_CLIENT_ID,
      authorization_code: code,
      access_token: accessToken,
      token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[bouncie-oauth] db upsert error:", error.message);
      return Response.redirect(`${REDIRECT_ERROR}&reason=db`, 302);
    }

    return Response.redirect(REDIRECT_SUCCESS, 302);
  } catch (e) {
    console.error("[bouncie-oauth] unexpected:", e);
    return Response.redirect(`${REDIRECT_ERROR}&reason=exception`, 302);
  }
});
