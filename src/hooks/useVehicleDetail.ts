import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleDetail = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  vin: string | null;
  bouncie_imei: string | null;
  color: string | null;
  category: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expires_at: string | null;
  insurance_starts_at: string | null;
  next_inspection_at: string | null;
  current_mileage: number | null;
};

export function useVehicleDetail(vehicleId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["vehicle-detail", vehicleId],
    enabled: enabled && !!vehicleId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VehicleDetail | null> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, make, model, year, license_plate, vin, bouncie_imei, color, category, insurance_provider, insurance_policy_number, insurance_expires_at, insurance_starts_at, next_inspection_at, current_mileage")
        .eq("id", vehicleId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}
