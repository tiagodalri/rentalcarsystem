import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useTripTrail, speedBandColor, type TrailPoint } from "@/hooks/useTripTrail";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { getCoverImage } from "@/data/vehicleImages";
import { supabase } from "@/integrations/supabase/client";
import { useGeofences } from "@/hooks/useGeofences";
import { useNwsAlerts, nwsSeverityColor } from "@/hooks/useNwsAlerts";
import { useVehicleEvents } from "@/hooks/useVehicleEvents";
import { type MapLayers, DEFAULT_LAYERS } from "@/components/admin/live/MapControlsPanel";

// --- Dark theme for Google Maps that matches Zeus admin (off-black) ---
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
function puckSvg(color: string, selected: boolean, headingDeg: number, moving: boolean): any {
  // Slightly larger when selected so it pops.
  const size = selected ? 52 : 44;
  const h = ((headingDeg % 360) + 360) % 360;
  const ringStroke = selected ? "#D4AF37" : "#ffffff";
  const ringWidth = selected ? 3 : 2.2;
  const haloOpacity = moving ? 0.22 : 0;
  // Cone shown only when actually moving; rotates with heading.
  const cone = moving
    ? `<g transform="rotate(${h} 22 22)">
         <path d="M22 1 L30 12 L22 9 L14 12 Z" fill="${color}" opacity="0.95" />
       </g>`
    : "";
  // Tiny top-down car silhouette (white), also rotates with heading so it "looks where it goes"
  const carBody = `
    <g transform="rotate(${h} 22 22)" opacity="0.95">
      <rect x="18.5" y="16" width="7" height="12" rx="2" fill="#ffffff" />
      <rect x="19.5" y="17.5" width="5" height="3.2" rx="0.6" fill="${color}" />
      <rect x="19.5" y="22" width="5" height="4" rx="0.6" fill="${color}" opacity="0.6" />
    </g>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
      <defs>
        <filter id="puckShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.42"/>
        </filter>
      </defs>
      <circle cx="22" cy="22" r="19" fill="${color}" opacity="${haloOpacity}" />
      <g filter="url(#puckShadow)">
        <circle cx="22" cy="22" r="12.5" fill="${color}" stroke="${ringStroke}" stroke-width="${ringWidth}" />
      </g>
      ${cone}
      ${carBody}
    </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: { width: size, height: size } as any,
    anchor: { x: size / 2, y: size / 2 } as any,
  };
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

// --- Smooth-motion buffer ---------------------------------------------------
// Each vehicle keeps a buffer of timestamped real positions. We render the car
// always RENDER_DELAY_MS in the past so there's always a "future" point to
// interpolate towards — eliminates jumps, reverses and trembling.
type BufferPoint = { lat: number; lng: number; t: number };
type VehicleState = {
  buffer: BufferPoint[];
  lastReportedMs: number;
  status: LiveVehicle["status"];
  speed: number;            // mph (latest)
  /** Last drawn heading in degrees, smoothly lerped */
  drawnHeading: number;
  /** Target heading from real movement A->B */
  targetHeading: number;
  /** Last displayed lat/lng (used to hold position when no fresh data) */
  displayLat: number;
  displayLng: number;
  /** Icon cache key — avoid setIcon every frame */
  iconKey: string;
  /** Marker is selected (mirrors selectedId for fast access in loop) */
  selected: boolean;
};

const RENDER_DELAY_MS = 4000;          // ~4s "in the past" — sweet spot for fluid playback
const BUFFER_TTL_MS = 10_000;          // drop points older than this past renderTime
const MIN_MOVE_METERS = 5;             // ignore micro-jitter while parked
const MAX_JUMP_METERS = 2_000;         // discard absurd GPS jumps
const HEADING_LERP_PER_FRAME = 0.16;   // smoothness of rotation animation
const FOLLOW_PAN_INTERVAL_MS = 1000;   // recentre at most once per second
const FOLLOW_EDGE_PX = 110;            // recentre early if car nears viewport edge
const PROGRAMMATIC_PAN_GUARD_MS = 350; // ignore our own panTo on dragstart

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
  const trafficLayerRef = useRef<any>(null);
  const geofenceShapesRef = useRef<any[]>([]);
  const nwsShapesRef = useRef<any[]>([]);
  const eventMarkersRef = useRef<any[]>([]);
  const fittedRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const followRef = useRef<boolean>(false);
  const lastFollowPanRef = useRef<number>(0);
  const programmaticPanAtRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean>(false);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { followRef.current = following; }, [following]);

  const { points: trail } = useTripTrail(selectedId, 24);
  const { data: geofences = [] } = useGeofences(layers.geoZones);
  const { data: nwsAlerts = [] } = useNwsAlerts("FL", layers.nwsAlerts);
  const { data: events = [] } = useVehicleEvents(selectedId, 7, layers.tripEvents && !!selectedId);

  // 1. Load Google Maps and create map instance
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
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
          clickableIcons: true,
          keyboardShortcuts: true,
        });
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
        let locating = false;
        meBtn.onclick = () => {
          if (locating) return;
          if (!navigator.geolocation) {
            meBtn.title = "Geolocalização não suportada";
            return;
          }
          locating = true;
          meBtn.style.color = "#D4AF37";
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              locating = false;
              meBtn.style.color = "#1a73e8";
              const { latitude, longitude, accuracy } = pos.coords;
              const center = { lat: latitude, lng: longitude };
              mapRef.current.panTo(center);
              if ((mapRef.current.getZoom() ?? 9) < 13) mapRef.current.setZoom(14);
              myLocMarker?.setMap(null);
              myLocAccuracy?.setMap(null);
              myLocMarker = new google.maps.Marker({
                map: mapRef.current,
                position: center,
                zIndex: 9999,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: "#1a73e8",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2.5,
                },
                title: "Você está aqui",
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
            },
            (err) => {
              locating = false;
              meBtn.style.color = "#ef4444";
              meBtn.title =
                err.code === err.PERMISSION_DENIED
                  ? "Permissão de localização negada"
                  : "Não foi possível obter sua localização";
              setTimeout(() => { meBtn.style.color = "#666"; meBtn.title = "Centralizar na minha localização"; }, 2500);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
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
        setReady(true);
      })
      .catch((e) => {
        console.error("[GoogleFleetMap]", e);
        setError(e.message || "Falha ao carregar Google Maps");
      });
    return () => {
      cancelled = true;
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
      trafficLayerRef.current.setMap(mapRef.current);
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
        st = {
          buffer: [{ lat: v.lat, lng: v.lng, t: reportedAtMs }],
          lastReportedMs: reportedAtMs,
          status: v.status,
          speed: v.speed ?? 0,
          drawnHeading: v.heading ?? 0,
          targetHeading: v.heading ?? 0,
          displayLat: v.lat,
          displayLng: v.lng,
          iconKey: "",
          selected: isSelected,
        };
        states.set(v.vehicle_id, st);
      } else {
        // Same fix? skip buffer push. Different reportedAt → consider as new fix.
        const isNewFix = reportedAtMs !== st.lastReportedMs;
        if (isNewFix) {
          const last = st.buffer[st.buffer.length - 1];
          const d = last ? haversineM(last, { lat: v.lat, lng: v.lng }) : Infinity;
          const speedMph = v.speed ?? 0;
          const stationary = speedMph < 1 && d < MIN_MOVE_METERS;
          const absurdJump = last && d > MAX_JUMP_METERS && (reportedAtMs - last.t) < 10_000;
          if (!stationary && !absurdJump) {
            st.buffer.push({ lat: v.lat, lng: v.lng, t: reportedAtMs });
          }
          st.lastReportedMs = reportedAtMs;
        }
        st.status = v.status;
        st.speed = v.speed ?? 0;
        st.selected = isSelected;
      }

      let marker = existing.get(v.vehicle_id);
      if (!marker) {
        const initialIcon = puckSvg(
          statusColor(v.status),
          isSelected,
          st.drawnHeading,
          v.status === "moving",
        );
        marker = new google.maps.Marker({
          map,
          position: { lat: st.displayLat, lng: st.displayLng },
          icon: initialIcon,
          title: v.name,
          zIndex: isSelected ? 999 : 1,
          optimized: false,
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

  // 2b. Single rAF loop — buffer-replay interpolation + smooth rotation + follow cam
  useEffect(() => {
    if (!ready) return;
    const states = statesRef.current;
    const markers = markersRef.current;

    const tick = () => {
      const wallNow = Date.now();
      const renderTime = wallNow - RENDER_DELAY_MS;

      for (const [id, st] of states) {
        const marker = markers.get(id);
        if (!marker) continue;

        const buf = st.buffer;
        // Trim very old points (keep at least one)
        const cutoff = renderTime - BUFFER_TTL_MS;
        while (buf.length > 1 && buf[1].t < cutoff) buf.shift();

        let display: { lat: number; lng: number };
        let segA: BufferPoint | null = null;
        let segB: BufferPoint | null = null;

        if (buf.length === 0) {
          display = { lat: st.displayLat, lng: st.displayLng };
        } else if (buf.length === 1 || renderTime <= buf[0].t) {
          display = { lat: buf[0].lat, lng: buf[0].lng };
        } else if (renderTime >= buf[buf.length - 1].t) {
          // No future point yet — hold the latest known so we don't extrapolate.
          const last = buf[buf.length - 1];
          display = { lat: last.lat, lng: last.lng };
        } else {
          // Find A,B bracketing renderTime
          let lo = 0, hi = buf.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (buf[mid].t <= renderTime) lo = mid; else hi = mid;
          }
          segA = buf[lo];
          segB = buf[hi];
          const span = Math.max(1, segB.t - segA.t);
          const f = Math.min(1, Math.max(0, (renderTime - segA.t) / span));
          display = {
            lat: segA.lat + (segB.lat - segA.lat) * f,
            lng: segA.lng + (segB.lng - segA.lng) * f,
          };
        }

        // Update target heading only when we have real motion segment (>= MIN_MOVE)
        // AND vehicle is actually moving. Otherwise keep last drawn heading.
        if (segA && segB && st.status === "moving" && st.speed > 1) {
          const dSeg = haversineM(segA, segB);
          if (dSeg >= MIN_MOVE_METERS) {
            st.targetHeading = bearingDeg(segA, segB);
          }
        }
        // Smooth rotation
        st.drawnHeading = lerpAngle(st.drawnHeading, st.targetHeading, HEADING_LERP_PER_FRAME);

        st.displayLat = display.lat;
        st.displayLng = display.lng;
        marker.setPosition(display);

        // Refresh icon only when something visual changed (cheap key compare)
        const headingBucket = Math.round(st.drawnHeading / 3) * 3;
        const movingFlag = st.status === "moving" ? "M" : st.status === "idle" ? "I" : "P";
        const selFlag = st.selected ? "S" : "_";
        const key = `${movingFlag}${selFlag}${headingBucket}`;
        if (key !== st.iconKey) {
          st.iconKey = key;
          marker.setIcon(
            puckSvg(
              statusColor(st.status),
              st.selected,
              st.drawnHeading,
              st.status === "moving",
            ),
          );
        }
      }

      // --- Follow camera (selected vehicle only) ---
      const selId = selectedIdRef.current;
      const map = mapRef.current;
      if (followRef.current && selId && map) {
        const sel = states.get(selId);
        if (sel) {
          const now = performance.now();
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
                  // px/py in pixels from bottom-left & top-right respectively — approx edge check:
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
      if (map.getZoom() < 14) map.setZoom(15);
    }
    setFollowing(true);
    lastFollowPanRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  // 3b. Detect user dragging the map → turn off follow (unless it's our own panTo)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;
    const handler = map.addListener("dragstart", () => {
      const sincePan = performance.now() - programmaticPanAtRef.current;
      if (sincePan > PROGRAMMATIC_PAN_GUARD_MS && followRef.current) {
        setFollowing(false);
      }
    });
    return () => google?.maps?.event?.removeListener(handler);
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
    if (!selectedId || trail.length < 2) return;

    const google = (window as any).google;
    const map = mapRef.current;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const color = speedBandColor(b.speed);
      const poly = new google.maps.Polyline({
        path: [
          { lat: a.lat, lng: a.lng },
          { lat: b.lat, lng: b.lng },
        ],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      polylineRef.current.push(poly);
    }
  }, [trail, selectedId, ready]);

  // 5. Geofences (geo-zone areas)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    for (const s of geofenceShapesRef.current) s.setMap(null);
    geofenceShapesRef.current = [];
    if (!layers.geoZones) return;

    const google = (window as any).google;
    const map = mapRef.current;
    for (const g of geofences) {
      const geom = g.geometry;
      if (!geom) continue;
      try {
        if (geom.type === "circle" && geom.center) {
          const c = new google.maps.Circle({
            map,
            center: { lat: Number(geom.center.lat), lng: Number(geom.center.lng) },
            radius: Number(geom.radius ?? 200),
            strokeColor: "#D4AF37",
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: "#D4AF37",
            fillOpacity: 0.12,
            clickable: false,
          });
          geofenceShapesRef.current.push(c);
        } else if (geom.type === "polygon" && Array.isArray(geom.coordinates)) {
          const path = geom.coordinates.map((p: any) => ({
            lat: Number(Array.isArray(p) ? p[1] : p.lat),
            lng: Number(Array.isArray(p) ? p[0] : p.lng),
          }));
          const poly = new google.maps.Polygon({
            map,
            paths: path,
            strokeColor: "#D4AF37",
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: "#D4AF37",
            fillOpacity: 0.12,
            clickable: false,
          });
          geofenceShapesRef.current.push(poly);
        }
      } catch (e) {
        console.warn("[geofence] invalid geometry", g.id, e);
      }
    }
  }, [geofences, layers.geoZones, ready]);

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
            map,
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
    for (const ev of events) {
      if (ev.lat == null || ev.lng == null) continue;
      const { color, label } = eventEmoji(ev.event_type);
      const m = new google.maps.Marker({
        map,
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
