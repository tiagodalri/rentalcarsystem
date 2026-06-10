
REVOKE EXECUTE ON FUNCTION public.get_occupancy_rate()                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_last_login()                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[])                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_pricing(uuid, date, date)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_availability(uuid, date, date, uuid) FROM PUBLIC, anon;
