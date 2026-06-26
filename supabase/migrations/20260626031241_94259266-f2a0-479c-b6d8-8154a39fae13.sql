
-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON public.bookings(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_date ON public.bookings(pickup_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_return_date ON public.bookings(return_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_date_range ON public.bookings(vehicle_id, pickup_date, return_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- financial_transactions
CREATE INDEX IF NOT EXISTS idx_fin_tx_transaction_date ON public.financial_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_booking_id ON public.financial_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_vehicle_id ON public.financial_transactions(vehicle_id);

-- vehicle_inspections
CREATE INDEX IF NOT EXISTS idx_inspections_booking_id ON public.vehicle_inspections(booking_id);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id) WHERE deleted_at IS NULL;

-- vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status) WHERE deleted_at IS NULL;

-- user_roles (acelera has_role)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);
