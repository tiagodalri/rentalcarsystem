import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VehicleEvent = {
  id: string;
  vehicle_id: string | null;
  imei: string | null;
  event_type: string;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  speed_mph: number | null;
  severity: string | null;
  payload: any;
};

export type EventCategory = "drive" | "vehicle" | "care";

export function categorizeEvent(eventType: string): EventCategory {
  const t = eventType.toLowerCase();
  if (t.includes("geofence")) return "vehicle";
  if (t.includes("brak") || t.includes("accel") || t.includes("speed") || t.includes("idle") || t.includes("trip")) return "drive";
  if (t.includes("mil") || t.includes("connect") || t.includes("battery") || t.includes("diagnostic")) return "vehicle";
  return "care";
}

export function useVehicleEvents(vehicleId: string | null, days = 30, enabled = true) {
  return useQuery({
    queryKey: ["vehicle-events", vehicleId, days],
    enabled: enabled && !!vehicleId,
    staleTime: 60_000,
    queryFn: async (): Promise<VehicleEvent[]> => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("vehicle_events")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}
