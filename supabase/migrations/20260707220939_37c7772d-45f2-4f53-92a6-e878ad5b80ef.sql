
BEGIN;
-- reduz idle mais 50%
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 0.45, 2)
 WHERE notes LIKE '[demo-seed-v4]%'
   AND vehicle_id IN (
     SELECT v.id FROM public.vehicles v
     WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id=v.id AND b.deleted_at IS NULL AND b.total_price>0)
   );
-- reduz meio (rev>0 mas nao carroco): quem tem exp/rev entre 0.55 e 0.80 => ratio ~meio
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 0.82, 2)
 WHERE notes LIKE '[demo-seed-v4]%'
   AND vehicle_id IN (
     SELECT id FROM (
       SELECT v.id,
              COALESCE((SELECT SUM(total_price) FROM public.bookings b WHERE b.vehicle_id=v.id AND b.deleted_at IS NULL),0) rev,
              COALESCE((SELECT SUM(amount) FROM public.vehicle_expenses ee WHERE ee.vehicle_id=v.id),0) exp
         FROM public.vehicles v
     ) t
      WHERE rev > 0 AND exp/NULLIF(rev,0) BETWEEN 0.55 AND 0.85
   );
COMMIT;
