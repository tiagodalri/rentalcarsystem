
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_date ON public.bookings (pickup_date);
CREATE INDEX IF NOT EXISTS idx_bookings_return_date ON public.bookings (return_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_pickup ON public.bookings (vehicle_id, pickup_date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_date ON public.vehicle_expenses (vehicle_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.vehicle_expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_ftx_date ON public.financial_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_ftx_booking ON public.financial_transactions (booking_id);
CREATE INDEX IF NOT EXISTS idx_ftx_vehicle ON public.financial_transactions (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_booking ON public.vehicle_inspections (booking_id);
CREATE INDEX IF NOT EXISTS idx_tolls_booking ON public.epass_tolls (booking_id);
CREATE INDEX IF NOT EXISTS idx_tolls_vehicle_date ON public.epass_tolls (vehicle_id, toll_datetime);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
