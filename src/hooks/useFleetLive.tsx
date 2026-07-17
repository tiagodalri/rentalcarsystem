import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  initLiveSimulation,
  subscribeSim,
  getSimOverride,
} from "@/lib/demo/liveSimulation";

export type LiveStatus = "moving" | "idle" | "parked";

export type LiveVehicle = {
  vehicle_id: string;
  name: string;
  plate: string | null;
  imei: string | null;
  image_url: string | null;
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
  vehicles: { name: string; license_plate: string | null; image_url: string | null } | null;
};

type TelemetryPayload = Partial<Omit<Row, "vehicles">>;

export function useFleetLive() {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  // Cache estático de nome/placa por vehicle_id — não vem no payload realtime.
  const metaRef = useRef<Map<string, { name: string; plate: string | null; image_url: string | null }>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("vehicle_telemetry")
        .select(
          "vehicle_id, imei, lat, lng, heading, speed, is_running, odometer, fuel_level, battery_status, mil_on, address, last_event, reported_at, vehicles!inner ( name, license_plate, image_url, deleted_at )"
        )
        .is("vehicles.deleted_at", null);

      if (cancelled) return;
      if (error) {
        console.error("[useFleetLive] load error:", error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as Row[];
      const meta = metaRef.current;
      const list: LiveVehicle[] = [];
      for (const r of rows) {
        if (!r.vehicles) continue;
        meta.set(r.vehicle_id, { name: r.vehicles.name, plate: r.vehicles.license_plate, image_url: r.vehicles.image_url });
        list.push({
          vehicle_id: r.vehicle_id,
          name: r.vehicles.name,
          plate: r.vehicles.license_plate,
          image_url: r.vehicles.image_url,
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
        });
      }
      setVehicles(list);
      setLoading(false);
    }

    load();
    // Fallback polling de 10s para garantir frescor mesmo se um pacote realtime cair.
    const pollId = window.setInterval(() => { void load(); }, 10_000);

    // PATCH INCREMENTAL: aplicar payload.new direto no state sem re-SELECT.
    // Elimina o gargalo de rede/render que causava o efeito "travado".
    const channel = supabase
      .channel("vehicle_telemetry_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_telemetry" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.vehicle_id;
            if (!oldId) return;
            setVehicles((prev) => prev.filter((v) => v.vehicle_id !== oldId));
            return;
          }
          const row = payload.new as TelemetryPayload | null;
          if (!row || !row.vehicle_id) return;

          setVehicles((prev) => {
            const idx = prev.findIndex((v) => v.vehicle_id === row.vehicle_id);
            const meta = metaRef.current.get(row.vehicle_id);
            // Se for um veículo novo que ainda não temos meta (nome/placa),
            // disparamos um load() pra hidratar — caso raro.
            if (idx === -1) {
              if (!meta) {
                void load();
                return prev;
              }
              const next: LiveVehicle = {
                vehicle_id: row.vehicle_id,
                name: meta.name,
                plate: meta.plate,
                image_url: meta.image_url,
                imei: row.imei ?? null,
                lat: row.lat ?? null,
                lng: row.lng ?? null,
                heading: row.heading ?? null,
                speed: row.speed ?? null,
                is_running: row.is_running ?? null,
                odometer: row.odometer ?? null,
                fuel_level: row.fuel_level ?? null,
                battery_status: row.battery_status ?? null,
                mil_on: row.mil_on ?? null,
                address: row.address ?? null,
                last_event: row.last_event ?? null,
                reported_at: row.reported_at ?? null,
                status: deriveStatus({
                  is_running: row.is_running ?? null,
                  speed: row.speed ?? null,
                }),
              };
              return [...prev, next];
            }

            const current = prev[idx];
            const merged: LiveVehicle = {
              ...current,
              imei: row.imei ?? current.imei,
              lat: row.lat ?? current.lat,
              lng: row.lng ?? current.lng,
              heading: row.heading ?? current.heading,
              speed: row.speed ?? current.speed,
              is_running: row.is_running ?? current.is_running,
              odometer: row.odometer ?? current.odometer,
              fuel_level: row.fuel_level ?? current.fuel_level,
              battery_status: row.battery_status ?? current.battery_status,
              mil_on: row.mil_on ?? current.mil_on,
              address: row.address ?? current.address,
              last_event: row.last_event ?? current.last_event,
              reported_at: row.reported_at ?? current.reported_at,
            };
            merged.status = deriveStatus({
              is_running: merged.is_running,
              speed: merged.speed,
            });

            // Evita re-render se nada relevante mudou (mesmo reported_at).
            if (
              current.lat === merged.lat &&
              current.lng === merged.lng &&
              current.reported_at === merged.reported_at &&
              current.status === merged.status &&
              current.speed === merged.speed
            ) {
              return prev;
            }

            const copy = prev.slice();
            copy[idx] = merged;
            return copy;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, []);

  return { vehicles, loading };
}
