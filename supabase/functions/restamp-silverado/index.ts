// One-shot reprocessor: take the ORIGINAL inspection photos of the Silverado
// check-in (booking c1fc93e2…), burn a single clean carimbo on each, and
// overwrite the "-carimbo-final.jpg" variants that currently have double
// stamps + blurred squares.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const BUCKET = "inspections";
const INSPECTION_ID = "a1388bfc-e319-4cd5-b637-e18412525458";
const PREFIX = "c1fc93e2-39ba-431d-a421-24f9ebd4fb34/checkin/";
const ADDRESS = "8810 Albury Drive, Orlando, FL 32829";

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pad = (n: number) => String(n).padStart(2, "0");

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatDate(d: Date) {
  return `${pad(d.getDate())}/${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

// Render a line of text as an ImageScript Image (white fill + dark stroke + soft shadow)
async function renderLine(text: string, size: number): Promise<Image> {
  // ImageScript renderText only supports a font buffer. Fetch a Helvetica-like font once.
  const font = await getFont();
  // Render twice: stroke (black, slightly bigger) then fill (white) — simulates outline.
  const fill = Image.renderText(font, size, text, 0xffffffff);
  // Wider black backdrop for contrast.
  const stroke = Image.renderText(font, size, text, 0x000000ff);
  // Compose: shadowed black behind, white text on top, offset 0,0.
  const w = Math.max(fill.width, stroke.width) + 8;
  const h = Math.max(fill.height, stroke.height) + 8;
  const out = new Image(w, h);
  // Multi-pass dark halo for legibility.
  for (const [dx, dy] of [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,2],[-2,2],[2,-2]]) {
    out.composite(stroke, 4 + dx, 4 + dy);
  }
  out.composite(fill, 4, 4);
  return out;
}

let cachedFont: Uint8Array | null = null;
async function getFont(): Promise<Uint8Array> {
  if (cachedFont) return cachedFont;
  const url = "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf";
  const res = await fetch(url);
  cachedFont = new Uint8Array(await res.arrayBuffer());
  return cachedFont;
}

async function stamp(buf: Uint8Array, date: Date, address: string): Promise<Uint8Array> {
  const img = await Image.decode(buf);
  const base = Math.max(28, Math.round(Math.min(img.width, img.height) * 0.048));
  const lines = [
    formatTime(date),
    formatDate(date),
    ...address.split(/,\s*/).map((s) => s.trim()).filter(Boolean),
  ];
  const rendered: Image[] = [];
  for (const line of lines) rendered.push(await renderLine(line, base));

  const lineGap = Math.round(base * 0.25);
  const totalH = rendered.reduce((s, r) => s + r.height, 0) + lineGap * (rendered.length - 1);
  const marginX = Math.round(base * 0.9);
  const marginY = Math.round(base * 0.9);
  let y = img.height - marginY - totalH;
  for (const r of rendered) {
    const x = img.width - marginX - r.width;
    img.composite(r, Math.max(0, x), Math.max(0, y));
    y += r.height + lineGap;
  }
  return await img.encodeJPEG(90);
}

// Times derived from the upload timestamp prefix in the filename (ms since epoch).
function fileTimestampToDate(name: string): Date {
  const m = name.match(/\/(\d{13})-/);
  if (m) return new Date(Number(m[1]));
  return new Date();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: list, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(PREFIX.replace(/\/$/, ""), { limit: 200 });
  if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: corsHeaders });

  const originals = (list ?? [])
    .map((o) => o.name)
    .filter((n) => !n.includes("-carimbo-final"))
    .map((n) => PREFIX + n);

  const results: Array<{ src: string; dst: string; ok: boolean; err?: string }> = [];
  for (const src of originals) {
    const dst = src.replace(/\.jpg$/i, "-carimbo-final.jpg");
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(src);
      if (dlErr || !blob) throw new Error(dlErr?.message || "download failed");
      const date = fileTimestampToDate(src);
      const stamped = await stamp(new Uint8Array(await blob.arrayBuffer()), date, ADDRESS);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(dst, stamped, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      results.push({ src, dst, ok: true });
    } catch (e) {
      results.push({ src, dst, ok: false, err: String((e as Error).message ?? e) });
    }
  }

  return new Response(JSON.stringify({ inspection: INSPECTION_ID, count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
