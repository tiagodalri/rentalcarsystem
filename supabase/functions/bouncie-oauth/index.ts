// Bouncie OAuth callback — saves authorization_code immediately, then tries
// to exchange it for an access_token. Never deletes the code on token failure.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

const REDIRECT_SUCCESS = "https://rentalcarsystem.lovable.app/admin?bouncie=connected";
const REDIRECT_ERROR = "https://rentalcarsystem.lovable.app/admin?bouncie=error";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      console.error("[bouncie-oauth] missing ?code");
      return Response.redirect(REDIRECT_ERROR, 302);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Save authorization_code IMMEDIATELY (before token exchange).
    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await admin.from("bouncie_integration").upsert({
      id: 1,
      client_id: BOUNCIE_CLIENT_ID,
      authorization_code: code,
      connected_at: nowIso,
      updated_at: nowIso,
    });
    if (upsertErr) {
      console.error("[bouncie-oauth] failed to persist authorization_code:", upsertErr.message);
    } else {
      console.log("[bouncie-oauth] authorization_code stored");
    }

    // 2) Try to exchange code -> access_token. Don't wipe the code on failure.
    try {
      const tokenResp = await fetch("https://auth.bouncie.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: BOUNCIE_CLIENT_ID,
          client_secret: BOUNCIE_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: BOUNCIE_REDIRECT_URI,
        }),
      });
      const tokenBody = await tokenResp.text();
      console.log("[bouncie-oauth] token response status", tokenResp.status);

      if (tokenResp.ok) {
        let parsed: any = {};
        try { parsed = JSON.parse(tokenBody); } catch { /* ignore */ }
        const accessToken: string | undefined = parsed.access_token;
        const expiresIn: number | undefined = parsed.expires_in;
        if (accessToken) {
          const expiresAt = expiresIn
            ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString()
            : null;
          const { error: tokErr } = await admin
            .from("bouncie_integration")
            .update({
              access_token: accessToken,
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);
          if (tokErr) {
            console.error("[bouncie-oauth] failed to persist token:", tokErr.message);
          } else {
            console.log("[bouncie-oauth] access_token stored, expires_at=", expiresAt);
          }
        } else {
          console.error("[bouncie-oauth] no access_token in body");
        }
      } else {
        console.error("[bouncie-oauth] token exchange failed", tokenResp.status);
      }
    } catch (e) {
      console.error("[bouncie-oauth] token exchange threw:", (e as Error).message);
    }

    // 3) Always redirect to connected (we at least stored the code).
    return Response.redirect(REDIRECT_SUCCESS, 302);
  } catch (e) {
    console.error("[bouncie-oauth] unexpected:", e);
    return Response.redirect(REDIRECT_ERROR, 302);
  }
});
