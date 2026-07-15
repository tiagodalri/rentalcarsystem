import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE, DEMO_TRACKER } from "./config";

/**
 * Simulador de rastreador GPS 100% client-side.
 *
 * Puxa periodicamente a lista de veículos "em locação" ou "em deslocamento"
 * e atualiza as linhas de `vehicle_telemetry` com pequenos deltas de posição,
 * velocidade, direção, combustível e hodômetro. A UI (useFleetLive) reage via
 * Supabase realtime e anima os marcadores no mapa.
 *
 * Não faz chamada a nenhuma API externa. Não substitui rastreador real —
 * é exclusivo do modo demo.
 */

type TelemetryRow = {
  vehicle_id: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  odometer: number | null;
  fuel_level: number | null;
  is_running: boolean | null;
};

// Centros das regiões que a operação atua — se um carro sair muito longe,
// puxamos de volta em direção ao centro mais próximo.
const REGION_ANCHORS: Array<[number, number]> = [
  [28.5383, -81.3792], // Orlando
  [28.2919, -81.4076], // Kissimmee
  [28.3172, -81.5348], // Celebration
  [28.1611, -81.6018], // Davenport
  [28.5652, -81.5865], // Winter Garden
  [28.3701, -81.5192], // Lake Buena Vista
];

function nearestAnchor(lat: number, lng: number): [number, number] {
  let best: [number, number] = REGION_ANCHORS[0];
  let bestD = Infinity;
  for (const a of REGION_ANCHORS) {
    const d = (a[0] - lat) ** 2 + (a[1] - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

let started = false;
let timerId: number | null = null;

async function tick() {
  try {
    // Movemos TODOS os veículos com telemetria — o mapa deve estar vivo
    // desde o primeiro segundo em modo demo.
    const { data, error } = await supabase
      .from("vehicle_telemetry")
      .select("vehicle_id, lat, lng, heading, speed, odometer, fuel_level, is_running");

    if (error || !data) return;

    const movers = data as TelemetryRow[];
    if (movers.length === 0) return;


    // Atualização em paralelo — TODOS os veículos alugados, nenhum "congelado".
    await Promise.all(
      movers.map((r) => {
        const idle = Math.random() < DEMO_TRACKER.idleChance;
        const speed = idle
          ? 0
          : Math.round(
              DEMO_TRACKER.minSpeed +
                Math.random() * (DEMO_TRACKER.maxSpeed - DEMO_TRACKER.minSpeed),
            );
        const heading = Math.round(((r.heading ?? 0) + (Math.random() - 0.5) * 30 + 360) % 360);

        const curLat = r.lat ?? 28.5383;
        const curLng = r.lng ?? -81.3792;
        const [aLat, aLng] = nearestAnchor(curLat, curLng);
        const drift = 0.02;
        const pullLat = Math.abs(curLat - aLat) > drift ? (aLat - curLat) * 0.05 : 0;
        const pullLng = Math.abs(curLng - aLng) > drift ? (aLng - curLng) * 0.05 : 0;

        const dLat = idle ? 0 : (Math.random() - 0.5) * DEMO_TRACKER.maxLatDelta + pullLat;
        const dLng = idle ? 0 : (Math.random() - 0.5) * DEMO_TRACKER.maxLngDelta + pullLng;

        const nextLat = curLat + dLat;
        const nextLng = curLng + dLng;

        const nextOdo = (r.odometer ?? 0) + (idle ? 0 : Math.round(speed / 60));
        const nextFuel = Math.max(
          0.05,
          Math.min(1, (r.fuel_level ?? 0.8) - (idle ? 0 : 0.0015)),
        );

        return supabase
          .from("vehicle_telemetry")
          .update({
            lat: Number(nextLat.toFixed(6)),
            lng: Number(nextLng.toFixed(6)),
            heading,
            speed,
            is_running: !idle,
            odometer: nextOdo,
            fuel_level: Number(nextFuel.toFixed(3)),
            last_event: idle ? "idle" : "trip_update",
            reported_at: new Date().toISOString(),
          })
          .eq("vehicle_id", r.vehicle_id);
      }),
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[demo-tracker] tick falhou:", err);
    }
  }
}

/** Inicia o simulador. Idempotente — chame quantas vezes quiser. */
export function startDemoTracker(): void {
  if (!DEMO_MODE || started || typeof window === "undefined") return;
  started = true;
  // Primeiro tick imediato para animação começar sem espera.
  window.setTimeout(() => {
    void tick();
    timerId = window.setInterval(() => void tick(), DEMO_TRACKER.intervalMs);
  }, 500);
}

/** Para o simulador (útil para testes/hot reload). */
export function stopDemoTracker(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  started = false;
}
