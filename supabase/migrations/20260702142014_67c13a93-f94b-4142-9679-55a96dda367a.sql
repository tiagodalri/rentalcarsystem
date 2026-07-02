
-- Seed exterior_photos for demo inspections using each vehicle's own CDN renders.
-- Only touches inspections whose exterior_photos are currently empty.
DO $$
DECLARE
  v_positions text[] := ARRAY[
    'Frente','Lateral Esquerda','Roda Dianteira Esquerda','Roda Traseira Esquerda',
    'Lateral Direita','Roda Dianteira Direita','Roda Traseira Direita',
    'Traseira','Porta-Malas','Banco Dianteiro','Banco Traseiro','Chaves + Ticket'
  ];
  -- Which index of vehicles.photos to use per position (photos array = [frente3/4, lateral, tras3/4, traseira, interior]).
  v_angle_idx int[] := ARRAY[0,1,1,1,1,1,1,3,2,4,4,4];
BEGIN
  UPDATE vehicle_inspections vi
  SET exterior_photos = sub.photos_json,
      updated_at = now()
  FROM (
    SELECT
      vi2.id AS insp_id,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'position', v_positions[i],
            'url', v.photos ->> v_angle_idx[i],
            'timestamp', extract(epoch from vi2.completed_at)::bigint * 1000
          )
          ORDER BY i
        )
        FROM generate_subscripts(v_positions, 1) AS i
        WHERE v.photos IS NOT NULL
          AND jsonb_array_length(v.photos) > v_angle_idx[i]
          AND (v.photos ->> v_angle_idx[i]) IS NOT NULL
      ) AS photos_json
    FROM vehicle_inspections vi2
    JOIN bookings b ON b.id = vi2.booking_id
    JOIN vehicles v ON v.id = b.vehicle_id
    WHERE (vi2.exterior_photos IS NULL OR jsonb_array_length(COALESCE(vi2.exterior_photos,'[]'::jsonb)) = 0)
      AND b.status IN ('completed','active')
      AND v.photos IS NOT NULL
      AND jsonb_array_length(v.photos) >= 5
  ) sub
  WHERE vi.id = sub.insp_id
    AND sub.photos_json IS NOT NULL;
END $$;
