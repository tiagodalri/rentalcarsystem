-- =====================================================================
-- Migration: Seed da frota Zeus com dados de compra dos prints (WhatsApp)
-- Data: 2026-04-28
-- =====================================================================

BEGIN;

-- PARTE 1 — UPDATEs dos carros com unidade única

UPDATE public.vehicles SET
  purchase_price = 62400,
  initial_odometer = 85900,
  current_odometer = 85900,
  acquired_date = '2026-01-28',
  year = COALESCE(year, 2021),
  color = COALESCE(color, 'Preto'),
  notes = 'Locação 31/01 $300/dia; 19/04-01/05 $2.535'
WHERE name = 'Cadillac Escalade' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 42940,
  initial_odometer = 52799,
  current_odometer = 52799,
  acquired_date = '2026-02-17',
  color = COALESCE(color, 'Preto'),
  notes = 'Inclui $740 de pneus na compra'
WHERE name = 'BMW X5 M Sport' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 28665,
  initial_odometer = 27865,
  current_odometer = 27865,
  acquired_date = '2026-02-18',
  color = COALESCE(color, 'Preto'),
  notes = 'Inclui $800 de pneus na compra'
WHERE name = 'Chevrolet Suburban' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 27865,
  initial_odometer = 46956,
  current_odometer = 46956,
  acquired_date = '2025-02-18',
  color = COALESCE(color, 'Cinza')
WHERE name = 'Kia Sorento' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 21000,
  initial_odometer = 53000,
  current_odometer = 53000,
  acquired_date = '2026-02-18',
  color = COALESCE(color, 'Preto')
WHERE name = 'Mitsubishi Outlander' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 10710,
  initial_odometer = 95500,
  current_odometer = 95500,
  acquired_date = '2026-03-19',
  color = COALESCE(color, 'Preto')
WHERE name = 'Volvo XC60' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 12320,
  initial_odometer = 74000,
  current_odometer = 74000,
  acquired_date = '2026-03-19',
  color = COALESCE(color, 'Preto')
WHERE name = 'Mercedes-Benz GLA' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 13810,
  initial_odometer = 99000,
  current_odometer = 99000,
  acquired_date = '2026-03-19',
  color = COALESCE(color, 'Branco')
WHERE name = 'Audi Q7' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 13185,
  initial_odometer = 102000,
  current_odometer = 102000,
  acquired_date = '2026-03-24',
  color = COALESCE(color, 'Branco')
WHERE name = 'Volkswagen Atlas' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 9530,
  initial_odometer = 101000,
  current_odometer = 101000,
  acquired_date = '2026-03-24',
  color = COALESCE(color, 'Preto')
WHERE name = 'Nissan Kicks' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 17550,
  initial_odometer = 103000,
  current_odometer = 103000,
  acquired_date = '2026-03-24',
  color = COALESCE(color, 'Preto'),
  notes = 'Modelo NX200'
WHERE name = 'Lexus NX' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 27352,
  initial_odometer = 78010,
  current_odometer = 78010,
  acquired_date = '2026-02-10',
  notes = 'Locado 18-19/04 $120'
WHERE name = 'Dodge Durango' AND purchase_price IS NULL;

UPDATE public.vehicles SET
  purchase_price = 32000,
  initial_odometer = 21000,
  current_odometer = 21000,
  acquired_date = '2026-03-20',
  color = COALESCE(color, 'Azul'),
  notes = 'Confirmar se é o conversível ou fastback'
WHERE name = 'Mustang Conversível' AND purchase_price IS NULL;

-- PARTE 2 — UPDATE da 1ª unidade + INSERT das adicionais

UPDATE public.vehicles SET
  purchase_price = 14000,
  initial_odometer = 99000,
  current_odometer = 99000,
  acquired_date = '2026-02-04',
  color = COALESCE(color, 'Azul'),
  notes = 'Locado Turo 9-16/02 $378; troca de óleo 16/03 $100; sensor MAF 19/03 $245'
WHERE id = (
  SELECT id FROM public.vehicles
  WHERE name = 'Volkswagen Tiguan' AND purchase_price IS NULL
  ORDER BY created_at LIMIT 1
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features
) VALUES (
  'Volkswagen Tiguan', 'SUV', 0, 'available', 'Branco', NULL,
  5, 3, 'Automatic', 'Gasoline',
  11460, 97000, 97000, '2026-03-24',
  ARRAY['SE / SEL']
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features
) VALUES (
  'Volkswagen Tiguan RLine', 'SUV', 0, 'available', 'Branco', NULL,
  5, 3, 'Automatic', 'Gasoline',
  14000, 99000, 99000, '2026-04-18',
  ARRAY['RLine']
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features
) VALUES (
  'Volkswagen Tiguan RLine', 'SUV', 0, 'available', 'Cinza', NULL,
  5, 3, 'Automatic', 'Gasoline',
  13500, 108000, 108000, '2026-04-20',
  ARRAY['RLine']
);

UPDATE public.vehicles SET
  purchase_price = 20250,
  initial_odometer = 85900,
  current_odometer = 85900,
  acquired_date = '2026-02-09',
  color = COALESCE(color, 'Cinza')
WHERE id = (
  SELECT id FROM public.vehicles
  WHERE name = 'Kia Sportage' AND purchase_price IS NULL
  ORDER BY created_at LIMIT 1
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features
) VALUES (
  'Kia Sportage', 'SUV Compacto', 0, 'available', 'Preto', NULL,
  5, 3, 'Automatic', 'Gasoline',
  9090, 105000, 105000, '2026-03-19',
  ARRAY['LX / EX']
);

UPDATE public.vehicles SET
  purchase_price = 20500,
  initial_odometer = 84650,
  current_odometer = 84650,
  acquired_date = '2026-01-29',
  color = COALESCE(color, 'Cinza'),
  year = COALESCE(year, 2023)
WHERE id = (
  SELECT id FROM public.vehicles
  WHERE name = 'Chrysler Pacifica' AND purchase_price IS NULL
  ORDER BY created_at LIMIT 1
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features
) VALUES (
  'Chrysler Pacifica', 'Minivan', 0, 'available', 'Branco', 2017,
  7, 4, 'Automatic', 'Gasoline',
  9600, 90000, 90000, '2026-04-22',
  ARRAY['Touring']
);

-- PARTE 3 — INSERTs dos 5 carros novos (status maintenance / Em preparação)

INSERT INTO public.vehicles (
  name, category, daily_price_usd, image_url, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features, notes
) VALUES (
  'Jeep Renegade', 'SUV Compacto', 0, NULL, 'maintenance', 'Bege', NULL,
  5, 3, 'Automatic', 'Gasoline',
  3230, 90000, 90000, '2026-03-19',
  ARRAY['Pendente de fotos'],
  'Veículo em preparação — pendente de fotos e definição de preço diário'
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, image_url, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features, notes
) VALUES (
  'Porsche Macan', 'SUV Premium', 0, NULL, 'maintenance', 'Champagne', NULL,
  5, 3, 'Automatic', 'Gasoline',
  27000, 70000, 70000, '2026-04-10',
  ARRAY['Pendente de fotos'],
  'Veículo em preparação — pendente de fotos e definição de preço diário'
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, image_url, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features, notes
) VALUES (
  'BMW 330', 'Sedan', 0, NULL, 'maintenance', 'Preto', NULL,
  5, 3, 'Automatic', 'Gasoline',
  23500, 35000, 35000, '2026-04-20',
  ARRAY['Pendente de fotos'],
  'Veículo em preparação — pendente de fotos e definição de preço diário'
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, image_url, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features, notes
) VALUES (
  'Nissan Rogue', 'SUV', 0, NULL, 'maintenance', 'Preto', 2020,
  5, 3, 'Automatic', 'Gasoline',
  9000, 107000, 107000, '2026-04-22',
  ARRAY['Pendente de fotos'],
  'Veículo em preparação — pendente de fotos e definição de preço diário'
);

INSERT INTO public.vehicles (
  name, category, daily_price_usd, image_url, status, color, year,
  passengers, bags, transmission, fuel,
  purchase_price, initial_odometer, current_odometer, acquired_date,
  features, notes
) VALUES (
  'Volkswagen Passat', 'Sedan', 0, NULL, 'maintenance', 'Cinza', NULL,
  5, 3, 'Automatic', 'Gasoline',
  8500, 96000, 96000, '2026-04-27',
  ARRAY['Pendente de fotos'],
  'Veículo em preparação — pendente de fotos e definição de preço diário'
);

COMMIT;