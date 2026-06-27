CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_name text,
  event_type text NOT NULL,
  event_name text,
  path text,
  referrer text,
  target_id text,
  metadata jsonb,
  ip text,
  city text,
  region text,
  country text,
  device text,
  browser text,
  os text,
  session_id text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT INSERT ON public.activity_logs TO anon;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins (role app_role 'admin') can read everything
CREATE POLICY "Admins read all activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own events
CREATE POLICY "Users insert own activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Allow anon to insert (pre-login events like failed login, page views of public pages)
CREATE POLICY "Anon insert activity logs"
  ON public.activity_logs FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE INDEX idx_activity_logs_user_created ON public.activity_logs (user_id, created_at DESC);
CREATE INDEX idx_activity_logs_session ON public.activity_logs (session_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_type ON public.activity_logs (event_type);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;