
-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net for HTTP calls from SQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
