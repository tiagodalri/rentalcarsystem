import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PREFIX = "c1fc93e2-39ba-431d-a421-24f9ebd4fb34/checkin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: list } = await supabase.storage.from("inspections").list(PREFIX, { limit: 200 });
  const originals = (list ?? []).map((o) => `${PREFIX}/${o.name}`).filter((n) => !n.includes("-carimbo-final"));
  const signed = await Promise.all(originals.map(async (p) => {
    const { data } = await supabase.storage.from("inspections").createSignedUrl(p, 3600);
    return { path: p, url: data?.signedUrl };
  }));
  return new Response(JSON.stringify(signed, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
