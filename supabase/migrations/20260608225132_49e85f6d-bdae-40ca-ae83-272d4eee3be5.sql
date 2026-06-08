DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bouncie-backfill-trips-catchup') THEN
    PERFORM cron.schedule(
      'bouncie-backfill-trips-catchup',
      '*/10 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://synnmssbvwbmlcxfgbwu.supabase.co/functions/v1/bouncie-backfill-trips',
        headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bm5tc3NidndibWxjeGZnYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTM3NDksImV4cCI6MjA5MDU4OTc0OX0.VgaOORcuS_cm0d4A7tmBqfNYCDJj60stdWo6t5Oe96Y"}'::jsonb,
        body := '{"days":1}'::jsonb
      );
      $job$
    );
  END IF;
END $$;