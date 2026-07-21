
CREATE TABLE public.zapi_config (
  id integer PRIMARY KEY DEFAULT 1,
  instance_id text,
  token text,
  client_token text,
  webhook_secret text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT zapi_config_singleton CHECK (id = 1)
);

-- Intentionally NO grants to anon or authenticated: this table must only be
-- readable/writable via edge functions using the service role key. That way
-- Z-API tokens never reach the browser via PostgREST even if a policy is
-- misconfigured.
GRANT ALL ON public.zapi_config TO service_role;

ALTER TABLE public.zapi_config ENABLE ROW LEVEL SECURITY;
-- No policies: RLS default-deny + no grants means the Data API returns
-- permission errors for any client role. Service role bypasses RLS.
