import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useTripTrail, speedBandColor, type TrailPoint } from "@/hooks/useTripTrail";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { getCoverImage } from "@/data/vehicleImages";
import { supabase } from "@/integrations/supabase/client";

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

function markerSvg(color: string, selected: boolean): any {
  const size = selected ? 44 : 32;
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
          <defs>
            <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          <circle cx="22" cy="22" r="14" fill="${color}" opacity="0.25" filter="url(#g)"/>
          <circle cx="22" cy="22" r="9" fill="${color}" stroke="${selected ? "#D4AF37" : "rgba(0,0,0,0.5)"}" stroke-width="${selected ? 3 : 2}"/>
          <circle cx="22" cy="22" r="3.2" fill="#ffffff" opacity="0.95"/>
        </svg>`
      ),
    scaledSize: { width: size, height: size } as any,
    anchor: { x: size / 2, y: size / 2 } as any,
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
};

export function GoogleFleetMap({ vehicles, selectedId, onSelect, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const polylineRef = useRef<any[]>([]);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { points: trail } = useTripTrail(selectedId, 24);

  // 1. Load Google Maps and create map instance
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 28.5, lng: -81.4 },
          zoom: 9,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: true,
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
  }, []);

  // 2. Sync markers with vehicles
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;
    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const v of vehicles) {
      if (v.lat === null || v.lng === null) continue;
      seen.add(v.vehicle_id);
      const isSelected = v.vehicle_id === selectedId;
      const icon = markerSvg(statusColor(v.status), isSelected);

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
        marker.setPosition({ lat: v.lat, lng: v.lng });
        marker.setIcon(icon);
        marker.setZIndex(isSelected ? 999 : 1);
      }
    }
    // remove stale markers
    for (const [id, m] of existing) {
      if (!seen.has(id)) {
        m.setMap(null);
        existing.delete(id);
      }
    }

    // Fit bounds once on first load
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

  // 3. Pan to selected vehicle and open info window
  useEffect(() => {
    if (!ready || !mapRef.current || !selectedId) {
      infoWindowRef.current?.close();
      return;
    }
    const v = vehicles.find((x) => x.vehicle_id === selectedId);
    if (!v || v.lat === null || v.lng === null) return;
    const map = mapRef.current;
    map.panTo({ lat: v.lat, lng: v.lng });
    if (map.getZoom() < 12) map.setZoom(13);

    const marker = markersRef.current.get(v.vehicle_id);
    if (marker && infoWindowRef.current) {
      const html = `
        <div style="font-family:'Inter',sans-serif;min-width:200px;color:#111">
          <img src="${getCoverImage(v.name)}" alt="${v.name}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:6px" />
          <div style="font-weight:700;font-size:13px">${v.name}</div>
          <div style="font-family:monospace;font-size:11px;color:#6b7280">${v.plate ?? "—"}</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb">
            <span>Velocidade</span><b>${Math.round(v.speed ?? 0)} mph</b>
          </div>
          ${v.fuel_level !== null ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Combustível</span><b>${Math.round(v.fuel_level)}%</b></div>` : ""}
          <button id="zeus-open-${v.vehicle_id}" style="margin-top:8px;width:100%;background:#D4AF37;color:#0a0a0a;font-weight:700;font-size:11px;border:0;border-radius:6px;padding:6px;cursor:pointer">Abrir Veículo</button>
        </div>`;
      infoWindowRef.current.setContent(html);
      infoWindowRef.current.open({ map, anchor: marker });
      // Wire the button after DOM render
      setTimeout(() => {
        const btn = document.getElementById(`zeus-open-${v.vehicle_id}`);
        btn?.addEventListener("click", () => onOpen(v.vehicle_id));
      }, 50);
    }
  }, [selectedId, vehicles, ready, onOpen]);

  // 4. Draw trip trail (polyline segments colored by speed band)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    // clear previous
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

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-card/50 text-sm text-muted-foreground p-6 text-center">
        Não foi possível carregar o Google Maps: {error}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
