
-- 1) vehicles: remove broad finance SELECT policy that exposed sensitive columns.
--    Provide finance with a safe view containing only non-sensitive columns.
DROP POLICY IF EXISTS "Finance can view vehicles" ON public.vehicles;

CREATE OR REPLACE VIEW public.vehicles_finance_safe
WITH (security_invoker = false) AS
SELECT
  id, name, brand, model, year, category, status, color,
  daily_price_usd, image_url, photos, published, deleted_at,
  acquired_date, default_deposit_amount, default_franchise_amount,
  passengers, bags, transmission
FROM public.vehicles;

GRANT SELECT ON public.vehicles_finance_safe TO authenticated;

-- 2) activity_logs: allow authenticated users to read back their own logs
--    (consistent with INSERT-own policy; admin policy already allows full read).
DROP POLICY IF EXISTS "Users can read own activity logs" ON public.activity_logs;
CREATE POLICY "Users can read own activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
