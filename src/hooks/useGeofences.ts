import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Geofence = {
  id: string;
  vehicle_id: string | null;
  name: string;
  geometry: any;
  active: boolean;
};

export function useGeofences(enabled = true) {
  return useQuery({
    queryKey: ["geofences-active"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Geofence[]> => {
      const { data, error } = await supabase
        .from("vehicle_geofences")
        .select("id, vehicle_id, name, geometry, active")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}
