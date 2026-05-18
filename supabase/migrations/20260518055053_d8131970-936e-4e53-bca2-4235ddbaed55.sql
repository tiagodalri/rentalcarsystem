
-- 1. Create job_titles table
CREATE TABLE public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view job titles" ON public.job_titles
  FOR SELECT USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'operations'::app_role, 'support'::app_role]));

CREATE POLICY "Admins can insert job titles" ON public.job_titles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update job titles" ON public.job_titles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete job titles" ON public.job_titles
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add job_title_id to team_members
ALTER TABLE public.team_members
  ADD COLUMN job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL;

-- 3. Seed default job titles
INSERT INTO public.job_titles (name, sort_order) VALUES
  ('Gerente', 1),
  ('Operador de Frota', 2),
  ('Vistoriador', 3),
  ('Atendente', 4),
  ('Financeiro', 5),
  ('Mecânico', 6),
  ('Auxiliar', 7);

-- 4. Backfill: create extra job_titles from distinct existing positions
INSERT INTO public.job_titles (name, sort_order)
SELECT DISTINCT tm.position, 100
FROM public.team_members tm
WHERE tm.position IS NOT NULL
  AND trim(tm.position) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.job_titles jt WHERE jt.name = tm.position);

-- 5. Link team_members.job_title_id by name match
UPDATE public.team_members tm
SET job_title_id = jt.id
FROM public.job_titles jt
WHERE tm.position = jt.name
  AND tm.job_title_id IS NULL;
