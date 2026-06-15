
ALTER TABLE public.vehicle_telemetry REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vehicle_telemetry') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_telemetry';
  END IF;
END $$;

-- Acelera o polling do Bouncie de 3min para 1min (mínimo do pg_cron)
SELECT cron.unschedule(2);
SELECT cron.schedule(
  'bouncie-sync-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://synnmssbvwbmlcxfgbwu.functions.supabase.co/bouncie-sync',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bm5tc3NidndibWxjeGZnYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTM3NDksImV4cCI6MjA5MDU4OTc0OX0.VgaOORcuS_cm0d4A7tmBqfNYCDJj60stdWo6t5Oe96Y"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $cron$
);
