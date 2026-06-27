UPDATE vehicle_inspections
SET damages = jsonb_set(damages, '{0,position}', '"Parachoque dianteiro esquerdo"'::jsonb)
WHERE id = 'a1388bfc-e319-4cd5-b637-e18412525458';