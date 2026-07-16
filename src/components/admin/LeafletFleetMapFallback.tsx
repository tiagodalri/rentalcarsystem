import { useEffect, useMemo, useRef } from "react";
import L, { type LatLngExpression, type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveVehicle } from "@/hooks/useFleetLive";

type Props = {
  vehicles: LiveVehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

const ORLANDO_CENTER: LatLngExpression = [28.5383, -81.3792];

function statusColor(status: LiveVehicle["status"]): string {
  if (status === "moving") return "hsl(var(--success, 142 72% 38%))";
  if (status === "idle") return "hsl(var(--warning, 38 92% 50%))";
  return "hsl(var(--muted-foreground))";
}

function buildVehicleIcon(vehicle: LiveVehicle, selected: boolean): L.DivIcon {
  const color = statusColor(vehicle.status);
  const speed = Math.round(vehicle.speed ?? 0);
  const heading = vehicle.heading ?? 0;
  const size = selected ? 46 : 38;

  return L.divIcon({
    className: "rental-leaflet-marker",
    html: `
      <div style="width:${size}px;height:${size}px;transform:rotate(${heading}deg);display:flex;align-items:center;justify-content:center;">
        <div style="width:${size - 8}px;height:${size - 8}px;border-radius:999px;background:hsl(var(--background));border:3px solid ${color};box-shadow:0 10px 28px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;position:relative;">
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid ${color};position:absolute;top:-8px;left:50%;transform:translateX(-50%);"></div>
          <span style="transform:rotate(${-heading}deg);font:600 10px/1 Inter,system-ui,sans-serif;color:hsl(var(--foreground));font-variant-numeric:tabular-nums;">${speed}</span>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function bindPopup(marker: LeafletMarker, vehicle: LiveVehicle): void {
  marker.bindPopup(
    `<div style="min-width:190px;font-family:Inter,system-ui,sans-serif;color:hsl(var(--foreground));">
      <div style="font-size:13px;font-weight:650;margin-bottom:3px;">${vehicle.name}</div>
      <div style="font-size:11px;color:hsl(var(--muted-foreground));font-family:ui-monospace,monospace;margin-bottom:8px;">${vehicle.plate ?? ""}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
        <div><span style="color:hsl(var(--muted-foreground));">Vel.</span><br/><b>${Math.round(vehicle.speed ?? 0)} mph</b></div>
        <div><span style="color:hsl(var(--muted-foreground));">Status</span><br/><b>${vehicle.status === "moving" ? "Movimento" : vehicle.status === "idle" ? "Parado" : "Estacionado"}</b></div>
      </div>
    </div>`,
    { closeButton: false, offset: [0, -12] },
  );
}

export function LeafletFleetMapFallback({ vehicles, selectedId, onSelect, onOpen }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());

  const validVehicles = useMemo(
    () => vehicles.filter((vehicle) => typeof vehicle.lat === "number" && typeof vehicle.lng === "number"),
    [vehicles],
  );

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      center: ORLANDO_CENTER,
      zoom: 10,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    const bounds: LatLngExpression[] = [];

    for (const vehicle of validVehicles) {
      if (vehicle.lat == null || vehicle.lng == null) continue;
      const id = vehicle.vehicle_id;
      const selected = id === selectedId;
      const position: LatLngExpression = [vehicle.lat, vehicle.lng];
      seen.add(id);
      bounds.push(position);

      const existing = markersRef.current.get(id);
      if (existing) {
        existing.setLatLng(position);
        existing.setIcon(buildVehicleIcon(vehicle, selected));
        bindPopup(existing, vehicle);
      } else {
        const marker = L.marker(position, {
          icon: buildVehicleIcon(vehicle, selected),
          zIndexOffset: selected ? 1000 : 0,
          title: `${vehicle.name} ${vehicle.plate ?? ""}`.trim(),
        });
        marker.on("click", () => onSelect(id));
        marker.on("dblclick", () => onOpen(id));
        bindPopup(marker, vehicle);
        marker.addTo(map);
        markersRef.current.set(id, marker);
      }
    }

    for (const [id, marker] of markersRef.current.entries()) {
      if (!seen.has(id)) {
        marker.removeFrom(map);
        markersRef.current.delete(id);
      }
    }

    if (bounds.length && !selectedId) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 11, animate: false });
    }
  }, [validVehicles, selectedId, onSelect, onOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 13), { duration: 0.5 });
    marker.openPopup();
  }, [selectedId]);

  return (
    <div className="relative w-full h-full bg-muted/30" data-no-swipe-back>
      <div ref={hostRef} className="absolute inset-0 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-popup-content-wrapper]:rounded-lg [&_.leaflet-popup-content-wrapper]:border [&_.leaflet-popup-content-wrapper]:border-border/40 [&_.leaflet-popup-content-wrapper]:bg-background [&_.leaflet-popup-tip]:bg-background" />
    </div>
  );
}