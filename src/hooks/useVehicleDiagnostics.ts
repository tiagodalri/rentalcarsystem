import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleDiagnostic = {
  id: string;
  vehicle_id: string;
  imei: string | null;
  recorded_at: string;
  mil_on: boolean | null;
  dtc_codes: string[] | null;
  battery_voltage: number | null;
  fuel_level_pct: number | null;
  odometer_mi: number | null;
};

export function useVehicleDiagnostics(vehicleId: string | null) {
  return useQuery({
    queryKey: ["vehicle-diagnostics", vehicleId],
    enabled: !!vehicleId,
    staleTime: 60_000,
    queryFn: async (): Promise<VehicleDiagnostic | null> => {
      const { data, error } = await supabase
        .from("vehicle_diagnostics")
        .select("id, vehicle_id, imei, recorded_at, mil_on, dtc_codes, battery_voltage, fuel_level_pct, odometer_mi")
        .eq("vehicle_id", vehicleId!)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as VehicleDiagnostic | null;
    },
  });
}
