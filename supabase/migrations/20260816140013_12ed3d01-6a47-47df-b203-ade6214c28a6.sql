REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.people FROM anon;
REVOKE ALL ON public.photos FROM anon;
REVOKE ALL ON public.gallery_views FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gallery_views FROM authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.gallery_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.people TO service_role;
GRANT ALL ON public.photos TO service_role;
GRANT ALL ON public.gallery_views TO service_role;