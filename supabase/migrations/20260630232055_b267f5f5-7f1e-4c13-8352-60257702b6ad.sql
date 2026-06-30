
-- E-Pass imports
CREATE TABLE public.epass_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  period_label text,
  account_number text,
  total_rows integer NOT NULL DEFAULT 0,
  matched_rows integer NOT NULL DEFAULT 0,
  unmatched_vehicle_rows integer NOT NULL DEFAULT 0,
  unmatched_booking_rows integer NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epass_imports TO authenticated;
GRANT ALL ON public.epass_imports TO service_role;
ALTER TABLE public.epass_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage epass imports" ON public.epass_imports
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));

CREATE TYPE public.epass_toll_status AS ENUM ('matched','no_vehicle','no_booking','ignored');

-- E-Pass tolls
CREATE TABLE public.epass_tolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.epass_imports(id) ON DELETE CASCADE,
  transponder_number text NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  toll_datetime timestamptz NOT NULL,
  posting_date date,
  location text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  toll_type text,
  status public.epass_toll_status NOT NULL DEFAULT 'no_vehicle',
  charged_to_customer boolean NOT NULL DEFAULT false,
  charged_at timestamptz,
  dedupe_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_epass_tolls_transponder ON public.epass_tolls(transponder_number);
CREATE INDEX idx_epass_tolls_vehicle ON public.epass_tolls(vehicle_id);
CREATE INDEX idx_epass_tolls_booking ON public.epass_tolls(booking_id);
CREATE INDEX idx_epass_tolls_datetime ON public.epass_tolls(toll_datetime);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epass_tolls TO authenticated;
GRANT ALL ON public.epass_tolls TO service_role;
ALTER TABLE public.epass_tolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage epass tolls" ON public.epass_tolls
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));

-- Account activity
CREATE TABLE public.epass_account_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.epass_imports(id) ON DELETE CASCADE,
  account_number text,
  activity_date date,
  description text,
  location text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epass_account_activity TO authenticated;
GRANT ALL ON public.epass_account_activity TO service_role;
ALTER TABLE public.epass_account_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage epass account activity" ON public.epass_account_activity
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));
