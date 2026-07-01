
DROP POLICY IF EXISTS "Staff can read expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete expense receipts" ON storage.objects;

CREATE POLICY "Staff can read expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'expense-receipts' AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));

CREATE POLICY "Staff can upload expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts' AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));

CREATE POLICY "Staff can update expense receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'expense-receipts' AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));

CREATE POLICY "Staff can delete expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts' AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[]));
