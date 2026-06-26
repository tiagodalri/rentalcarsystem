// Creates or revokes a public share link for an inspection (delivery / return).
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
    const { data: userData, error: cErr } = await userClient.auth.getUser();
    if (cErr || !userData?.user?.id) return j({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const { data: hasRole } = await userClient.rpc('has_any_role', {
      _user_id: userId,
      _roles: ['admin', 'finance', 'operations', 'support', 'driver'],
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
      const { data: revoked, error: rErr } = await admin
        .from('public_inspection_links')
        .update({ revoked: true })
        .eq('token', t)
        .select('token');
      if (rErr) throw rErr;
      if (!revoked || revoked.length === 0) return j({ error: 'not_found' }, 404);
      return j({ ok: true });
    }

    // create / find existing active link
    const bookingId = String(body?.booking_id ?? '');
    const type = String(body?.type ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return j({ error: 'invalid_booking_id' }, 400);
    if (!['checkin', 'checkout'].includes(type)) return j({ error: 'invalid_type' }, 400);

    // Reuse an active link if one exists (idempotent share)
    const { data: existing } = await admin
      .from('public_inspection_links')
      .select('token, expires_at')
      .eq('booking_id', bookingId)
      .eq('inspection_type', type)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now())) {
      return j({ ok: true, token: existing.token, reused: true, expires_at: existing.expires_at });
    }

    const newToken = makeToken(28);
    const expiresHours = Number(body?.expires_hours);
    const expires_at = Number.isFinite(expiresHours) && expiresHours > 0
      ? new Date(Date.now() + expiresHours * 3600_000).toISOString()
      : null;

    const { error: insErr } = await admin.from('public_inspection_links').insert({
      token: newToken,
      booking_id: bookingId,
      inspection_type: type,
      expires_at,
      created_by: userId,
    });
    if (insErr) throw insErr;

    return j({ ok: true, token: newToken, expires_at });
  } catch (e) {
    console.error('[create-public-inspection-link]', e);
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
