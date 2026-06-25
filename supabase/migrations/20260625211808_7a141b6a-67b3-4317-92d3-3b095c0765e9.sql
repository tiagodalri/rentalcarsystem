-- 1) Add new value to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- 2) Update sync trigger to map driver labels to the new role
CREATE OR REPLACE FUNCTION public.sync_team_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE mapped_role app_role;
BEGIN
  mapped_role := CASE LOWER(NEW.role)
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'administrador' THEN 'admin'::app_role
    WHEN 'finance' THEN 'finance'::app_role
    WHEN 'financeiro' THEN 'finance'::app_role
    WHEN 'operations' THEN 'operations'::app_role
    WHEN 'operacional' THEN 'operations'::app_role
    WHEN 'support' THEN 'support'::app_role
    WHEN 'atendimento' THEN 'support'::app_role
    WHEN 'driver' THEN 'driver'::app_role
    WHEN 'motorista' THEN 'driver'::app_role
    WHEN 'operador' THEN 'driver'::app_role
    WHEN 'operador de rua' THEN 'driver'::app_role
    ELSE NULL
  END;

  IF NEW.user_id IS NOT NULL AND mapped_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role IN ('admin','finance','operations','support','driver');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, mapped_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- 3) Update unsync trigger to also clear driver role
CREATE OR REPLACE FUNCTION public.unsync_team_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role IN ('admin','finance','operations','support','driver');
  END IF;
  RETURN OLD;
END $function$;