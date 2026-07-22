
-- Tiers table
CREATE TABLE public.partner_bonus_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  threshold_bookings INTEGER NOT NULL CHECK (threshold_bookings > 0),
  bonus_amount NUMERIC(12,2) NOT NULL CHECK (bonus_amount >= 0),
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_bonus_tiers TO authenticated;
GRANT ALL ON public.partner_bonus_tiers TO service_role;

ALTER TABLE public.partner_bonus_tiers ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see active tiers (partners need this for progress UI)
CREATE POLICY "Authenticated can view active tiers"
  ON public.partner_bonus_tiers FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_platform_admin(auth.uid()));

-- Only platform_admin manages tiers
CREATE POLICY "Platform admin manages tiers"
  ON public.partner_bonus_tiers FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_partner_bonus_tiers_updated_at
  BEFORE UPDATE ON public.partner_bonus_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Awards table
CREATE TABLE public.partner_bonus_awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.partner_bonus_tiers(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, tier_id)
);

CREATE INDEX partner_bonus_awards_partner_idx ON public.partner_bonus_awards(partner_id);

GRANT SELECT ON public.partner_bonus_awards TO authenticated;
GRANT ALL ON public.partner_bonus_awards TO service_role;

ALTER TABLE public.partner_bonus_awards ENABLE ROW LEVEL SECURITY;

-- Partners view their own awards
CREATE POLICY "Partner views own awards"
  ON public.partner_bonus_awards FOR SELECT
  TO authenticated
  USING (partner_id = public.get_user_partner_id(auth.uid()));

-- Platform admin views all awards
CREATE POLICY "Platform admin views all awards"
  ON public.partner_bonus_awards FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Platform admin can update payout status (edge function uses service role, but keep for parity)
CREATE POLICY "Platform admin updates awards"
  ON public.partner_bonus_awards FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Seed initial ladder
INSERT INTO public.partner_bonus_tiers (threshold_bookings, bonus_amount, label, sort_order) VALUES
  (5,   50.00,   'Largada',              10),
  (10,  100.00,  'Primeira Meta',        20),
  (25,  300.00,  'Parceiro Consistente', 30),
  (50,  750.00,  'Parceiro Ouro',        40),
  (100, 2000.00, 'Parceiro Elite',       50);

-- Sync function: awards any newly-crossed tiers for the affected partner
CREATE OR REPLACE FUNCTION public.sync_partner_bonus_awards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
  v_confirmed_count INTEGER;
BEGIN
  -- Only relevant for bookings tied to a partner
  v_partner_id := COALESCE(NEW.partner_id, OLD.partner_id);
  IF v_partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Trigger only when status is (or becomes) one of the confirmed statuses
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.partner_id IS NOT DISTINCT FROM NEW.partner_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('confirmed','active','in_progress','completed') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.bookings
  WHERE partner_id = v_partner_id
    AND deleted_at IS NULL
    AND status IN ('confirmed','active','in_progress','completed');

  IF v_confirmed_count = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.partner_bonus_awards (partner_id, tier_id)
  SELECT v_partner_id, t.id
    FROM public.partner_bonus_tiers t
   WHERE t.is_active = true
     AND t.threshold_bookings <= v_confirmed_count
  ON CONFLICT (partner_id, tier_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_partner_bonus_awards
  AFTER INSERT OR UPDATE OF status, partner_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_bonus_awards();
