
-- Permitir que motoristas (driver) tambem lancem custos por veiculo
DROP POLICY IF EXISTS "Staff can manage expenses" ON public.vehicle_expenses;

CREATE POLICY "Staff can manage expenses"
ON public.vehicle_expenses
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role]));

-- Storage policies para o bucket privado expense-receipts (incluindo driver)
DROP POLICY IF EXISTS "Staff read expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete expense receipts" ON storage.objects;

CREATE POLICY "Staff read expense receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-receipts'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role])
);

CREATE POLICY "Staff upload expense receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role])
);

CREATE POLICY "Staff update expense receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'expense-receipts'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role])
);

CREATE POLICY "Staff delete expense receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'expense-receipts'
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role,'operations'::app_role,'driver'::app_role])
);
