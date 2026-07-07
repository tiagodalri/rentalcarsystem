
BEGIN;
-- Ajusta despesas idle: reduz para 1.2% ao ano do valor de compra (piso realista, sem seguro cheio)
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 0.28, 2)
 WHERE notes LIKE '[demo-seed-v4]%'
   AND vehicle_id IN (
     SELECT v.id FROM public.vehicles v
     WHERE NOT EXISTS (
       SELECT 1 FROM public.bookings b
        WHERE b.vehicle_id = v.id AND b.deleted_at IS NULL AND b.total_price > 0
     )
   );
COMMIT;
