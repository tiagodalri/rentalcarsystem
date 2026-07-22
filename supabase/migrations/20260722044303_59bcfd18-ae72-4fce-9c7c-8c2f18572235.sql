CREATE OR REPLACE VIEW public.vehicles_public AS
SELECT id, name, category, daily_price_usd, image_url, passengers, bags, transmission, fuel, year,
       status, features, created_at, updated_at, color, engine_type, engine_size, doors, published,
       photos, brand, model, manufacture_year, model_year, deleted_at, default_deposit_amount, default_franchise_amount
FROM public.vehicles
WHERE published = true AND deleted_at IS NULL
  AND locadora_id = 'd0da1220-0000-4000-8000-00000000d01a';