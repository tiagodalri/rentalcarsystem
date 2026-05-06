-- Add welcome_sent flag
ALTER TABLE public.customers ADD COLUMN welcome_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark all existing customers as already welcomed (no retroactive emails)
UPDATE public.customers SET welcome_sent = TRUE WHERE created_at < NOW();
