
-- ============================================================
-- 1) payment_requests: scope SELECT to the owning customer + staff
-- ============================================================
CREATE POLICY "Customers can view their own payment requests"
  ON public.payment_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.customers c ON c.id = b.customer_id
      WHERE b.id = payment_requests.booking_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view payment requests"
  ON public.payment_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(
      auth.uid(),
      ARRAY['operations','finance','support']::app_role[]
    )
  );

-- ============================================================
-- 2) vehicles: explicit REVOKE on sensitive columns for anon
--    (defense in depth — anon already lacks table-level SELECT
--     and these columns are not in the column-level allowlist,
--     but we make the intent explicit and durable.)
-- ============================================================
REVOKE SELECT (
  vin,
  license_plate,
  renavam,
  purchase_price,
  insurance_policy,
  registration_expiry,
  current_odometer,
  bouncie_imei
) ON public.vehicles FROM anon;
