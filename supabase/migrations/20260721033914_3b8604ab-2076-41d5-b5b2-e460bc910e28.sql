
CREATE POLICY "wa_media_admin_ops_support_all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'operations') OR
    public.has_role(auth.uid(), 'support')
  )
)
WITH CHECK (
  bucket_id = 'whatsapp-media' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'operations') OR
    public.has_role(auth.uid(), 'support')
  )
);
