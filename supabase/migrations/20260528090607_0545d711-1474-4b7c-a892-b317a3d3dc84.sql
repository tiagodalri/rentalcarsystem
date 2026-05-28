-- 1) Bookings: scope customer self-service policies to authenticated role only
DROP POLICY IF EXISTS "Customers can create own bookings" ON public.bookings;
CREATE POLICY "Customers can create own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
CREATE POLICY "Customers can view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- 2) Customers: add WITH CHECK to prevent ownership reassignment
DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
CREATE POLICY "Users can update own customer record"
ON public.customers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own customer record" ON public.customers;
CREATE POLICY "Users can view own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Vehicles: restrict anonymous SELECT to safe public columns only
REVOKE SELECT ON public.vehicles FROM anon;
GRANT SELECT (
  id, name, category, daily_price_usd, image_url, passengers, bags,
  transmission, fuel, year, status, features, color, doors,
  engine_type, engine_size, brand, model, version,
  manufacture_year, model_year, photos, published,
  created_at, updated_at
) ON public.vehicles TO anon;
