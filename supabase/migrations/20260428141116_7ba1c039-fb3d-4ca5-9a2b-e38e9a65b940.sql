-- =====================================================================
-- Migration corretiva: aplica UPDATEs que falharam na migration anterior
-- =====================================================================

BEGIN;

UPDATE public.vehicles SET
  purchase_price = 62400,
  initial_odometer = 85900,
  current_odometer = 85900,
  acquired_date = '2026-01-28',
  year = 2021,
  color = 'Preto',
  notes = 'Locação 31/01 $300/dia; 19/04-01/05 $2.535'
WHERE name = 'Cadillac Escalade' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 42940,
  initial_odometer = 52799,
  current_odometer = 52799,
  acquired_date = '2026-02-17',
  color = 'Preto',
  notes = 'Inclui $740 de pneus na compra'
WHERE name = 'BMW X5 M Sport' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 28665,
  initial_odometer = 27865,
  current_odometer = 27865,
  acquired_date = '2026-02-18',
  color = 'Preto',
  notes = 'Inclui $800 de pneus na compra'
WHERE name = 'Chevrolet Suburban' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 27865,
  initial_odometer = 46956,
  current_odometer = 46956,
  acquired_date = '2025-02-18',
  color = 'Cinza'
WHERE name = 'Kia Sorento' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 21000,
  initial_odometer = 53000,
  current_odometer = 53000,
  acquired_date = '2026-02-18',
  color = 'Preto'
WHERE name = 'Mitsubishi Outlander' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 10710,
  initial_odometer = 95500,
  current_odometer = 95500,
  acquired_date = '2026-03-19',
  color = 'Preto'
WHERE name = 'Volvo XC60' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 12320,
  initial_odometer = 74000,
  current_odometer = 74000,
  acquired_date = '2026-03-19',
  color = 'Preto'
WHERE name = 'Mercedes-Benz GLA' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 13810,
  initial_odometer = 99000,
  current_odometer = 99000,
  acquired_date = '2026-03-19',
  color = 'Branco'
WHERE name = 'Audi Q7' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 13185,
  initial_odometer = 102000,
  current_odometer = 102000,
  acquired_date = '2026-03-24',
  color = 'Branco'
WHERE name = 'Volkswagen Atlas' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 9530,
  initial_odometer = 101000,
  current_odometer = 101000,
  acquired_date = '2026-03-24',
  color = 'Preto'
WHERE name = 'Nissan Kicks' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 17550,
  initial_odometer = 103000,
  current_odometer = 103000,
  acquired_date = '2026-03-24',
  color = 'Preto',
  notes = 'Modelo NX200'
WHERE name = 'Lexus NX' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 27352,
  initial_odometer = 78010,
  current_odometer = 78010,
  acquired_date = '2026-02-10',
  notes = 'Locado 18-19/04 $120'
WHERE name = 'Dodge Durango' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 32000,
  initial_odometer = 21000,
  current_odometer = 21000,
  acquired_date = '2026-03-20',
  color = 'Azul',
  notes = 'Confirmar se é o conversível ou fastback'
WHERE name = 'Mustang Conversível' AND acquired_date = '2026-04-09' AND purchase_price = 0;

UPDATE public.vehicles SET
  purchase_price = 14000,
  initial_odometer = 99000,
  current_odometer = 99000,
  acquired_date = '2026-02-04',
  color = 'Azul',
  notes = 'Locado Turo 9-16/02 $378; troca de óleo 16/03 $100; sensor MAF 19/03 $245'
WHERE name = 'Volkswagen Tiguan'
  AND acquired_date = '2026-04-09'
  AND purchase_price = 0
  AND color IS NULL;

UPDATE public.vehicles SET
  purchase_price = 20250,
  initial_odometer = 85900,
  current_odometer = 85900,
  acquired_date = '2026-02-09',
  color = 'Cinza'
WHERE name = 'Kia Sportage'
  AND acquired_date = '2026-04-09'
  AND purchase_price = 0
  AND color IS NULL;

UPDATE public.vehicles SET
  purchase_price = 20500,
  initial_odometer = 84650,
  current_odometer = 84650,
  acquired_date = '2026-01-29',
  color = 'Cinza',
  year = 2023
WHERE name = 'Chrysler Pacifica'
  AND acquired_date = '2026-04-09'
  AND purchase_price = 0
  AND color IS NULL;

UPDATE public.vehicles SET
  status = 'unavailable',
  notes = COALESCE(notes, '') || ' [Duplicata em CAIXA ALTA — verificar se deve ser apagada]'
WHERE name IN ('VOLKSWAGEN TIGUAN', 'MUSTANG CONVERSÍVEL')
  AND status != 'unavailable';

COMMIT;