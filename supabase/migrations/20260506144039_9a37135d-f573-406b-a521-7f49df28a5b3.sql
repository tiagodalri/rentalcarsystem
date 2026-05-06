ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS driver_license_expiry DATE;

COMMENT ON COLUMN public.customers.driver_license_expiry IS 'Data de vencimento da CNH do cliente';