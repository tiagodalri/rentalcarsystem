import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveStatus = "moving" | "idle" | "parked";

export type LiveVehicle = {
  vehicle_id: string;
  name: string;
  plate: string | null;
  imei: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  is_running: boolean | null;
  odometer: number | null;
  fuel_level: number | null;
  battery_status: string | null;
  mil_on: boolean | null;
  address: string | null;
  last_event: string | null;
  reported_at: string | null;
  status: LiveStatus;
};

function deriveStatus(t: { is_running: boolean | null; speed: number | null }): LiveStatus {
  if (!t.is_running) return "parked";
  if ((t.speed ?? 0) > 3) return "moving";
  return "idle";
}

type Row = {
  vehicle_id: string;
  imei: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  is_running: boolean | null;
  odometer: number | null;
  fuel_level: number | null;
  battery_status: string | null;
  mil_on: boolean | null;
  address: string | null;
  last_event: string | null;
  reported_at: string | null;
  vehicles: { name: string; license_plate: string | null } | null;
};

export function useFleetLive() {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("vehicle_telemetry")
        .select(
          "vehicle_id, imei, lat, lng, heading, speed, is_running, odometer, fuel_level, battery_status, mil_on, address, last_event, reported_at, vehicles ( name, license_plate )"
        );

      if (cancelled) return;
      if (error) {
        console.error("[useFleetLive] load error:", error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as Row[];
      setVehicles(
        rows
          .filter((r) => r.vehicles)
          .map((r) => ({
            vehicle_id: r.vehicle_id,
            name: r.vehicles!.name,
            plate: r.vehicles!.license_plate,
            imei: r.imei,
            lat: r.lat,
            lng: r.lng,
            heading: r.heading,
            speed: r.speed,
            is_running: r.is_running,
            odometer: r.odometer,
            fuel_level: r.fuel_level,
            battery_status: r.battery_status,
            mil_on: r.mil_on,
            address: r.address,
            last_event: r.last_event,
            reported_at: r.reported_at,
            status: deriveStatus(r),
          }))
      );
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("vehicle_telemetry_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_telemetry" },
        () => { load(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { vehicles, loading };
}
