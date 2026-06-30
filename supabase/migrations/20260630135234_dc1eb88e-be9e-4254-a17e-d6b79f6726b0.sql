REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_vehicle_basic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_basic(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_vehicles_basic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_vehicles_basic() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_vehicle_pricing(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_pricing(uuid, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_last_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_last_login() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bump_public_inspection_link_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_public_inspection_link_view(text) TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.check_vehicle_availability(uuid, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_vehicle_availability(uuid, date, date, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_vehicle_for_my_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_for_my_booking(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_occupancy_rate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_occupancy_rate() TO authenticated, service_role;