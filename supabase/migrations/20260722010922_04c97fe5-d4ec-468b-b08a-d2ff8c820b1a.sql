
-- ============================================================
-- WHATSAPP STATUSES (Stories)
-- ============================================================
CREATE TABLE public.whatsapp_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_type text NOT NULL CHECK (status_type IN ('text','image','video')),
  text_content text,
  background_color text,
  font text,
  media_url text,
  caption text,
  is_mine boolean NOT NULL DEFAULT true,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by_name text,
  external_status_id text,
  external_zaap_id text,
  view_count integer NOT NULL DEFAULT 0,
  posted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_statuses_expires_at ON public.whatsapp_statuses(expires_at);
CREATE INDEX idx_whatsapp_statuses_posted_at  ON public.whatsapp_statuses(posted_at DESC);
CREATE INDEX idx_whatsapp_statuses_ext_id     ON public.whatsapp_statuses(external_status_id) WHERE external_status_id IS NOT NULL;
CREATE INDEX idx_whatsapp_statuses_ext_zaap   ON public.whatsapp_statuses(external_zaap_id) WHERE external_zaap_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_statuses TO authenticated;
GRANT ALL ON public.whatsapp_statuses TO service_role;

ALTER TABLE public.whatsapp_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp statuses"
  ON public.whatsapp_statuses FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can insert whatsapp statuses"
  ON public.whatsapp_statuses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can update whatsapp statuses"
  ON public.whatsapp_statuses FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Admin can delete whatsapp statuses"
  ON public.whatsapp_statuses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enforce 24h expiration server-side (do NOT trust client)
CREATE OR REPLACE FUNCTION public.whatsapp_status_set_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.posted_at IS NULL THEN
    NEW.posted_at := now();
  END IF;
  NEW.expires_at := NEW.posted_at + interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_whatsapp_status_set_expiry
  BEFORE INSERT ON public.whatsapp_statuses
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_status_set_expiry();

-- ============================================================
-- WHATSAPP STATUS VIEWS
-- ============================================================
CREATE TABLE public.whatsapp_status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.whatsapp_statuses(id) ON DELETE CASCADE,
  viewer_phone text,
  viewer_name text,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_phone)
);

CREATE INDEX idx_whatsapp_status_views_status ON public.whatsapp_status_views(status_id);

GRANT SELECT, INSERT ON public.whatsapp_status_views TO authenticated;
GRANT ALL ON public.whatsapp_status_views TO service_role;

ALTER TABLE public.whatsapp_status_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view status viewers"
  ON public.whatsapp_status_views FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can insert status views"
  ON public.whatsapp_status_views FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

-- Atomic recount trigger — same pattern as whatsapp_links.click_count
CREATE OR REPLACE FUNCTION public.whatsapp_status_recount_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_statuses
     SET view_count = (
       SELECT count(*) FROM public.whatsapp_status_views WHERE status_id = NEW.status_id
     )
   WHERE id = NEW.status_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_whatsapp_status_recount_views
  AFTER INSERT ON public.whatsapp_status_views
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_status_recount_views();

-- ============================================================
-- DAILY CLEANUP (pg_cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.whatsapp_status_cleanup_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.whatsapp_statuses WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-status-cleanup') THEN
      PERFORM cron.schedule(
        'whatsapp-status-cleanup',
        '0 3 * * *',
        $cron$ SELECT public.whatsapp_status_cleanup_expired(); $cron$
      );
    END IF;
  END IF;
END $$;
