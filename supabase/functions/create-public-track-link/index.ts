// Creates or revokes a public tracking link for a vehicle. Authenticated team only.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return j({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    // Verify team role via RPC (uses has_any_role security-definer)
    const { data: hasRole } = await userClient.rpc('has_any_role', {
      _user_id: userId,
      _roles: ['admin', 'finance', 'operations', 'support'],
    });
    if (!hasRole) return j({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'create');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (action === 'revoke') {
      const t = String(body?.token ?? '');
      if (!/^[A-Za-z0-9_-]{12,80}$/.test(t)) return j({ error: 'invalid_token' }, 400);
      await admin.from('public_track_links').update({ revoked: true }).eq('token', t);
      return j({ ok: true });
    }

    // create
    const vehicleId = String(body?.vehicle_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(vehicleId)) return j({ error: 'invalid_vehicle_id' }, 400);
    const label = body?.label ? String(body.label).slice(0, 80) : null;
    const expiresHours = Number(body?.expires_hours);
    const expires_at = Number.isFinite(expiresHours) && expiresHours > 0
      ? new Date(Date.now() + expiresHours * 3600_000).toISOString()
      : null;

    const newToken = makeToken(28);
    const { error: insErr } = await admin.from('public_track_links').insert({
      token: newToken,
      vehicle_id: vehicleId,
      label,
      expires_at,
      created_by: userId,
    });
    if (insErr) throw insErr;

    return j({ ok: true, token: newToken, expires_at });
  } catch (e) {
    console.error('[create-public-track-link]', e);
    return j({ error: 'internal_error' }, 500);
  }
});

function makeToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
