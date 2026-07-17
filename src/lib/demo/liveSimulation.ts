/**
 * Live Tracking — camada de simulação em tempo real (DEMO).
 *
 * Máquina de estados por veículo (runner):
 *
 *   ┌──────────┐   fim de rota &&    ┌────────────────┐
 *   │ dirigindo│ ─── tempo mínimo? ─▶│ inverte sentido│──┐
 *   └────┬─────┘   NÃO cumprido      └────────────────┘  │
 *        │                                                 │
 *        │  chance rara (~a cada minutos)                  │
 *        ▼                                                 │
 *   ┌────────────┐  4-10s                                  │
 *   │ semáforo   │ ─────────▶ dirigindo (mesma direção) ◀──┘
 *   │ (inTransit)│
 *   └────────────┘
 *        │
 *        │ fim de rota && tempo mínimo cumprido
 *        ▼
 *   ┌──────────┐  substituição espaçada (>= 3-5 min entre trocas,
 *   │ estacionou│  imediato se contagem cair abaixo do piso)
 *   │ (retired) │  ── spawn de um novo runner em outro veículo
 *   └──────────┘
 *
 * Regras de estabilidade:
 * - Spawn de progresso 0-30% da rota (nunca perto do destino).
 * - MIN_DRIVE_MS ≥ 8 min antes de qualquer parada real; se a rota
 *   é curta, o veículo faz ida-e-volta contínua até cumprir o tempo.
 * - "Semáforo" mantém `inTransit=true` — o consumidor trata como
 *   moving na lista/KPI (não rebaralha a ordenação).
 * - Substituições respeitam SWAP_COOLDOWN_MS; só entra outro
 *   antecipado se moving cair abaixo de MIN_MOVING.
 */

import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { DEMO_MODE } from "./config";

type LatLng = { lat: number; lng: number };

type RouteDef = {
  id: string;
  label: string;
  from: LatLng;
  to: LatLng;
  /** velocidade média-alvo em mph (varia +/- 20% ao longo do trajeto) */
  targetSpeed: number;
};

const ROUTES: RouteDef[] = [
  { id: "mco-idrive", label: "MCO · sentido International Drive", from: { lat: 28.4312, lng: -81.3081 }, to: { lat: 28.4432, lng: -81.4691 }, targetSpeed: 42 },
  { id: "kissimmee-winterpark", label: "Kissimmee · sentido Winter Park", from: { lat: 28.2919, lng: -81.4076 }, to: { lat: 28.5999, lng: -81.3392 }, targetSpeed: 55 },
  { id: "lbv-downtown", label: "Lake Buena Vista · sentido Downtown Orlando", from: { lat: 28.3701, lng: -81.5192 }, to: { lat: 28.5383, lng: -81.3792 }, targetSpeed: 48 },
  { id: "i4-tampa", label: "I-4 · sentido Tampa", from: { lat: 28.5427, lng: -81.3789 }, to: { lat: 28.1611, lng: -81.6018 }, targetSpeed: 65 },
  { id: "417-sanford", label: "SR-417 · sentido Sanford", from: { lat: 28.4312, lng: -81.3081 }, to: { lat: 28.7503, lng: -81.2711 }, targetSpeed: 62 },
  { id: "528-cocoa", label: "SR-528 · sentido Cocoa Beach", from: { lat: 28.4312, lng: -81.3081 }, to: { lat: 28.3200, lng: -80.6076 }, targetSpeed: 68 },
  { id: "celebration-mco", label: "Celebration · sentido MCO", from: { lat: 28.3172, lng: -81.5348 }, to: { lat: 28.4312, lng: -81.3081 }, targetSpeed: 45 },
  { id: "wintergarden-idrive", label: "Winter Garden · sentido International Drive", from: { lat: 28.5652, lng: -81.5865 }, to: { lat: 28.4432, lng: -81.4691 }, targetSpeed: 40 },
  { id: "davenport-orlando", label: "Davenport · sentido Orlando", from: { lat: 28.1611, lng: -81.6018 }, to: { lat: 28.5383, lng: -81.3792 }, targetSpeed: 58 },
  { id: "mia-beach", label: "MIA · sentido Miami Beach", from: { lat: 25.7959, lng: -80.2870 }, to: { lat: 25.7907, lng: -80.1300 }, targetSpeed: 38 },
  { id: "brickell-wynwood", label: "Brickell · sentido Wynwood", from: { lat: 25.7620, lng: -80.1918 }, to: { lat: 25.8007, lng: -80.1990 }, targetSpeed: 30 },
] as const;

type CachedRoute = { path: LatLng[]; cumDist: number[]; totalDist: number };
const CACHE_KEY = "godalz:live-sim:routes:v1";
const routeCache = new Map<string, CachedRoute>();

const MIN_MOVING = 5;                     // piso do KPI "Em movimento"
const TARGET_MIN = 6;                     // alvo inferior de runners ativos
const TARGET_MAX = 8;                     // alvo superior
const MIN_DRIVE_MS = 8 * 60_000;          // 8 min
const MAX_DRIVE_MS = 15 * 60_000;         // 15 min
const SWAP_COOLDOWN_MIN_MS = 3 * 60_000;  // 3 min
const SWAP_COOLDOWN_MAX_MS = 5 * 60_000;  // 5 min

function loadCache(): void {
  try {
    const raw = window.sessionStorage?.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { path: LatLng[] }>;
    for (const [id, v] of Object.entries(parsed)) {
      if (!v?.path || v.path.length < 2) continue;
      routeCache.set(id, buildCached(v.path));
    }
  } catch { /* ignore */ }
}

function saveCache(): void {
  try {
    const obj: Record<string, { path: LatLng[] }> = {};
    routeCache.forEach((v, k) => { obj[k] = { path: v.path }; });
    window.sessionStorage?.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function buildCached(path: LatLng[]): CachedRoute {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineM(path[i - 1], path[i]);
    cum.push(total);
  }
  return { path, cumDist: cum, totalDist: total };
}

function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let b: number, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return out;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

async function fetchRoute(ds: any, r: RouteDef): Promise<CachedRoute | null> {
  const cached = routeCache.get(r.id);
  if (cached) return cached;
  try {
    const res = await ds.route({
      origin: r.from,
      destination: r.to,
      travelMode: (window as any).google.maps.TravelMode.DRIVING,
    });
    const route = res?.routes?.[0];
    if (!route) return null;
    let path: LatLng[] = [];
    const encoded = route.overview_polyline?.points ?? route.overview_polyline;
    if (typeof encoded === "string" && encoded.length > 0) {
      path = decodePolyline(encoded);
    } else if (Array.isArray(route.overview_path)) {
      path = route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
    }
    if (path.length < 2) return null;
    const built = buildCached(path);
    routeCache.set(r.id, built);
    saveCache();
    return built;
  } catch {
    return null;
  }
}

export type SimOverride = {
  lat: number;
  lng: number;
  heading: number;
  speed: number; // mph, inteiro
  is_running: boolean;
  /** true durante trajeto (mesmo parado no semáforo) — consumidor trata como "moving". */
  inTransit: boolean;
  address: string;
  reported_at: string;
};

type Runner = {
  vehicleId: string;
  route: RouteDef;
  path: LatLng[];
  cumDist: number[];
  totalDist: number;
  progressM: number;
  direction: 1 | -1;
  drivingSince: number;
  minDriveMs: number;
  trafficLightUntil: number;
  currentMph: number;
  targetMph: number;
  nextTargetSwitchAt: number;
  /** quando true, foi aposentado — permanece com override "parado" no lugar. */
  retired: boolean;
};

const overrides = new Map<string, SimOverride>();
const listeners = new Set<() => void>();
const runners: Runner[] = [];

// Contexto de spawn/substituição
let initialized = false;
let rafId: number | null = null;
let lastFrameTs = 0;
let lastNotifyTs = 0;
let lastSwapAt = 0;
let swapCooldownMs = SWAP_COOLDOWN_MIN_MS;
let targetCount = TARGET_MIN;
let dsRef: any = null;
let vehiclePoolRef: { vehicle_id: string; name?: string | null }[] = [];
let routeQueueRef: RouteDef[] = [];
let spawning = false;

function notifyThrottled(now: number) {
  if (now - lastNotifyTs < 250) return;
  lastNotifyTs = now;
  listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
}

function pickNextRoute(): RouteDef | null {
  if (routeQueueRef.length === 0) {
    routeQueueRef = [...ROUTES].sort(() => Math.random() - 0.5);
  }
  const usedIds = new Set(runners.filter((r) => !r.retired).map((r) => r.route.id));
  const idx = routeQueueRef.findIndex((r) => !usedIds.has(r.id));
  if (idx === -1) return routeQueueRef.shift() ?? null;
  const [r] = routeQueueRef.splice(idx, 1);
  return r;
}

function pickNextVehicleId(): string | null {
  const busy = new Set(runners.map((r) => r.vehicleId));
  for (const v of vehiclePoolRef) {
    if (!busy.has(v.vehicle_id)) return v.vehicle_id;
  }
  return null;
}

function activeMovingCount(): number {
  return runners.filter((r) => !r.retired).length;
}

async function spawnRunner(now: number): Promise<boolean> {
  if (spawning || !dsRef) return false;
  const vehId = pickNextVehicleId();
  if (!vehId) return false;
  const route = pickNextRoute();
  if (!route) return false;
  spawning = true;
  try {
    const rc = await fetchRoute(dsRef, route);
    if (!rc) return false;
    // Spawn 0-30% da rota, sentido "ida" (1) para começar longe do destino.
    const startProgress = rc.totalDist * (Math.random() * 0.3);
    const runner: Runner = {
      vehicleId: vehId,
      route,
      path: rc.path,
      cumDist: rc.cumDist,
      totalDist: rc.totalDist,
      progressM: startProgress,
      direction: 1,
      drivingSince: now,
      minDriveMs: MIN_DRIVE_MS + Math.random() * (MAX_DRIVE_MS - MIN_DRIVE_MS),
      trafficLightUntil: 0,
      currentMph: route.targetSpeed * (0.7 + Math.random() * 0.3),
      targetMph: route.targetSpeed,
      nextTargetSwitchAt: now + 3000 + Math.random() * 6000,
      retired: false,
    };
    runners.push(runner);
    commitPosition(runner, now);
    lastSwapAt = now;
    swapCooldownMs = SWAP_COOLDOWN_MIN_MS + Math.random() * (SWAP_COOLDOWN_MAX_MS - SWAP_COOLDOWN_MIN_MS);
    listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
    return true;
  } finally {
    spawning = false;
  }
}

function retireRunner(r: Runner, now: number) {
  r.retired = true;
  r.currentMph = 0;
  // Fixa override no último ponto como "estacionado".
  const last = overrides.get(r.vehicleId);
  if (last) {
    overrides.set(r.vehicleId, {
      ...last,
      speed: 0,
      is_running: false,
      inTransit: false,
      reported_at: new Date(now).toISOString(),
    });
  }
}

function commitPosition(r: Runner, now: number) {
  const p = Math.max(0, Math.min(r.totalDist, r.progressM));
  let lo = 0, hi = r.cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (r.cumDist[mid] <= p) lo = mid; else hi = mid;
  }
  const segLen = Math.max(1, r.cumDist[hi] - r.cumDist[lo]);
  const t = (p - r.cumDist[lo]) / segLen;
  const a = r.path[lo];
  const b = r.path[hi];
  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;
  const heading = r.direction === 1 ? bearing(a, b) : bearing(b, a);
  const inLight = now < r.trafficLightUntil;
  overrides.set(r.vehicleId, {
    lat,
    lng,
    heading,
    speed: inLight ? 0 : Math.max(0, Math.round(r.currentMph)),
    is_running: true,       // mesmo no semáforo: motor ligado
    inTransit: true,        // consumidor entende como "moving"
    address: r.route.label,
    reported_at: new Date(now).toISOString(),
  });
}

function stepRunner(r: Runner, dtMs: number, now: number) {
  if (r.retired) return;

  // Semáforo momentâneo: desacelera pra 0, mantém inTransit.
  if (now < r.trafficLightUntil) {
    r.currentMph = Math.max(0, r.currentMph - dtMs * 0.03);
    commitPosition(r, now);
    return;
  }

  // Chance rara de semáforo (~a cada ~2-4 min em média).
  if (Math.random() < 0.00025) {
    r.trafficLightUntil = now + 4000 + Math.random() * 6000;
    r.targetMph = 0;
    commitPosition(r, now);
    return;
  }

  if (now >= r.nextTargetSwitchAt) {
    r.targetMph = r.route.targetSpeed * (0.8 + Math.random() * 0.35);
    r.nextTargetSwitchAt = now + 6000 + Math.random() * 6000;
  }
  // Ease para alvo
  r.currentMph += (r.targetMph - r.currentMph) * Math.min(1, dtMs / 1400);
  const mps = Math.max(2, r.currentMph) * 0.44704; // nunca abaixo de ~4mph em trânsito
  r.progressM += mps * (dtMs / 1000) * r.direction;

  const atEnd = r.progressM >= r.totalDist;
  const atStart = r.progressM <= 0;
  if (atEnd || atStart) {
    r.progressM = atEnd ? r.totalDist : 0;
    const droveEnough = now - r.drivingSince >= r.minDriveMs;
    if (droveEnough) {
      retireRunner(r, now);
      return;
    }
    // Ainda não cumpriu o tempo mínimo → ida-e-volta contínua.
    r.direction = r.direction === 1 ? -1 : 1;
    r.currentMph = Math.max(8, r.currentMph * 0.6);
    r.targetMph = r.route.targetSpeed * (0.8 + Math.random() * 0.3);
  }
  commitPosition(r, now);
}

function maintainFleet(now: number) {
  const active = activeMovingCount();
  if (active >= targetCount) return;
  // Piso: se cair abaixo do MIN_MOVING, promover IMEDIATAMENTE (sem cooldown).
  const belowFloor = active < MIN_MOVING;
  const cooldownOk = now - lastSwapAt >= swapCooldownMs;
  if (!belowFloor && !cooldownOk) return;
  void spawnRunner(now);
}

function loop(ts: number) {
  const dtMs = lastFrameTs ? Math.min(500, ts - lastFrameTs) : 16;
  lastFrameTs = ts;
  const now = Date.now();
  for (const r of runners) stepRunner(r, dtMs, now);
  maintainFleet(now);
  notifyThrottled(now);
  rafId = window.requestAnimationFrame(loop);
}

export function getSimOverride(vehicleId: string): SimOverride | undefined {
  return overrides.get(vehicleId);
}

export function getSimVehicleIds(): Set<string> {
  return new Set(overrides.keys());
}

export function subscribeSim(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export async function initLiveSimulation(
  vehicles: { vehicle_id: string; name?: string | null }[],
  options?: { eligibleIds?: string[] },
): Promise<void> {
  if (!DEMO_MODE || initialized || typeof window === "undefined") return;
  if (!vehicles || vehicles.length === 0) return;

  const eligible = options?.eligibleIds;
  if (!eligible || eligible.length === 0) return;
  const eligibleSet = new Set(eligible);

  initialized = true;
  loadCache();

  let google: any;
  try {
    google = await loadGoogleMaps();
  } catch {
    initialized = false;
    return;
  }
  if (!google?.maps?.DirectionsService) {
    initialized = false;
    return;
  }
  dsRef = new google.maps.DirectionsService();

  // Pool de veículos elegíveis, embaralhado (uso durante toda a sessão).
  const pool = vehicles.filter((v) => !!v.vehicle_id && eligibleSet.has(v.vehicle_id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  vehiclePoolRef = pool;
  routeQueueRef = [...ROUTES].sort(() => Math.random() - 0.5);

  targetCount = Math.min(pool.length, TARGET_MIN + Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)));

  const now = Date.now();
  lastSwapAt = now - swapCooldownMs; // permite spawns iniciais imediatos
  // Spawn inicial em série (respeitando quota do Directions).
  for (let i = 0; i < targetCount; i++) {
    const ok = await spawnRunner(now);
    if (!ok) break;
    if (i < targetCount - 1) {
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  // Após spawn inicial, seta cooldown normal.
  lastSwapAt = Date.now();

  if (runners.length === 0) {
    initialized = false;
    return;
  }
  rafId = window.requestAnimationFrame(loop);
}

export function stopLiveSimulation(): void {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  runners.length = 0;
  overrides.clear();
  vehiclePoolRef = [];
  routeQueueRef = [];
  dsRef = null;
  initialized = false;
}
