-- Populate synthetic GPS polylines for demo trips that currently have empty gps arrays.
-- Format: GeoJSON-like array [[lng, lat], ...] which the client decoder accepts.

DO $$
DECLARE
  t RECORD;
  n_points INT;
  i INT;
  lat DOUBLE PRECISION;
  lng DOUBLE PRECISION;
  heading DOUBLE PRECISION;
  arr JSONB;
  anchors DOUBLE PRECISION[][] := ARRAY[
    ARRAY[28.5383, -81.3792],  -- Orlando
    ARRAY[28.2919, -81.4076],  -- Kissimmee
    ARRAY[28.3172, -81.5348],  -- Celebration
    ARRAY[28.1611, -81.6018],  -- Davenport
    ARRAY[28.5652, -81.5865],  -- Winter Garden
    ARRAY[28.3701, -81.5192]   -- Lake Buena Vista
  ];
  a INT;
  step_lat DOUBLE PRECISION;
  step_lng DOUBLE PRECISION;
BEGIN
  FOR t IN
    SELECT id, started_at, ended_at
    FROM vehicle_trips
    WHERE gps IS NULL
       OR jsonb_typeof(gps) <> 'array'
       OR jsonb_array_length(gps) < 2
  LOOP
    -- 30 to 80 points per trip
    n_points := 30 + (floor(random() * 50))::int;
    a := 1 + (floor(random() * array_length(anchors, 1)))::int;
    lat := anchors[a][1] + (random() - 0.5) * 0.03;
    lng := anchors[a][2] + (random() - 0.5) * 0.03;
    heading := random() * 360;
    -- base step ~ 0.0008 deg per point (~90m)
    arr := jsonb_build_array();
    FOR i IN 1..n_points LOOP
      arr := arr || jsonb_build_array(to_jsonb(round(lng::numeric, 6)), to_jsonb(round(lat::numeric, 6)));
      -- occasionally turn
      IF random() < 0.15 THEN
        heading := heading + (random() - 0.5) * 90;
      ELSE
        heading := heading + (random() - 0.5) * 20;
      END IF;
      step_lat := 0.0008 * cos(radians(heading));
      step_lng := 0.0008 * sin(radians(heading));
      lat := lat + step_lat;
      lng := lng + step_lng;
    END LOOP;

    UPDATE vehicle_trips
    SET gps = arr
    WHERE id = t.id;
  END LOOP;
END $$;