// Public-by-design endpoint. Anyone with the token can read a single inspection's report.
// No auth required. The token is the secret; revocation/expiration is enforced here.
// Photos and signatures are returned as fresh signed URLs (the `inspections` bucket is private).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const INSPECTIONS_BUCKET = 'inspections';
const SIGNED_TTL = 3600;

function extractPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return null;
  if (value.startsWith('http')) {
    const marker = `/${INSPECTIONS_BUCKET}/`;
    const i = value.indexOf(marker);
    if (i === -1) return null;
    return value.slice(i + marker.length).split('?')[0];
  }
  return value;
}

async function sign(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('data:')) return value; // inline (signatures)
  const path = extractPath(value);
  if (!path) return null;
  const { data } = await supabase.storage.from(INSPECTIONS_BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

async function signList<T extends { url?: string | null }>(items: T[] | null | undefined): Promise<T[]> {
  if (!Array.isArray(items)) return [];
  return Promise.all(items.map(async (it) => ({ ...it, url: (await sign(it.url ?? null)) ?? it.url ?? null })));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token')?.trim();
    if (!token || token.length < 12 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json({ error: 'invalid_token' }, 400);
    }

    const { data: link, error: linkErr } = await supabase
      .from('public_inspection_links')
      .select('token, booking_id, inspection_type, expires_at, revoked, view_count')
      .eq('token', token)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: 'not_found' }, 404);
    if (link.revoked) return json({ error: 'revoked' }, 410);
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return json({ error: 'expired' }, 410);
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_number, customer_name, pickup_date, return_date, pickup_location, return_location, vehicle_id')
      .eq('id', link.booking_id)
      .maybeSingle();
    if (!booking) return json({ error: 'booking_missing' }, 404);

    const { data: vehicle } = booking.vehicle_id
      ? await supabase.from('vehicles').select('id, name, plate, color, year').eq('id', booking.vehicle_id).maybeSingle()
      : { data: null };

    const { data: inspection } = await supabase
      .from('vehicle_inspections')
      .select('*')
      .eq('booking_id', link.booking_id)
      .eq('type', link.inspection_type)
      .maybeSingle();
    if (!inspection) return json({ error: 'inspection_missing' }, 404);

    const exterior_photos = await signList<{ position: string; url: string | null }>(inspection.exterior_photos as any);
    const damages = await Promise.all(
      ((inspection.damages as any[]) ?? []).map(async (d) => ({
        ...d,
        photo_url: d?.photo_url ? await sign(d.photo_url) : null,
      })),
    );
    const agent_signature = await sign(inspection.agent_signature);
    const customer_signature = await sign(inspection.customer_signature);

    // Atomic counter bump via RPC (avoids the read-modify-write race that
    // would undercount concurrent opens of the same link).
    supabase.rpc('bump_public_inspection_link_view', { _token: token }).then(() => {});

    return json({
      type: link.inspection_type,
      booking: {
        booking_number: booking.booking_number,
        customer_name: booking.customer_name,
        pickup_date: booking.pickup_date,
        return_date: booking.return_date,
        pickup_location: booking.pickup_location,
        return_location: booking.return_location,
      },
      vehicle: vehicle ? {
        name: vehicle.name, plate: vehicle.plate, color: vehicle.color, year: vehicle.year,
      } : null,
      inspection: {
        odometer_reading: inspection.odometer_reading,
        fuel_level: inspection.fuel_level,
        accessories_check: inspection.accessories_check,
        damages,
        exterior_photos,
        notes: inspection.notes,
        agent_name: inspection.agent_name,
        agent_signature,
        customer_signature,
        completed_at: inspection.completed_at,
      },
      expires_at: link.expires_at,
      server_time: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[public-inspection-view]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
