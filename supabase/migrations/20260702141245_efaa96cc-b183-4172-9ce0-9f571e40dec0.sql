
WITH mapping AS (
  SELECT
    id,
    'https://cdn.imagin.studio/getimage?customer=img&make=' || lower(brand)
      || '&modelFamily=' || replace(lower(model), ' ', '')
      || '&paintDescription=' || CASE color
          WHEN 'Preto' THEN 'black'
          WHEN 'Branco' THEN 'white'
          WHEN 'Cinza' THEN 'gray'
          WHEN 'Grafite' THEN 'grey'
          WHEN 'Prata' THEN 'silver'
          WHEN 'Vermelho' THEN 'red'
          WHEN 'Azul' THEN 'blue'
          WHEN 'Bege' THEN 'beige'
          ELSE 'white' END AS base_url
  FROM public.vehicles
)
UPDATE public.vehicles v
SET
  image_url = m.base_url || '&angle=23',
  photos = jsonb_build_array(
    m.base_url || '&angle=23',
    m.base_url || '&angle=05',
    m.base_url || '&angle=17',
    m.base_url || '&angle=09',
    m.base_url || '&angle=29'
  ),
  updated_at = now()
FROM mapping m
WHERE v.id = m.id;
