import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PREFIX = "c1fc93e2-39ba-431d-a421-24f9ebd4fb34/checkin";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "1782511432957-nqwcb-Traseira.jpg";
  const { data } = await sb.storage.from("inspections").createSignedUrl(`${PREFIX}/${name}`, 3600);
  return new Response(JSON.stringify({ url: data?.signedUrl }), { headers: { ...cors, "Content-Type": "application/json" } });
});
