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
          mapTypeId: layers.mapType === "satellite" ? "hybrid" : "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          backgroundColor: "#e5e3df",
          gestureHandling: "greedy",
        });
        infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: false, maxWidth: 320 });

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

  // Switch base map type
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setMapTypeId(layers.mapType === "satellite" ? "hybrid" : "roadmap");
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

  // 2. Sync markers with vehicles + update anchors for smooth animation
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;
    const existing = markersRef.current;
    const anchors = anchorsRef.current;
    const seen = new Set<string>();
    const now = performance.now();

    for (const v of vehicles) {
      if (v.lat === null || v.lng === null) continue;
      seen.add(v.vehicle_id);
      const isSelected = v.vehicle_id === selectedId;
      const color = statusColor(v.status);
      const icon = markerSvg(color, isSelected, v.heading ?? null);

      const reportedAtMs = v.reported_at ? new Date(v.reported_at).getTime() : Date.now();
      const prev = anchors.get(v.vehicle_id);

      // Detect a "new fix" (server-side data actually changed)
      const isNewFix =
        !prev ||
        prev.lat !== v.lat ||
        prev.lng !== v.lng ||
        prev.reportedAt !== reportedAtMs;

      if (isNewFix) {
        anchors.set(v.vehicle_id, {
          lat: v.lat,
          lng: v.lng,
          heading: v.heading ?? prev?.heading ?? 0,
          speed: v.speed ?? 0,
          reportedAt: reportedAtMs,
          receivedAt: Date.now(),
          moving: v.status === "moving",
          // Tween from the currently-drawn position (or the new anchor if first time)
          displayLat: prev?.displayLat ?? v.lat,
          displayLng: prev?.displayLng ?? v.lng,
          tweenFromLat: prev?.displayLat ?? v.lat,
          tweenFromLng: prev?.displayLng ?? v.lng,
          tweenStart: now,
        });
      } else if (prev) {
        // Same fix — just refresh moving flag & heading in case status changed
        prev.moving = v.status === "moving";
      }

      let marker = existing.get(v.vehicle_id);
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: v.lat, lng: v.lng },
          icon,
          title: v.name,
          zIndex: isSelected ? 999 : 1,
          optimized: false,
        });
        marker.addListener("click", () => {
          onSelect(v.vehicle_id);
        });
        existing.set(v.vehicle_id, marker);
      } else {
        // Position is now driven by the rAF loop; only refresh icon/z-index here
        marker.setIcon(icon);
        marker.setZIndex(isSelected ? 999 : 1);
      }
    }
    for (const [id, m] of existing) {
      if (!seen.has(id)) {
        m.setMap(null);
        existing.delete(id);
        anchors.delete(id);
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
  }, [vehicles, selectedId, ready, onSelect, layers.carvatars]);

  // 2b. Smooth animation loop: tween on new fixes + dead reckoning between fixes
  useEffect(() => {
    if (!ready) return;
    const anchors = anchorsRef.current;
    const markers = markersRef.current;

    const tick = () => {
      const now = performance.now();
      const wallNow = Date.now();

      for (const [id, a] of anchors) {
        const marker = markers.get(id);
        if (!marker) continue;

        // 1) Compute the "true" target = anchor + dead-reckoned offset
        const ageMs = wallNow - a.reportedAt;
        let targetLat = a.lat;
        let targetLng = a.lng;
        if (a.moving && a.speed > 1 && ageMs > 0 && ageMs < MAX_EXTRAPOLATE_MS) {
          const elapsedS = ageMs / 1000;
          const metersPerSec = a.speed * 0.44704; // mph -> m/s
          const dist = metersPerSec * elapsedS;
          const brg = (a.heading * Math.PI) / 180;
          const dLat = (dist * Math.cos(brg)) / 111320;
          const dLng =
            (dist * Math.sin(brg)) /
            (111320 * Math.cos((a.lat * Math.PI) / 180) || 1);
          targetLat = a.lat + dLat;
          targetLng = a.lng + dLng;
        }

        // 2) Tween from previous display position to target over TWEEN_MS
        const tElapsed = now - a.tweenStart;
        let display: { lat: number; lng: number };
        if (tElapsed >= TWEEN_MS) {
          display = { lat: targetLat, lng: targetLng };
        } else {
          // ease-out cubic
          const k = 1 - Math.pow(1 - tElapsed / TWEEN_MS, 3);
          display = {
            lat: a.tweenFromLat + (targetLat - a.tweenFromLat) * k,
            lng: a.tweenFromLng + (targetLng - a.tweenFromLng) * k,
          };
        }

        a.displayLat = display.lat;
        a.displayLng = display.lng;
        marker.setPosition(display);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [ready]);


  // 3. Pan to selected vehicle
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    infoWindowRef.current?.close();
    if (!selectedId) return;
    const v = vehicles.find((x) => x.vehicle_id === selectedId);
    if (!v || v.lat === null || v.lng === null) return;
    const map = mapRef.current;
    map.panTo({ lat: v.lat, lng: v.lng });
    if (map.getZoom() < 13) map.setZoom(14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

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

  return <div ref={containerRef} className="w-full h-full" />;
}
