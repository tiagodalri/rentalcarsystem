
-- Create email_logs table
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on idempotency_key to prevent duplicates
CREATE UNIQUE INDEX idx_email_logs_idempotency ON public.email_logs (idempotency_key);

-- Index for querying by status
CREATE INDEX idx_email_logs_status ON public.email_logs (status);

-- Index for querying by template
CREATE INDEX idx_email_logs_template ON public.email_logs (template_name);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admin and finance can view logs (read-only)
CREATE POLICY "Admin and finance can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role]));

-- Trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add preferred_language to customers
ALTER TABLE public.customers
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'pt';
