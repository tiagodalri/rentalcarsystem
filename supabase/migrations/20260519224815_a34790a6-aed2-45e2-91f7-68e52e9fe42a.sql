
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS default_deposit_amount numeric NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS default_franchise_amount numeric NOT NULL DEFAULT 1250;

-- Premium tier: $500 deposit
UPDATE public.vehicles
SET default_deposit_amount = 500
WHERE name ILIKE '%X5%'
   OR name ILIKE '%Mustang%'
   OR name ILIKE '%Macan%'
   OR name ILIKE '%330%'
   OR name ILIKE '%Escalade%';

-- All others: $300 (explicit, idempotent)
UPDATE public.vehicles
SET default_deposit_amount = 300
WHERE NOT (
  name ILIKE '%X5%'
  OR name ILIKE '%Mustang%'
  OR name ILIKE '%Macan%'
  OR name ILIKE '%330%'
  OR name ILIKE '%Escalade%'
);

-- Franchise standard for whole fleet
UPDATE public.vehicles SET default_franchise_amount = 1250;
