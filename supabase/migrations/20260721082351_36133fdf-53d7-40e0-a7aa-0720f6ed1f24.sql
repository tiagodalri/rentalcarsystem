
ALTER TABLE public.whatsapp_links
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_whatsapp_links_updated_at ON public.whatsapp_links;
CREATE TRIGGER update_whatsapp_links_updated_at
  BEFORE UPDATE ON public.whatsapp_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read of ACTIVE links (needed for anonymous /l/:slug redirect)
DROP POLICY IF EXISTS "Public can view active links" ON public.whatsapp_links;
CREATE POLICY "Public can view active links" ON public.whatsapp_links
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.whatsapp_links TO anon;

-- Clicks table
CREATE TABLE IF NOT EXISTS public.whatsapp_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.whatsapp_links(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text
);

CREATE INDEX IF NOT EXISTS whatsapp_link_clicks_link_id_idx
  ON public.whatsapp_link_clicks(link_id, clicked_at DESC);

GRANT INSERT ON public.whatsapp_link_clicks TO anon, authenticated;
GRANT SELECT ON public.whatsapp_link_clicks TO authenticated;
GRANT ALL ON public.whatsapp_link_clicks TO service_role;

ALTER TABLE public.whatsapp_link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register a click" ON public.whatsapp_link_clicks;
CREATE POLICY "Anyone can register a click" ON public.whatsapp_link_clicks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view link clicks" ON public.whatsapp_link_clicks;
CREATE POLICY "Staff can view link clicks" ON public.whatsapp_link_clicks
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

-- Atomic click counter
CREATE OR REPLACE FUNCTION public.bump_whatsapp_link_click_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.whatsapp_links
     SET click_count = COALESCE(click_count, 0) + 1
   WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_whatsapp_link_click_count_trg ON public.whatsapp_link_clicks;
CREATE TRIGGER bump_whatsapp_link_click_count_trg
  AFTER INSERT ON public.whatsapp_link_clicks
  FOR EACH ROW EXECUTE FUNCTION public.bump_whatsapp_link_click_count();
