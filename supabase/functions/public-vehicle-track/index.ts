// Public-by-design endpoint. Anyone with the token can read the vehicle's latest live position.
// No auth required. The token is the secret; revocation/expiration is enforced here.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token')?.trim();
    if (!token || token.length < 12 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json({ error: 'invalid_token' }, 400);
    }

    const { data: link, error: linkErr } = await supabase
      .from('public_track_links')
      .select('token, vehicle_id, label, expires_at, revoked')
      .eq('token', token)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return json({ error: 'not_found' }, 404);
    if (link.revoked) return json({ error: 'revoked' }, 410);
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return json({ error: 'expired' }, 410);
    }

    // Fetch vehicle (only public-safe fields)
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, name, plate, color, year')
      .eq('id', link.vehicle_id)
      .maybeSingle();
    if (!vehicle) return json({ error: 'vehicle_missing' }, 404);

    // Latest live position
    const { data: tel } = await supabase
      .from('vehicle_telemetry')
      .select('lat, lng, speed, heading, address, last_seen, status, fuel_percent, odometer_mi')
      .eq('vehicle_id', link.vehicle_id)
      .maybeSingle();

    // Current/most recent trip — for path drawing
    const { data: trip } = await supabase
      .from('vehicle_trips')
      .select('id, started_at, ended_at, distance_mi, max_speed_mph, avg_speed_mph, gps, raw')
      .eq('vehicle_id', link.vehicle_id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Update telemetry on the link (fire-and-forget)
    supabase
      .from('public_track_links')
      .update({ last_viewed_at: new Date().toISOString(), view_count: (await currentCount(token)) + 1 })
      .eq('token', token)
      .then(() => {});

    let gpsEncoded: string | null = null;
    if (trip) {
      const raw: any = trip.raw ?? {};
      gpsEncoded = (typeof raw.gps === 'string' ? raw.gps : null) ?? (typeof trip.gps === 'string' ? (trip.gps as any) : null);
    }

    return json({
      label: link.label ?? null,
      vehicle: {
        name: vehicle.name,
        plate: vehicle.plate,
        color: vehicle.color,
        year: vehicle.year,
      },
      position: tel
        ? {
            lat: tel.lat, lng: tel.lng,
            speed: tel.speed, heading: tel.heading,
            address: tel.address, last_seen: tel.last_seen,
            status: tel.status, fuel_percent: tel.fuel_percent,
            odometer_mi: tel.odometer_mi,
          }
        : null,
      trip: trip
        ? {
            id: trip.id,
            started_at: trip.started_at,
            ended_at: trip.ended_at,
            in_progress: trip.ended_at == null,
            distance_mi: trip.distance_mi,
            max_speed_mph: trip.max_speed_mph,
            avg_speed_mph: trip.avg_speed_mph,
            gps: gpsEncoded,
          }
        : null,
      server_time: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[public-vehicle-track]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

async function currentCount(token: string): Promise<number> {
  const { data } = await supabase
    .from('public_track_links').select('view_count').eq('token', token).maybeSingle();
  return Number(data?.view_count ?? 0);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
