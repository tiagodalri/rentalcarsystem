
BEGIN;
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 1.18, 2)
 WHERE notes LIKE '[demo-seed-v5]%'
   AND vehicle_id IN (
     SELECT id FROM (
       SELECT v.id,
              COALESCE((SELECT SUM(total_price) FROM public.bookings b
                        WHERE b.vehicle_id=v.id AND b.status<>'cancelled'),0) rev,
              COALESCE((SELECT SUM(amount) FROM public.vehicle_expenses ee
                        WHERE ee.vehicle_id=v.id),0) exp
         FROM public.vehicles v
     ) t
     WHERE rev > 0
       AND exp <= rev
       AND (rev - exp) / rev BETWEEN 0 AND 0.15  -- margem 0..15%
     ORDER BY (rev - exp) / rev ASC
     LIMIT 10
   );
COMMIT;
