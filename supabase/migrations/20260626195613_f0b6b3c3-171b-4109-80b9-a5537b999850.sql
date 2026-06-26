
CREATE OR REPLACE FUNCTION public.bump_public_inspection_link_view(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.public_inspection_links
     SET view_count = view_count + 1,
         last_viewed_at = now()
   WHERE token = _token;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_public_inspection_link_view(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_public_inspection_link_view(text) TO service_role;
