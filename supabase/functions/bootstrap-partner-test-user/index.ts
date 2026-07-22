// Disabled: this function previously created a partner test user without any
// authentication check. Partner accounts are now created via
// `platform-create-partner`, which requires a platform_admin caller.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      ok: false,
      error: "This endpoint is disabled. Use platform-create-partner (platform_admin only).",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
