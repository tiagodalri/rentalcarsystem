
CREATE TABLE IF NOT EXISTS public.chat_presence (
  phone text PRIMARY KEY,
  status text NOT NULL DEFAULT 'available',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_presence TO authenticated;
GRANT ALL ON public.chat_presence TO service_role;

ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view presence"
  ON public.chat_presence FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(
      auth.uid(),
      ARRAY['admin','operations','finance','support']::app_role[]
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;
ALTER TABLE public.chat_presence REPLICA IDENTITY FULL;
