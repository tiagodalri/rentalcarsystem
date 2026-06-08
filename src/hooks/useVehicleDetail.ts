import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleDetail = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  manufacture_year: number | null;
  license_plate: string | null;
  vin: string | null;
  bouncie_imei: string | null;
  bouncie_vin: string | null;
  color: string | null;
  category: string;
  fuel: string;
  transmission: string;
  engine_size: string | null;
  engine_type: string | null;
  doors: number | null;
  passengers: number;
  current_odometer: number | null;
  insurance_provider: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  last_service_date: string | null;
  next_service_km: number | null;
  registration_expiry: string | null;
};

export function useVehicleDetail(vehicleId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["vehicle-detail", vehicleId],
    enabled: enabled && !!vehicleId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VehicleDetail | null> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, brand, model, year, manufacture_year, license_plate, vin, bouncie_imei, bouncie_vin, color, category, fuel, transmission, engine_size, engine_type, doors, passengers, current_odometer, insurance_policy, insurance_expiry, last_service_date, next_service_km, registration_expiry")
        .eq("id", vehicleId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...(data as any), insurance_provider: null };
    },
  });
}
