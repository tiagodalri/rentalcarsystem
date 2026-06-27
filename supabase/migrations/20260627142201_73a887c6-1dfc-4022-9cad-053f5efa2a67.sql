
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Zeus Rental Car LLC',
  company_address text NOT NULL DEFAULT 'Orlando, FL — EUA',
  company_ein text NOT NULL DEFAULT '—',
  header_subtitle text NOT NULL DEFAULT 'CONTRATO DE LOCAÇÃO DE VEÍCULO',
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  disclaimer text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT 'Contrato gerado eletronicamente — Zeus Rental Car',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contract_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contract template"
  ON public.contract_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert contract template"
  ON public.contract_templates FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contract template"
  ON public.contract_templates FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contract template"
  ON public.contract_templates FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.contract_templates (company_name, company_address, company_ein, header_subtitle, clauses, disclaimer, footer_text)
VALUES (
  'Zeus Rental Car LLC',
  'Orlando, FL — EUA',
  '—',
  'CONTRATO DE LOCAÇÃO DE VEÍCULO',
  '[
    "1. O LOCATÁRIO declara possuir CNH válida durante toda a vigência da locação.",
    "2. O LOCATÁRIO é responsável por danos materiais, multas de trânsito e infrações cometidas durante o período de locação.",
    "3. A devolução deve ser feita no local e horário acordados. Atrasos podem incorrer em diária adicional.",
    "4. O LOCATÁRIO se compromete a não conduzir o veículo sob efeito de álcool, drogas ou em condições que comprometam a segurança.",
    "5. Em caso de sinistro, comunicar a LOCADORA imediatamente pelo WhatsApp oficial e acionar autoridades locais."
  ]'::jsonb,
  '* As cláusulas acima são versão inicial e estão sujeitas a revisão jurídica final pela LOCADORA antes de serem consideradas vinculativas.',
  'Contrato gerado eletronicamente — Zeus Rental Car'
);
