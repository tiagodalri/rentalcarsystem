import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useTripTrail, speedBandColor, type TrailPoint } from "@/hooks/useTripTrail";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { getCoverImage } from "@/data/vehicleImages";
import { supabase } from "@/integrations/supabase/client";
import { useNwsAlerts, nwsSeverityColor } from "@/hooks/useNwsAlerts";
import { useVehicleEvents } from "@/hooks/useVehicleEvents";
import { type MapLayers, DEFAULT_LAYERS } from "@/components/admin/live/MapControlsPanel";
import { DEMO_MODE } from "@/lib/demo/config";
import { LeafletFleetMapFallback } from "@/components/admin/LeafletFleetMapFallback";

// --- Dark theme for Google Maps that matches Sua Marca admin (off-black) ---
const DARK_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0f0f10" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f10" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a8a" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#101317" }] },
];

/**
 * Modern "puck"-style fleet marker. Vector SVG, retina-crisp at any zoom.
 * - Drop shadow for subtle 3D elevation
 * - White border (gold if selected)
 * - Status color (moving=green, idle=amber, parked=gray)
 * - Directional cone pointing to heading (only when moving)
 * - Translucent outer halo (only when moving) for the "alive" feel
 * - Tiny top-down car silhouette inside the puck
 */
function puckSvg(color: string, selected: boolean, headingDeg: number, moving: boolean, logoDataUri: string | null): any {
  const displaySize = selected ? 60 : 50;
  const h = ((headingDeg % 360) + 360) % 360;
  const ringStroke = selected ? "#D4AF37" : color;
  const ringWidth = selected ? 3.4 : 2.8;
  const haloOpacity = moving ? 0.32 : 0;
  const cone = moving
    ? `<g transform="rotate(${h} 22 22)">
         <path d="M22 1.2 L29.8 11 L22 8.2 L14.2 11 Z" fill="${color}" stroke="#0a0a0a" stroke-width="0.5" stroke-linejoin="round" opacity="0.98" />
       </g>`
    : "";
  // Brand logo inside the white puck. logoDataUri is BASE64-encoded (no %
  // characters) so it survives the outer encodeURIComponent below without
  // double-encoding corruption that would silently break the marker.
  const inner = logoDataUri
    ? `<image href="${logoDataUri}" x="10" y="10" width="24" height="24" preserveAspectRatio="xMidYMid meet" />`
    : `<circle cx="22" cy="22" r="3.6" fill="${color}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${displaySize}" height="${displaySize}" viewBox="0 0 44 44" shape-rendering="geometricPrecision"><defs><filter id="puckShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.8" stdDeviation="2" flood-color="#000" flood-opacity="0.55"/></filter></defs><circle cx="22" cy="22" r="19" fill="${color}" opacity="${haloOpacity}" />${cone}<g filter="url(#puckShadow)"><circle cx="22" cy="22" r="14" fill="#ffffff" stroke="${ringStroke}" stroke-width="${ringWidth}" /></g>${inner}</svg>`;
  const g = (window as any).google;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: g?.maps?.Size ? new g.maps.Size(displaySize, displaySize) : ({ width: displaySize, height: displaySize } as any),
    anchor: g?.maps?.Point ? new g.maps.Point(displaySize / 2, displaySize / 2) : ({ x: displaySize / 2, y: displaySize / 2 } as any),
  };
}

const puckIconCache = new Map<string, any>();
function puckIconKey(color: string, selected: boolean, headingDeg: number, moving: boolean, logoDataUri: string | null): string {
  const headingBucket = moving ? Math.round(headingDeg / 6) * 6 : 0;
  return `${color}|${selected ? "S" : "_"}|${moving ? "M" : "_"}|${headingBucket}|${logoDataUri ?? "no-logo"}`;
}
function getPuckIcon(color: string, selected: boolean, headingDeg: number, moving: boolean, logoDataUri: string | null): any {
  const key = puckIconKey(color, selected, headingDeg, moving, logoDataUri);
  const cached = puckIconCache.get(key);
  if (cached) return cached;
  const headingBucket = moving ? Math.round(headingDeg / 6) * 6 : 0;
  const icon = puckSvg(color, selected, headingBucket, moving, logoDataUri);
  if (puckIconCache.size > 700) puckIconCache.clear();
  puckIconCache.set(key, icon);
  return icon;
}

// --- Brand logo resolution (car-logos-dataset on GitHub raw, CORS-enabled).
// Returns a base64 PNG data URI safe to embed inside another encoded SVG.
const BRAND_SLUGS: Record<string, string> = {
  porsche: "porsche",
  chevrolet: "chevrolet",
  corvette: "chevrolet",
  audi: "audi",
  mercedes: "mercedes-benz",
  "mercedes-benz": "mercedes-benz",
  ford: "ford",
  mustang: "ford",
  volkswagen: "volkswagen",
  vw: "volkswagen",
  "t-cross": "volkswagen",
  lexus: "lexus",
  bmw: "bmw",
  kia: "kia",
  chrysler: "chrysler",
  jeep: "jeep",
  nissan: "nissan",
  cadillac: "cadillac",
  dodge: "dodge",
  mitsubishi: "mitsubishi",
  volvo: "volvo",
  toyota: "toyota",
  honda: "honda",
  hyundai: "hyundai",
  tesla: "tesla",
  fiat: "fiat",
  subaru: "subaru",
  mazda: "mazda",
};
function brandSlugFromName(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const tokens = lower.split(/[\s]+/);
  const candidates = [tokens[0], tokens.slice(0, 2).join(" "), tokens.slice(0, 2).join("-")];
  for (const c of candidates) {
    if (c && BRAND_SLUGS[c]) return BRAND_SLUGS[c];
  }
  return null;
}
const brandLogoCache = new Map<string, Promise<string | null>>();
function loadBrandLogo(slug: string): Promise<string | null> {
  const cached = brandLogoCache.get(slug);
  if (cached) return cached;
  const url = `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`;
  const p = fetch(url)
    .then(async (r) => {
      if (!r.ok) return null;
      const blob = await r.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          resolve(typeof result === "string" ? result : null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => null);
  brandLogoCache.set(slug, p);
  return p;
}


function carvatarSvg(imageUrl: string, color: string, selected: boolean): any {
  const size = selected ? 56 : 44;
  // Use a foreignObject-free pure SVG ring + image via xlink:href
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 56 56">
          <defs>
            <clipPath id="c"><circle cx="28" cy="28" r="20"/></clipPath>
            <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.4"/>
            </filter>
          </defs>
          <circle cx="28" cy="28" r="23" fill="#ffffff" stroke="${selected ? "#D4AF37" : color}" stroke-width="${selected ? 3.5 : 2.5}" filter="url(#s)"/>
          <image href="${imageUrl}" xlink:href="${imageUrl}" x="8" y="8" width="40" height="40" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="44" cy="44" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"/>
        </svg>`
      ),
    scaledSize: { width: size, height: size } as any,
    anchor: { x: size / 2, y: size / 2 } as any,
  };
}

function eventEmoji(type: string): { color: string; label: string } {
  const t = type.toLowerCase();
  if (t.includes("hardbrak") || t.includes("hard_brak") || t.includes("brak"))
    return { color: "#ef4444", label: "B" };
  if (t.includes("accel")) return { color: "#22c55e", label: "A" };
  if (t.includes("speed")) return { color: "#dc2626", label: "S" };
  if (t.includes("idle")) return { color: "#f59e0b", label: "I" };
  if (t.includes("trip_start") || t.includes("start")) return { color: "#22c55e", label: "▶" };
  if (t.includes("trip_end") || t.includes("stop") || t.includes("end")) return { color: "#6b7280", label: "■" };
  return { color: "#3b82f6", label: "•" };
}

function eventMarkerSvg(color: string, label: string): any {
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="9" fill="${color}" stroke="#fff" stroke-width="2"/>
          <text x="11" y="14.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#fff">${label}</text>
        </svg>`
      ),
    scaledSize: { width: 22, height: 22 } as any,
    anchor: { x: 11, y: 11 } as any,
  };
}

function statusColor(status: LiveVehicle["status"]) {
  return status === "moving" ? "#22c55e" : status === "idle" ? "#f59e0b" : "#6b7280";
}

function esc(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderPlaceCard(place: any, photoUrl: string | null): string {
  const name = esc(place?.displayName?.text ?? "Local");
  const address = esc(place?.formattedAddress ?? "");
  const phone = esc(place?.internationalPhoneNumber ?? place?.nationalPhoneNumber ?? "");
  const rating = place?.rating ? Number(place.rating).toFixed(1) : null;
  const count = place?.userRatingCount ? `(${place.userRatingCount.toLocaleString("pt-BR")})` : "";
  const website = place?.websiteUri as string | undefined;
  const gmaps = place?.googleMapsUri as string | undefined;
  const summary = esc(place?.editorialSummary?.text ?? "");
  const openNow = place?.currentOpeningHours?.openNow;
  const hours: string[] = place?.regularOpeningHours?.weekdayDescriptions ?? [];
  const types: string[] = place?.types ?? [];
  const typeLabel = esc((types[0] ?? "").replace(/_/g, " "));

  const photo = photoUrl
    ? `<img src="${esc(photoUrl)}" alt="${name}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;display:block" />`
    : "";

  const ratingHtml = rating
    ? `<div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#111">
         <b>${rating}</b>
         <span style="color:#f59e0b">★</span>
         <span style="color:#6b7280">${count}</span>
       </div>`
    : "";

  const openHtml = openNow !== undefined
    ? `<span style="font-size:11px;font-weight:600;color:${openNow ? "#16a34a" : "#dc2626"}">${openNow ? "Aberto agora" : "Fechado"}</span>`
    : "";

  const hoursHtml = hours.length
    ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:#374151;font-weight:600">Horário de funcionamento</summary>
        <div style="margin-top:4px;font-size:11px;color:#4b5563;line-height:1.5">${hours.map(esc).join("<br/>")}</div>
       </details>`
    : "";

  const phoneHtml = phone
    ? `<a href="tel:${phone}" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1d4ed8;text-decoration:none;margin-top:4px">📞 ${phone}</a>`
    : "";

  const websiteHtml = website
    ? `<a href="${esc(website)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1d4ed8;text-decoration:none;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🌐 ${esc(website.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>`
    : "";

  const gmapsHtml = gmaps
    ? `<a href="${esc(gmaps)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;font-size:11px;font-weight:700;color:#fff;background:#1a73e8;padding:6px 10px;border-radius:6px;text-decoration:none">Ver no Google Maps</a>`
    : "";

  return `
    <div style="font-family:'Inter',sans-serif;width:280px;color:#111;overflow:hidden">
      ${photo}
      <div style="padding:10px 12px 12px">
        <div style="font-weight:700;font-size:14px;line-height:1.3">${name}</div>
        ${typeLabel ? `<div style="font-size:11px;color:#6b7280;text-transform:capitalize;margin-top:2px">${typeLabel}</div>` : ""}
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          ${ratingHtml}
          ${openHtml}
        </div>
        ${summary ? `<div style="font-size:12px;color:#374151;margin-top:6px;line-height:1.4">${summary}</div>` : ""}
        ${address ? `<div style="font-size:12px;color:#4b5563;margin-top:8px;line-height:1.4">${address}</div>` : ""}
        ${phoneHtml}
        ${websiteHtml}
        ${hoursHtml}
        ${gmapsHtml}
      </div>
    </div>`;
}

type Props = {
  vehicles: LiveVehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  layers?: MapLayers;
};

// --- Smooth tween model -----------------------------------------------------
// Each vehicle keeps the last drawn position plus a "tween" describing the
// animation in progress towards the latest received fix. Each new webhook
// retargets the tween smoothly from the current displayed position — no
// teleports, no dependency on having a "future" buffered point.
type Tween = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startMs: number;   // performance.now() when tween started
  durationMs: number;
};
type VehicleState = {
  tween: Tween | null;
  lastReportedMs: number;
  status: LiveVehicle["status"];
  speed: number;            // mph (latest)
  /** Last drawn heading in degrees, smoothly lerped */
  drawnHeading: number;
  /** Target heading from real movement A->B */
  targetHeading: number;
  /** Currently displayed lat/lng */
  displayLat: number;
  displayLng: number;
  /** Avoid forcing Google Maps to relayout markers every animation frame */
  positionDirty: boolean;
  /** Icon cache key — avoid setIcon every frame */
  iconKey: string;
  selected: boolean;
  brandSlug: string | null;
  logoDataUri: string | null;
};

const TWEEN_MIN_MS = 2500;             // never animate faster than this
const TWEEN_MAX_MS = 40_000;           // cobre gaps longos de webhook sem congelar no meio da rota
const TWEEN_DEFAULT_MS = 22_000;       // default ~ intervalo típico da Bouncie + atraso de entrega
const TWEEN_OVERSHOOT = 1.45;          // mantém o carro em movimento até o próximo fix chegar
const MIN_MOVE_METERS = 4;             // ignore micro-jitter while parked
const MAX_JUMP_METERS = 2_000;         // discard absurd GPS jumps
const HEADING_LERP_PER_FRAME = 0.18;
const HEADING_BUCKET_DEG = 15;         // coarser bucket = fewer setIcon calls
const FOLLOW_PAN_INTERVAL_MS = 800;
const FOLLOW_EDGE_PX = 110;
const FOLLOW_CHECK_EVERY_N_FRAMES = 10; // ~6x/sec instead of every frame
const PROGRAMMATIC_PAN_GUARD_MS = 350;
const PROGRAMMATIC_ZOOM_GUARD_MS = 450;
const FRAME_MIN_INTERVAL_MS = 16;       // ~60fps for buttery marker motion
const ZOOM_OVERLAY_RESTORE_DELAY_MS = 360;

// Linear interpolation keeps the puck at a constant perceived speed. The old
// ease-in/out made it visibly slow down at every fix, which looked like a bug.
function ease(t: number): number {
  return Math.max(0, Math.min(1, t));
}


function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
/** Shortest-path angular interpolation (handles 359→1 wrap) */
function lerpAngle(a: number, b: number, f: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * f + 360) % 360;
}

export function GoogleFleetMap({ vehicles, selectedId, onSelect, onOpen, layers = DEFAULT_LAYERS }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const statesRef = useRef<Map<string, VehicleState>>(new Map());
  const rafRef = useRef<number | null>(null);
  const infoWindowRef = useRef<any>(null);
  const polylineRef = useRef<any[]>([]);
  /** Dynamic 2-vertex polyline that connects the last static trail point to
   *  the marker's animated position. Keeps the rastro tip glued to the icon. */
  const tipPolyRef = useRef<any>(null);
  /** Anchor (last static trail vertex) and color for the dynamic tip segment. */
  const tipAnchorRef = useRef<{ lat: number; lng: number; color: string } | null>(null);
  const trafficLayerRef = useRef<any>(null);
  const nwsShapesRef = useRef<any[]>([]);
  const eventMarkersRef = useRef<any[]>([]);
  const layersRef = useRef<MapLayers>(layers);
  const fittedRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const followRef = useRef<boolean>(false);
  const lastFollowPanRef = useRef<number>(0);
  const programmaticPanAtRef = useRef<number>(0);
  const programmaticZoomAtRef = useRef<number>(0);
  /** True while user is actively dragging/zooming — we skip marker work to keep gestures buttery. */
  const interactingRef = useRef<boolean>(false);
  const zoomResumeTimerRef = useRef<number | null>(null);
  const zoomHiddenOverlaysRef = useRef<boolean>(false);
  const trafficHiddenForZoomRef = useRef<boolean>(false);
  const lastFrameMsRef = useRef<number>(0);
  const followFrameCounterRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean>(false);
  const [useFallbackMap, setUseFallbackMap] = useState(false);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { followRef.current = following; }, [following]);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  useEffect(() => {
    if (!DEMO_MODE) return;
    const handleAuthFailure = () => setUseFallbackMap(true);
    window.addEventListener("google-maps-auth-failure", handleAuthFailure);
    return () => window.removeEventListener("google-maps-auth-failure", handleAuthFailure);
  }, []);

  const { points: trail } = useTripTrail(selectedId, 24);
  const { data: nwsAlerts = [] } = useNwsAlerts("FL", layers.nwsAlerts);
  const { data: events = [] } = useVehicleEvents(selectedId, 7, layers.tripEvents && !!selectedId);

  const restoreZoomPerformanceMode = useCallback(() => {
    if (zoomResumeTimerRef.current != null) {
      window.clearTimeout(zoomResumeTimerRef.current);
      zoomResumeTimerRef.current = null;
    }
    const map = mapRef.current;
    if (map && zoomHiddenOverlaysRef.current) {
      for (const p of polylineRef.current) p.setMap(map);
      if (tipPolyRef.current) tipPolyRef.current.setMap(map);
      for (const s of nwsShapesRef.current) s.setMap(map);
      for (const m of eventMarkersRef.current) m.setMap(map);
      if (layersRef.current.traffic && trafficLayerRef.current) {
        trafficLayerRef.current.setMap(map);
      }
    }
    trafficHiddenForZoomRef.current = false;
    zoomHiddenOverlaysRef.current = false;
    interactingRef.current = false;
  }, []);

  const beginZoomPerformanceMode = useCallback(() => {
    interactingRef.current = true;
    if (zoomResumeTimerRef.current != null) window.clearTimeout(zoomResumeTimerRef.current);
    const map = mapRef.current;
    if (map && !zoomHiddenOverlaysRef.current) {
      for (const p of polylineRef.current) p.setMap(null);
      if (tipPolyRef.current) tipPolyRef.current.setMap(null);
      for (const s of nwsShapesRef.current) s.setMap(null);
      for (const m of eventMarkersRef.current) m.setMap(null);
      if (layersRef.current.traffic && trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
        trafficHiddenForZoomRef.current = true;
      }
      zoomHiddenOverlaysRef.current = true;
    }
    zoomResumeTimerRef.current = window.setTimeout(restoreZoomPerformanceMode, ZOOM_OVERLAY_RESTORE_DELAY_MS);
  }, [restoreZoomPerformanceMode]);

  // 1. Load Google Maps and create map instance
  useEffect(() => {
    let cancelled = false;
    // Clear any residual Google error overlay ("Ops! Algo deu errado…") that
    // Google may have injected in a previous failed load, before re-init.
    if (containerRef.current) containerRef.current.innerHTML = "";
    loadGoogleMaps()
      .then((google) => {
        if (DEMO_MODE && (!google?.maps?.Map || (window as any).__gmapsAuthFailed)) {
          setUseFallbackMap(true);
          return;
        }
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 28.5, lng: -81.4 },
          zoom: 9,
          mapTypeId:
            layers.mapType === "roadmap" ? "roadmap" : "hybrid",
          tilt: layers.mapType === "satellite3d" ? 45 : 0,
          // Lock viewport to North/Central America + Caribbean (Florida-centric).
          // Vehicles live in Florida, so we don't waste tile bandwidth elsewhere.
          restriction: {
            latLngBounds: { north: 50, south: 7, east: -60, west: -125 },
            strictBounds: false,
          },
          minZoom: 5,
          maxZoom: 21,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: true,
          rotateControlOptions: { position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM },
          backgroundColor: "#e5e3df",
          gestureHandling: "greedy",
          scrollwheel: true,
          // Smooth wheel/pinch zoom. Heavy Sua Marca overlays are paused during the
          // gesture below, so the map can animate continuously instead of
          // snapping between integer zoom levels.
          isFractionalZoomEnabled: true,
          clickableIcons: true,
          keyboardShortcuts: true,
          draggableCursor: "grab",
          draggingCursor: "grabbing",
        });
        containerRef.current.style.touchAction = "none";
        containerRef.current.style.overscrollBehavior = "contain";
        // NOTE: NÃO usar `contain: size` — limita o compositor do Google Maps
        // e causa stutter no zoom/pan. `layout paint` é suficiente.
        containerRef.current.style.contain = "layout paint";
        infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: false, maxWidth: 320 });

        // ===== Custom "minha localização" control (discrete, next to zoom) =====
        const meBtn = document.createElement("button");
        meBtn.type = "button";
        meBtn.title = "Centralizar na minha localização";
        meBtn.setAttribute("aria-label", "Centralizar na minha localização");
        meBtn.style.cssText = [
          "margin:0 10px 10px 0", "width:40px", "height:40px",
          "border-radius:2px", "border:none", "cursor:pointer",
          "background:#fff", "color:#666",
          "box-shadow:0 1px 4px rgba(0,0,0,0.3)",
          "display:flex", "align-items:center", "justify-content:center",
          "transition:background-color .15s",
        ].join(";");
        meBtn.onmouseenter = () => { meBtn.style.background = "#f5f5f5"; };
        meBtn.onmouseleave = () => { meBtn.style.background = "#fff"; };
        meBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>`;

        let myLocMarker: any = null;
        let myLocAccuracy: any = null;
        let watchId: number | null = null;
        let firstFix = true;
        let followMe = true;

        const setBtnState = (state: "idle" | "locating" | "active" | "error", title?: string) => {
          const colors: Record<string, string> = { idle: "#666", locating: "#D4AF37", active: "#1a73e8", error: "#ef4444" };
          meBtn.style.color = colors[state];
          if (title) meBtn.title = title;
        };

        const stopTracking = () => {
          if (watchId != null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          myLocMarker?.setMap(null); myLocMarker = null;
          myLocAccuracy?.setMap(null); myLocAccuracy = null;
          setBtnState("idle", "Centralizar na minha localização");
        };

        // Stop following when user drags the map (Google Maps behavior)
        mapRef.current.addListener("dragstart", () => {
          if (watchId != null) {
            followMe = false;
            setBtnState("idle", "Voltar a seguir minha localização");
          }
        });

        meBtn.onclick = () => {
          if (!navigator.geolocation) {
            setBtnState("error", "Geolocalização não suportada");
            return;
          }
          // 3rd click (active + not following) → re-engage follow
          if (watchId != null && !followMe) {
            followMe = true;
            setBtnState("active", "Seguindo sua localização (toque pra parar)");
            if (myLocMarker) mapRef.current.panTo(myLocMarker.getPosition());
            return;
          }
          // 2nd click while tracking → stop
          if (watchId != null) { stopTracking(); return; }

          // First click → start tracking
          setBtnState("locating", "Obtendo sua localização…");
          firstFix = true;
          followMe = true;
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              const { latitude, longitude, accuracy, heading } = pos.coords;
              const center = { lat: latitude, lng: longitude };
              if (!myLocMarker) {
                myLocMarker = new google.maps.Marker({
                  map: mapRef.current,
                  position: center,
                  zIndex: 9999,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#1a73e8",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 3,
                  },
                  title: "Você está aqui",
                  optimized: false,
                });
                myLocAccuracy = new google.maps.Circle({
                  map: mapRef.current,
                  center,
                  radius: Math.max(20, accuracy || 50),
                  strokeColor: "#1a73e8",
                  strokeOpacity: 0.4,
                  strokeWeight: 1,
                  fillColor: "#1a73e8",
                  fillOpacity: 0.12,
                  clickable: false,
                });
              } else {
                myLocMarker.setPosition(center);
                myLocAccuracy.setCenter(center);
                myLocAccuracy.setRadius(Math.max(20, accuracy || 50));
              }
              if (firstFix) {
                firstFix = false;
                mapRef.current.panTo(center);
                if ((mapRef.current.getZoom() ?? 9) < 14) {
                  programmaticZoomAtRef.current = performance.now();
                  mapRef.current.setZoom(15);
                }
                setBtnState("active", "Seguindo sua localização (toque pra parar)");
              } else if (followMe) {
                mapRef.current.panTo(center);
              }
              void heading; // available for future arrow rotation
            },
            (err) => {
              const denied = err.code === err.PERMISSION_DENIED;
              setBtnState("error", denied ? "Permissão de localização negada" : "Não foi possível obter sua localização");
              if (denied) stopTracking();
              else setTimeout(() => { if (watchId != null) setBtnState("locating", "Buscando sinal…"); }, 2500);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
          );
        };
        mapRef.current.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(meBtn);



        // Intercept POI clicks to render a rich Google Places card
        mapRef.current.addListener("click", async (e: any) => {
          if (!e?.placeId) return;
          e.stop?.();
          const placeId = e.placeId as string;
          const latLng = e.latLng;
          infoWindowRef.current.setContent(
            `<div style="font-family:'Inter',sans-serif;padding:8px 12px;font-size:12px;color:#6b7280">Carregando informações…</div>`
          );
          infoWindowRef.current.setPosition(latLng);
          infoWindowRef.current.open(mapRef.current);
          try {
            const { data, error: fnErr } = await supabase.functions.invoke("place-details", {
              body: { placeId },
            });
            if (fnErr || !data?.place) throw fnErr || new Error("no data");
            infoWindowRef.current.setContent(renderPlaceCard(data.place, data.photoUrl));
          } catch (err) {
            console.error("[place-details]", err);
            infoWindowRef.current.setContent(
              `<div style="font-family:'Inter',sans-serif;padding:8px 12px;font-size:12px;color:#ef4444">Não foi possível carregar detalhes do local.</div>`
            );
          }
        });
        // Track active user interaction so the rAF loop can pause heavy marker
        // work. During zoom we also hide heavy overlays temporarily; Google
        // Maps can animate tiles much smoother when it is not reprojecting
        // trails/polygons/event markers at every zoom step.
        const beginInteract = () => { interactingRef.current = true; };
        const endInteract = () => {
          // small delay so the inertia/zoom animation finishes cleanly
          window.setTimeout(() => { interactingRef.current = false; }, 120);
        };
        mapRef.current.addListener("dragstart", beginInteract);
        mapRef.current.addListener("dragend", endInteract);
        mapRef.current.addListener("zoom_changed", beginZoomPerformanceMode);
        setReady(true);
      })
      .catch((e) => {
        console.error("[GoogleFleetMap]", e);
        if (DEMO_MODE) {
          setUseFallbackMap(true);
          return;
        }
        setError(e.message || "Falha ao carregar Google Maps");
      });
    return () => {
      cancelled = true;
      if (zoomResumeTimerRef.current != null) window.clearTimeout(zoomResumeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch base map type + 3D tilt
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const m = mapRef.current;
    m.setMapTypeId(layers.mapType === "roadmap" ? "roadmap" : "hybrid");
    if (layers.mapType === "satellite3d") {
      // 45° aerial imagery (only renders where Google has it — most US/FL cities do).
      // Auto-zoom to a level where 45° tiles exist if user is too far out.
      if ((m.getZoom() ?? 0) < 17) m.setZoom(18);
      m.setTilt(45);
    } else {
      m.setTilt(0);
      m.setHeading(0);
    }
  }, [layers.mapType, ready]);

  // Traffic layer toggle
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    if (layers.traffic) {
      if (!trafficLayerRef.current) trafficLayerRef.current = new google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(zoomHiddenOverlaysRef.current ? null : mapRef.current);
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }
  }, [layers.traffic, ready]);

  // 2. Sync vehicle updates → push into per-vehicle buffer; create/remove markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;
    const existing = markersRef.current;
    const states = statesRef.current;
    const seen = new Set<string>();

    for (const v of vehicles) {
      if (v.lat === null || v.lng === null) continue;
      seen.add(v.vehicle_id);
      const isSelected = v.vehicle_id === selectedId;
      const reportedAtMs = v.reported_at ? new Date(v.reported_at).getTime() : Date.now();

      let st = states.get(v.vehicle_id);
      if (!st) {
        const slug = brandSlugFromName(v.name);
        st = {
          tween: null,
          lastReportedMs: reportedAtMs,
          status: v.status,
          speed: v.speed ?? 0,
          drawnHeading: v.heading ?? 0,
          targetHeading: v.heading ?? 0,
          displayLat: v.lat,
          displayLng: v.lng,
          positionDirty: true,
          iconKey: "",
          selected: isSelected,
          brandSlug: slug,
          logoDataUri: null,
        };
        states.set(v.vehicle_id, st);
        if (slug) {
          loadBrandLogo(slug).then((uri) => {
            if (uri && states.get(v.vehicle_id)) {
              states.get(v.vehicle_id)!.logoDataUri = uri;
              states.get(v.vehicle_id)!.iconKey = ""; // force redraw on next tick
            }
          });
        }
      } else {
        const isNewFix = reportedAtMs !== st.lastReportedMs;
        if (isNewFix) {
          const from = { lat: st.displayLat, lng: st.displayLng };
          const to = { lat: v.lat, lng: v.lng };
          const d = haversineM(from, to);
          const speedMph = v.speed ?? 0;
          const stationary = speedMph < 1 && d < MIN_MOVE_METERS;
          const absurdJump = d > MAX_JUMP_METERS && (reportedAtMs - st.lastReportedMs) < 10_000;
          if (absurdJump) {
            // discard
          } else if (stationary) {
            // snap silently — no animation
              st.displayLat = to.lat;
              st.displayLng = to.lng;
              st.positionDirty = true;
            st.tween = null;
          } else {
            // Animate over the real interval between fixes (clamped), or use
            // distance/speed if interval is unknown.
            const intervalMs = reportedAtMs - st.lastReportedMs;
            let duration = intervalMs > 0 ? intervalMs * TWEEN_OVERSHOOT : TWEEN_DEFAULT_MS;
            duration = Math.min(TWEEN_MAX_MS, Math.max(TWEEN_MIN_MS, duration));
            st.tween = {
              fromLat: from.lat,
              fromLng: from.lng,
              toLat: to.lat,
              toLng: to.lng,
              startMs: performance.now(),
              durationMs: duration,
            };
            if (d >= MIN_MOVE_METERS) {
              st.targetHeading = bearingDeg(from, to);
            } else if (v.heading != null) {
              st.targetHeading = v.heading;
            }
          }
          st.lastReportedMs = reportedAtMs;
        }
        st.status = v.status;
        st.speed = v.speed ?? 0;
        st.selected = isSelected;
      }


      let marker = existing.get(v.vehicle_id);
      if (!marker) {
        const initialIcon = getPuckIcon(
          statusColor(v.status),
          isSelected,
          st.drawnHeading,
          v.status === "moving",
          st.logoDataUri,
        );
        marker = new google.maps.Marker({
          map,
          position: { lat: st.displayLat, lng: st.displayLng },
          icon: initialIcon,
          title: v.name,
          zIndex: isSelected ? 999 : 1,
          // PERF: veículos parados/idle usam o renderer canvas otimizado do
          // Google (1 canvas para todos os markers). Só veículos em movimento
          // ficam como DOM (optimized:false) porque o ícone muda a cada frame
          // de rotação — o canvas pode perder o sprite nesse caso.
          optimized: v.status !== "moving",
        });
        marker.addListener("click", () => {
          onSelect(v.vehicle_id);
        });
        existing.set(v.vehicle_id, marker);
      } else {
        marker.setZIndex(isSelected ? 999 : 1);
        // icon is refreshed inside the rAF loop when heading/status/selection change
      }
    }
    for (const [id, m] of existing) {
      if (!seen.has(id)) {
        m.setMap(null);
        existing.delete(id);
        states.delete(id);
      }
    }

    if (!fittedRef.current && seen.size > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const v of vehicles) {
        if (v.lat !== null && v.lng !== null) {
          bounds.extend({ lat: v.lat, lng: v.lng });
        }
      }
      map.fitBounds(bounds, 80);
      fittedRef.current = true;
    }
  }, [vehicles, selectedId, ready, onSelect]);

  // 2b. rAF loop — tween-based interpolation + smooth rotation + follow cam
  useEffect(() => {
    if (!ready) return;
    const states = statesRef.current;
    const markers = markersRef.current;

    const tick = () => {
      const now = performance.now();

      // Throttle to ~30fps. Skip ALL work while the user is mid-gesture
      // (drag/zoom) — Google Maps owns the main thread during gestures, and
      // any setPosition/setIcon we issue piles up and shows up as "lag".
      if (interactingRef.current || now - lastFrameMsRef.current < FRAME_MIN_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameMsRef.current = now;

      for (const [id, st] of states) {
        const marker = markers.get(id);
        if (!marker) continue;

        // Advance tween if one is active
        if (st.tween) {
          const tw = st.tween;
          const raw = (now - tw.startMs) / tw.durationMs;
          if (raw >= 1) {
            st.displayLat = tw.toLat;
            st.displayLng = tw.toLng;
            st.positionDirty = true;
            st.tween = null;
          } else {
            const f = ease(Math.max(0, raw));
            st.displayLat = tw.fromLat + (tw.toLat - tw.fromLat) * f;
            st.displayLng = tw.fromLng + (tw.toLng - tw.fromLng) * f;
            st.positionDirty = true;
          }
        }

        // Smooth rotation toward target heading (only while moving — otherwise
        // there's nothing to animate and lerping wastes cycles).
        if (st.status === "moving" && Math.abs(((st.targetHeading - st.drawnHeading + 540) % 360) - 180) > 0.5) {
          st.drawnHeading = lerpAngle(st.drawnHeading, st.targetHeading, HEADING_LERP_PER_FRAME);
        }

        if (st.positionDirty) {
          st.positionDirty = false;
          marker.setPosition({ lat: st.displayLat, lng: st.displayLng });
        }

        // Refresh icon only when something visual changed (cheap key compare).
        // Coarser bucket = far fewer setIcon calls during turns.
        const headingBucket = st.status === "moving"
          ? Math.round(st.drawnHeading / HEADING_BUCKET_DEG) * HEADING_BUCKET_DEG
          : 0;
        const movingFlag = st.status === "moving" ? "M" : st.status === "idle" ? "I" : "P";
        const selFlag = st.selected ? "S" : "_";
        const key = `${movingFlag}${selFlag}${headingBucket}${st.logoDataUri ? "L" : "_"}`;
        if (key !== st.iconKey) {
          st.iconKey = key;
          marker.setIcon(
            getPuckIcon(
              statusColor(st.status),
              st.selected,
              st.drawnHeading,
              st.status === "moving",
              st.logoDataUri,
            ),
          );
      }

      // Glue the dynamic rastro tip to the selected vehicle's animated position
      // so the polyline never visually runs ahead of the icon.
      const selIdTip = selectedIdRef.current;
      if (selIdTip && tipPolyRef.current && tipAnchorRef.current) {
        const sel = states.get(selIdTip);
        if (sel) {
          try {
            tipPolyRef.current.setPath([
              { lat: tipAnchorRef.current.lat, lng: tipAnchorRef.current.lng },
              { lat: sel.displayLat, lng: sel.displayLng },
            ]);
          } catch { /* map not ready */ }
        }
      }
      }

      // --- Follow camera (selected vehicle only) ---
      // Heavy projection math — only run every N frames.
      followFrameCounterRef.current = (followFrameCounterRef.current + 1) % FOLLOW_CHECK_EVERY_N_FRAMES;
      const selId = selectedIdRef.current;
      const map = mapRef.current;
      if (followFrameCounterRef.current === 0 && followRef.current && selId && map) {
        const sel = states.get(selId);
        if (sel) {
          const dueByTime = now - lastFollowPanRef.current >= FOLLOW_PAN_INTERVAL_MS;
          let nearEdge = false;
          try {
            const proj = map.getProjection?.();
            const bounds = map.getBounds?.();
            if (proj && bounds) {
              const div = map.getDiv?.() as HTMLElement | undefined;
              if (div) {
                const w = div.clientWidth, h = div.clientHeight;
                const ne = bounds.getNorthEast(), sw = bounds.getSouthWest();
                const scale = Math.pow(2, map.getZoom?.() ?? 12);
                const worldOrigin = proj.fromLatLngToPoint(ne);
                const worldSw = proj.fromLatLngToPoint(sw);
                const worldCar = proj.fromLatLngToPoint(
                  new (window as any).google.maps.LatLng(sel.displayLat, sel.displayLng),
                );
                if (worldOrigin && worldSw && worldCar) {
                  const px = (worldCar.x - worldSw.x) * scale;
                  const py = (worldOrigin.y - worldCar.y) * scale;
                  if (px < FOLLOW_EDGE_PX || py < FOLLOW_EDGE_PX ||
                      px > (w - FOLLOW_EDGE_PX) || py > (h - FOLLOW_EDGE_PX)) {
                    nearEdge = true;
                  }
                }
              }
            }
          } catch { /* projection not ready yet */ }
          if (dueByTime || nearEdge) {
            lastFollowPanRef.current = now;
            programmaticPanAtRef.current = now;
            map.panTo({ lat: sel.displayLat, lng: sel.displayLng });
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ready]);

  // 3. On selection change: enable follow + immediate centre. User-drag turns it off.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    infoWindowRef.current?.close();
    if (!selectedId) {
      setFollowing(false);
      return;
    }
    const map = mapRef.current;
    const st = statesRef.current.get(selectedId);
    const fallback = vehicles.find((x) => x.vehicle_id === selectedId);
    const target =
      st ? { lat: st.displayLat, lng: st.displayLng } :
      (fallback && fallback.lat != null && fallback.lng != null)
        ? { lat: fallback.lat, lng: fallback.lng }
        : null;
    if (target) {
      programmaticPanAtRef.current = performance.now();
      map.panTo(target);
      if (map.getZoom() < 14) {
        programmaticZoomAtRef.current = performance.now();
        map.setZoom(15);
      }
    }
    setFollowing(true);
    lastFollowPanRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  // 3b. Detect user map interaction → turn off follow (unless it's our own pan/zoom)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;
    const stopFollowingFromUser = () => {
      const sincePan = performance.now() - programmaticPanAtRef.current;
      const sinceZoom = performance.now() - programmaticZoomAtRef.current;
      if (sincePan > PROGRAMMATIC_PAN_GUARD_MS && sinceZoom > PROGRAMMATIC_ZOOM_GUARD_MS && followRef.current) {
        setFollowing(false);
      }
    };
    const listeners = [
      map.addListener("dragstart", stopFollowingFromUser),
      map.addListener("zoom_changed", stopFollowingFromUser),
    ];
    return () => listeners.forEach((handler) => google?.maps?.event?.removeListener(handler));
  }, [ready]);

  const recentralize = useCallback(() => {
    const map = mapRef.current;
    const selId = selectedIdRef.current;
    if (!map || !selId) return;
    const st = statesRef.current.get(selId);
    if (!st) return;
    programmaticPanAtRef.current = performance.now();
    lastFollowPanRef.current = performance.now();
    map.panTo({ lat: st.displayLat, lng: st.displayLng });
    setFollowing(true);
  }, []);

  // 4. Trip trail polyline
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    for (const p of polylineRef.current) p.setMap(null);
    polylineRef.current = [];
    if (tipPolyRef.current) { tipPolyRef.current.setMap(null); tipPolyRef.current = null; }
    tipAnchorRef.current = null;
    if (!selectedId || trail.length < 2) return;

    const google = (window as any).google;
    const map = mapRef.current;

    // Static polylines cover everything EXCEPT the last vertex (the live tip).
    // The last segment is drawn dynamically by the rAF loop so its endpoint
    // tracks the marker's animated position — otherwise the rastro visually
    // runs ahead of the icon while the tween catches up.
    const staticEnd = trail.length - 1; // exclusive index for last raw point
    let runStart = 0;
    let runColor = speedBandColor(trail[1].speed);
    const flushRun = (endIdx: number, color: string) => {
      const path: { lat: number; lng: number }[] = [];
      for (let k = runStart; k <= endIdx; k++) path.push({ lat: trail[k].lat, lng: trail[k].lng });
      if (path.length < 2) return;
      const poly = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        clickable: false,
        map: zoomHiddenOverlaysRef.current ? null : map,
      });
      polylineRef.current.push(poly);
    };
    for (let i = 1; i < staticEnd; i++) {
      const c = speedBandColor(trail[i].speed);
      if (c !== runColor) {
        flushRun(i, runColor); // include junction point so colors meet
        runStart = i;
        runColor = c;
      }
    }
    if (staticEnd > runStart) flushRun(staticEnd, runColor);

    // Anchor for the dynamic tip = last static (snapped) vertex.
    const anchor = trail[staticEnd - 1] ?? trail[staticEnd];
    tipAnchorRef.current = {
      lat: anchor.lat,
      lng: anchor.lng,
      color: speedBandColor(trail[staticEnd].speed),
    };
    tipPolyRef.current = new google.maps.Polyline({
      path: [
        { lat: anchor.lat, lng: anchor.lng },
        { lat: trail[staticEnd].lat, lng: trail[staticEnd].lng },
      ],
      geodesic: false,
      strokeColor: tipAnchorRef.current.color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      clickable: false,
      map: zoomHiddenOverlaysRef.current ? null : map,
    });
  }, [trail, selectedId, ready]);





  // 6. NWS Alerts polygons
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    for (const s of nwsShapesRef.current) s.setMap(null);
    nwsShapesRef.current = [];
    if (!layers.nwsAlerts) return;

    const google = (window as any).google;
    const map = mapRef.current;
    for (const a of nwsAlerts) {
      const color = nwsSeverityColor(a.severity);
      try {
        const drawRing = (ring: any[]) => {
          const path = ring.map((p) => ({ lat: p[1], lng: p[0] }));
          const poly = new google.maps.Polygon({
            map: zoomHiddenOverlaysRef.current ? null : map,
            paths: path,
            strokeColor: color,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.15,
            clickable: true,
          });
          poly.addListener("click", (e: any) => {
            infoWindowRef.current?.setContent(
              `<div style="font-family:'Inter',sans-serif;width:260px;padding:10px 12px;color:#111">
                <div style="font-weight:700;font-size:13px;color:${color}">${esc(a.event)}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">Severidade: ${esc(a.severity)}</div>
                <div style="font-size:12px;color:#374151;margin-top:6px;line-height:1.4">${esc(a.headline)}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:6px">${esc(a.area)}</div>
              </div>`
            );
            infoWindowRef.current?.setPosition(e.latLng);
            infoWindowRef.current?.open(map);
          });
          nwsShapesRef.current.push(poly);
        };
        if (a.geometry.type === "Polygon") {
          drawRing(a.geometry.coordinates[0]);
        } else if (a.geometry.type === "MultiPolygon") {
          for (const poly of a.geometry.coordinates) drawRing(poly[0]);
        }
      } catch (e) {
        console.warn("[nws] invalid geometry", a.id, e);
      }
    }
  }, [nwsAlerts, layers.nwsAlerts, ready]);

  // 7. Trip events markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    for (const m of eventMarkersRef.current) m.setMap(null);
    eventMarkersRef.current = [];
    if (!layers.tripEvents || !selectedId) return;

    const google = (window as any).google;
    const map = mapRef.current;
    // Only render meaningful driving events on the map (hard brake, hard
    // accel, speeding, idle, trip start/end). Generic ticks/heartbeats
    // were rendering as evenly-spaced blue dots overlapping the route —
    // they pollute the map and add nothing visual. They still live in the
    // event list/sidebar if needed.
    const MEANINGFUL = /(brak|accel|speed|idle|trip_start|trip_end|\bstart\b|\bend\b|\bstop\b)/i;
    for (const ev of events) {
      if (ev.lat == null || ev.lng == null) continue;
      if (!MEANINGFUL.test(ev.event_type || "")) continue;
      const { color, label } = eventEmoji(ev.event_type);
      const m = new google.maps.Marker({
        map: zoomHiddenOverlaysRef.current ? null : map,
        position: { lat: ev.lat, lng: ev.lng },
        icon: eventMarkerSvg(color, label),
        zIndex: 500,
        optimized: false,
      });
      m.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:'Inter',sans-serif;width:220px;padding:10px 12px;color:#111">
            <div style="font-weight:700;font-size:13px;color:${color};text-transform:capitalize">${esc(ev.event_type.replace(/_/g, " "))}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${new Date(ev.occurred_at).toLocaleString("pt-BR")}</div>
            ${ev.speed_mph != null ? `<div style="font-size:12px;color:#374151;margin-top:4px">Velocidade: <b>${Math.round(Number(ev.speed_mph))} mph</b></div>` : ""}
            ${ev.severity ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">Severidade: ${esc(ev.severity)}</div>` : ""}
          </div>`
        );
        infoWindowRef.current?.setPosition({ lat: ev.lat!, lng: ev.lng! });
        infoWindowRef.current?.open(map);
      });
      eventMarkersRef.current.push(m);
    }
  }, [events, layers.tripEvents, selectedId, ready]);

  if (useFallbackMap) {
    return <LeafletFleetMapFallback vehicles={vehicles} selectedId={selectedId} onSelect={onSelect} onOpen={onOpen} />;
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-card/50 text-sm text-muted-foreground p-6 text-center">
        Não foi possível carregar o Google Maps: {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {ready && selectedId && !following && (
        <button
          onClick={recentralize}
          className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0a0a0a]/90 hover:bg-[#0a0a0a] text-white text-[11px] font-semibold uppercase tracking-wider border border-[#D4AF37]/60 shadow-xl backdrop-blur-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200"
          title="Voltar a seguir o carro selecionado"
        >
          <Crosshair size={13} className="text-[#D4AF37]" />
          Recentralizar
        </button>
      )}
    </div>
  );
}
