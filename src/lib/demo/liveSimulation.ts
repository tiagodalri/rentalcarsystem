/**
 * Live Tracking — camada de simulação em tempo real (DEMO).
 *
 * Objetivo: em modo demonstração, garantir que ao abrir /admin/live
 * uma parte da frota (5-8 veículos) esteja SE MOVIMENTANDO sobre ruas
 * reais (Waze/Uber-like), enquanto o restante permanece parado.
 *
 * Como funciona:
 * - Ao ser inicializada com a lista de veículos, sorteia 5-8 e associa
 *   cada um a uma rota fixa origem→destino em Orlando/Miami.
 * - Para cada rota, chama `google.maps.DirectionsService.route()` UMA
 *   única vez e cacheia o polyline decodificado em memória +
 *   sessionStorage. Chamadas subsequentes (nova sessão, hot-reload)
 *   reutilizam o cache — máximo ~8-10 requests de Directions no pior
 *   caso, zero se cache válido.
 * - Um único loop de `requestAnimationFrame` interpola a posição de
 *   cada veículo ao longo do polyline com velocidade realista
 *   (25-45 mph urbano, 55-70 mph rodovia), com desacelerações e paradas
 *   ocasionais simulando semáforo/estacionamento.
 * - Publica overrides {lat, lng, heading, speed, is_running, address}
 *   via `subscribeSim` — nada é gravado no banco, 100% client-side.
 * - O hook `useFleetLive` faz merge: veículos com override são
 *   substituídos, os demais preservam a telemetria do banco.
 *
 * Fácil de desligar: basta setar `DEMO_MODE = false` em
 * `src/lib/demo/config.ts` que o módulo se torna no-op.
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

/** Pares origem→destino plausíveis. Orlando é maioria; 2 pares em Miami. */
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

/** Decodifica polyline no formato do Google (algoritmo padrão). */
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
    // Preferir path detalhado (steps) se disponível — mais fiel ao traçado.
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
  parkedUntil: number;
  currentMph: number;
  targetMph: number;
  nextTargetSwitchAt: number;
  /** timestamp em que fica "estacionado" no final antes de reverter */
  finalParkUntil: number;
};

const overrides = new Map<string, SimOverride>();
const listeners = new Set<() => void>();
const runners: Runner[] = [];
let initialized = false;
let rafId: number | null = null;
let lastFrameTs = 0;
let lastNotifyTs = 0;

function notifyThrottled(now: number) {
  if (now - lastNotifyTs < 250) return; // ~4Hz é suficiente para animação suave via CSS/marker
  lastNotifyTs = now;
  listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
}

function commitPosition(r: Runner, now: number) {
  const p = Math.max(0, Math.min(r.totalDist, r.progressM));
  // busca binária pelo segmento
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
  const parked = now < r.parkedUntil || now < r.finalParkUntil;
  overrides.set(r.vehicleId, {
    lat,
    lng,
    heading,
    speed: parked ? 0 : Math.max(0, Math.round(r.currentMph)),
    is_running: !parked,
    address: r.route.label,
    reported_at: new Date(now).toISOString(),
  });
}

function stepRunner(r: Runner, dtMs: number, now: number) {
  if (now < r.finalParkUntil || now < r.parkedUntil) {
    // ao terminar a parada final, inverte sentido
    if (now >= r.finalParkUntil && r.finalParkUntil > 0) {
      r.finalParkUntil = 0;
      r.direction = r.direction === 1 ? -1 : 1;
      r.currentMph = 0;
      r.targetMph = r.route.targetSpeed * (0.85 + Math.random() * 0.3);
    }
    if (now >= r.parkedUntil) r.currentMph = Math.max(0, r.currentMph - 5);
    commitPosition(r, now);
    return;
  }
  // Trocar alvo de velocidade a cada 6-12s para dar variação natural.
  if (now >= r.nextTargetSwitchAt) {
    r.targetMph = r.route.targetSpeed * (0.75 + Math.random() * 0.4);
    r.nextTargetSwitchAt = now + 6000 + Math.random() * 6000;
  }
  // Chance rara de parar (semáforo).
  if (Math.random() < 0.0015) {
    r.parkedUntil = now + 4000 + Math.random() * 6000;
    r.targetMph = 0;
  }
  // Ease atual → alvo
  r.currentMph += (r.targetMph - r.currentMph) * Math.min(1, dtMs / 1400);
  const mps = r.currentMph * 0.44704;
  r.progressM += mps * (dtMs / 1000) * r.direction;
  if (r.progressM >= r.totalDist) {
    r.progressM = r.totalDist;
    r.finalParkUntil = now + 60_000 + Math.random() * 120_000; // 1-3 min "estacionado"
    r.currentMph = 0;
  } else if (r.progressM <= 0) {
    r.progressM = 0;
    r.finalParkUntil = now + 60_000 + Math.random() * 120_000;
    r.currentMph = 0;
  }
  commitPosition(r, now);
}

function loop(ts: number) {
  const dtMs = lastFrameTs ? Math.min(500, ts - lastFrameTs) : 16;
  lastFrameTs = ts;
  const now = Date.now();
  for (const r of runners) stepRunner(r, dtMs, now);
  notifyThrottled(now);
  rafId = window.requestAnimationFrame(loop);
}

/** Retorna override atual do veículo, se houver. */
export function getSimOverride(vehicleId: string): SimOverride | undefined {
  return overrides.get(vehicleId);
}

/** IDs sob controle da simulação (para o hook decidir onde aplicar merge). */
export function getSimVehicleIds(): Set<string> {
  return new Set(overrides.keys());
}

/** Assinatura de atualizações. Retorna função de unsubscribe. */
export function subscribeSim(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * Inicializa a simulação com a lista atual de veículos. Idempotente:
 * chamar múltiplas vezes é seguro (só executa na primeira).
 */
export async function initLiveSimulation(
  vehicles: { vehicle_id: string; name?: string | null }[],
  options?: { eligibleIds?: string[] },
): Promise<void> {
  if (!DEMO_MODE || initialized || typeof window === "undefined") return;
  if (!vehicles || vehicles.length === 0) return;

  // Coerência com as reservas: só veículos com booking ativo hoje podem se
  // mover. Se a lista de elegíveis ainda não chegou, aguarda uma próxima
  // chamada (initialized permanece false).
  const eligible = options?.eligibleIds;
  if (!eligible || eligible.length === 0) return;
  const eligibleSet = new Set(eligible);

  initialized = true;
  loadCache();

  let google: any;
  try {
    google = await loadGoogleMaps();
  } catch {
    initialized = false; // permite retry se o mapa carregar depois
    return;
  }
  if (!google?.maps?.DirectionsService) {
    initialized = false;
    return;
  }
  const ds = new google.maps.DirectionsService();

  // 5-8 veículos aleatórios por sessão, restrito à frota rodando.
  const count = 5 + Math.floor(Math.random() * 4);
  const pool = [...vehicles].filter((v) => !!v.vehicle_id && eligibleSet.has(v.vehicle_id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, Math.min(count, pool.length));

  const shuffledRoutes = [...ROUTES];
  for (let i = shuffledRoutes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRoutes[i], shuffledRoutes[j]] = [shuffledRoutes[j], shuffledRoutes[i]];
  }

  const now = Date.now();
  // Sequencial com pequeno delay entre requests para respeitar quota.
  for (let i = 0; i < chosen.length; i++) {
    const veh = chosen[i];
    const route = shuffledRoutes[i % shuffledRoutes.length];
    const rc = await fetchRoute(ds, route);
    if (!rc) continue;
    const startProgress = Math.random() * rc.totalDist * 0.8;
    const runner: Runner = {
      vehicleId: veh.vehicle_id,
      route,
      path: rc.path,
      cumDist: rc.cumDist,
      totalDist: rc.totalDist,
      progressM: startProgress,
      direction: Math.random() < 0.5 ? 1 : -1,
      parkedUntil: 0,
      currentMph: route.targetSpeed * (0.6 + Math.random() * 0.4),
      targetMph: route.targetSpeed,
      nextTargetSwitchAt: now + 3000 + Math.random() * 6000,
      finalParkUntil: 0,
    };
    runners.push(runner);
    commitPosition(runner, now);
    // Emite override inicial imediatamente para não esperar 1º frame.
    listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
    // Rate-limit gentil entre requests (só quando ainda vamos buscar mais).
    if (i < chosen.length - 1 && !routeCache.has(shuffledRoutes[(i + 1) % shuffledRoutes.length].id)) {
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  if (runners.length === 0) {
    initialized = false;
    return;
  }
  rafId = window.requestAnimationFrame(loop);
}

/** Para a simulação (útil em hot-reload/testes). */
export function stopLiveSimulation(): void {
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  runners.length = 0;
  overrides.clear();
  initialized = false;
}
