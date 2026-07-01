
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_data JSONB,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle ON public.vehicle_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_booking ON public.vehicle_expenses(booking_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_date ON public.vehicle_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_status ON public.vehicle_expenses(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO authenticated;
GRANT ALL ON public.vehicle_expenses TO service_role;

DROP POLICY IF EXISTS "Admins can manage vehicle expenses" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "Admin and finance can manage expenses" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "Staff can manage expenses" ON public.vehicle_expenses;

CREATE POLICY "Staff can manage expenses"
ON public.vehicle_expenses
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));
