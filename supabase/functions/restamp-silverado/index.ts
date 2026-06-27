import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const PREFIX = "c1fc93e2-39ba-431d-a421-24f9ebd4fb34/checkin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  if (action === "list") {
    const { data } = await sb.storage.from("inspections").list(PREFIX, { limit: 500 });
    const items = await Promise.all(
      (data ?? [])
        .filter((d) => !d.name.includes("-carimbo-final"))
        .map(async (d) => {
          const { data: s } = await sb.storage.from("inspections").createSignedUrl(`${PREFIX}/${d.name}`, 3600);
          return { name: d.name, url: s?.signedUrl };
        }),
    );
    return new Response(JSON.stringify(items), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (action === "upload" && req.method === "POST") {
    const { name, base64 } = await req.json();
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const target = `${PREFIX}/${name.replace(/\.jpe?g$/i, "")}-carimbo-final.jpg`;
    const { error } = await sb.storage.from("inspections").upload(target, bin, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, path: target }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response("not found", { status: 404, headers: cors });
});
