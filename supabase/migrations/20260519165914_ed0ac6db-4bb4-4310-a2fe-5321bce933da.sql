
CREATE TABLE public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'gold',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE public.customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE(customer_id, tag_id)
);

CREATE INDEX idx_cust_tag_assign_customer ON public.customer_tag_assignments(customer_id);
CREATE INDEX idx_cust_tag_assign_tag ON public.customer_tag_assignments(tag_id);

CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cust_notes_customer ON public.customer_notes(customer_id, created_at DESC);

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage customer tags" ON public.customer_tags
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]));

CREATE POLICY "Staff can manage customer tag assignments" ON public.customer_tag_assignments
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]));

CREATE POLICY "Staff can manage customer notes" ON public.customer_notes
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role,'operations'::app_role]));

CREATE TRIGGER trg_cust_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.customer_tags (name, color, description, sort_order) VALUES
  ('VIP', 'gold', 'Cliente premium com atendimento prioritário', 1),
  ('Recorrente', 'emerald', 'Cliente com múltiplas locações', 2),
  ('Novo', 'blue', 'Cliente recente, primeira locação', 3),
  ('Atenção', 'amber', 'Requer atenção especial', 4),
  ('Bloqueado', 'red', 'Cliente bloqueado, não locar', 5);
