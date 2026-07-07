
BEGIN;
-- Reduz uniformemente 12% em despesas de veiculos com margem atualmente saudavel ou meio
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 0.88, 2)
 WHERE notes LIKE '[demo-seed-v5]%'
   AND vehicle_id IN (
     SELECT v.id FROM public.vehicles v
     WHERE COALESCE((SELECT SUM(total_price) FROM public.bookings b
                     WHERE b.vehicle_id=v.id AND b.status<>'cancelled'),0) > 0
   );

-- Reduz mais 15% em quem esta muito negativo (exp > rev*1.05) para trazer para ~-5%..0%
-- (queremos manter alguns negativos, mas nao 26)
UPDATE public.vehicle_expenses e
   SET amount = ROUND(amount * 0.85, 2)
 WHERE notes LIKE '[demo-seed-v5]%'
   AND vehicle_id IN (
     SELECT v.id FROM public.vehicles v
     JOIN LATERAL (
       SELECT COALESCE(SUM(total_price),0) rev FROM public.bookings b
        WHERE b.vehicle_id=v.id AND b.status<>'cancelled'
     ) br ON TRUE
     JOIN LATERAL (
       SELECT COALESCE(SUM(amount),0) exp FROM public.vehicle_expenses ee
        WHERE ee.vehicle_id=v.id
     ) ex ON TRUE
     WHERE br.rev > 0 AND ex.exp > br.rev * 1.05
     ORDER BY (ex.exp - br.rev) DESC
     OFFSET 12   -- mantém os 12 mais negativos como caroços "puros"
   );
COMMIT;
