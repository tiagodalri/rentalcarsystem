import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleTrip = {
  id: string;
  vehicle_id: string | null;
  imei: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_mi: number | null;
  hard_braking: number | null;
  hard_accel: number | null;
  fuel_consumed_gal: number | null;
  average_mpg: number | null;
  max_speed_mph: number | null;
  avg_speed_mph: number | null;
  idle_seconds: number | null;
  start_address: string | null;
  end_address: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  start_odometer: number | null;
  end_odometer: number | null;
  gps: any;
};

export function useVehicleTrips(vehicleId: string | null, days = 30, enabled = true) {
  return useQuery({
    queryKey: ["vehicle-trips", vehicleId, days],
    enabled: enabled && !!vehicleId,
    staleTime: 60_000,
    queryFn: async (): Promise<VehicleTrip[]> => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("vehicle_trips")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}
