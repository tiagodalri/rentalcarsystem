import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PREFIX = "c1fc93e2-39ba-431d-a421-24f9ebd4fb34/checkin";
Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await sb.storage.from("inspections").list(PREFIX, { limit: 500 });
  return new Response(JSON.stringify(data?.map(d=>d.name), null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
