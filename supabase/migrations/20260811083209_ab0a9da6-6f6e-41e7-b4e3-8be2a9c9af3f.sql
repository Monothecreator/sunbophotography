REVOKE EXECUTE ON FUNCTION public.is_studio_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_studio_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.event_studio_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_studio_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_studio_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.event_studio_id(uuid) TO authenticated, service_role;