// Shared geofence evaluation used by bouncie-webhook and bouncie-sync.
// Loads active geofences applicable to a vehicle, determines inside/outside
// for the supplied position, compares to vehicle_geofence_state, and logs
// transitions (geofence_exit / geofence_enter) into vehicle_events.

type LatLng = { lat: number; lng: number };

function toRad(d: number) { return (d * Math.PI) / 180; }

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ray-casting point-in-polygon. Accepts both [lng,lat] arrays and {lat,lng} objs.
function pointInPolygon(pt: LatLng, ring: any[]): boolean {
  const norm = ring.map((p) => Array.isArray(p)
    ? { lat: Number(p[1]), lng: Number(p[0]) }
    : { lat: Number(p.lat), lng: Number(p.lng) }
  );
  let inside = false;
  for (let i = 0, j = norm.length - 1; i < norm.length; j = i++) {
    const xi = norm[i].lng, yi = norm[i].lat;
    const xj = norm[j].lng, yj = norm[j].lat;
    const intersect = ((yi > pt.lat) !== (yj > pt.lat)) &&
      (pt.lng < ((xj - xi) * (pt.lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsideGeometry(pos: LatLng, geom: any): boolean | null {
  if (!geom) return null;
  try {
    if (geom.type === "circle" && geom.center) {
      const center = { lat: Number(geom.center.lat), lng: Number(geom.center.lng) };
      const radius = Number(geom.radius ?? 0);
      if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng) || radius <= 0) return null;
      return haversineMeters(pos, center) <= radius;
    }
    if (geom.type === "polygon" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 3) {
      return pointInPolygon(pos, geom.coordinates);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Evaluate geofences for a vehicle at a given position and persist transitions.
 * Safe to call from any edge function — never throws (logs errors instead).
 */
export async function evaluateGeofences(
  admin: any,
  vehicleId: string,
  lat: number,
  lng: number,
  reportedAt: string,
): Promise<void> {
  if (lat == null || lng == null) return;
  try {
    const { data: fences } = await admin
      .from("vehicle_geofences")
      .select("id, name, vehicle_id, geometry, notify_on_enter, notify_on_exit")
      .eq("active", true)
      .or(`vehicle_id.is.null,vehicle_id.eq.${vehicleId}`);
    if (!fences || fences.length === 0) return;

    const ids = fences.map((f: any) => f.id);
    const { data: prevRows } = await admin
      .from("vehicle_geofence_state")
      .select("geofence_id, inside")
      .eq("vehicle_id", vehicleId)
      .in("geofence_id", ids);
    const prev = new Map<string, boolean>();
    for (const r of prevRows ?? []) prev.set(r.geofence_id as string, !!r.inside);

    const pos = { lat: Number(lat), lng: Number(lng) };
    const stateUpserts: any[] = [];
    const events: any[] = [];

    for (const f of fences) {
      const inside = isInsideGeometry(pos, f.geometry);
      if (inside === null) continue;
      const prevInside = prev.get(f.id);

      stateUpserts.push({
        vehicle_id: vehicleId,
        geofence_id: f.id,
        inside,
        updated_at: reportedAt,
      });

      // Only emit on real transitions (not on first observation if it matches default false)
      if (prevInside === undefined) continue;
      if (prevInside === inside) continue;

      if (prevInside && !inside && f.notify_on_exit !== false) {
        events.push({
          vehicle_id: vehicleId,
          event_type: "geofence_exit",
          occurred_at: reportedAt,
          lat: pos.lat,
          lng: pos.lng,
          severity: "critical",
          payload: { geofence_id: f.id, geofence_name: f.name },
        });
      } else if (!prevInside && inside && f.notify_on_enter !== false) {
        events.push({
          vehicle_id: vehicleId,
          event_type: "geofence_enter",
          occurred_at: reportedAt,
          lat: pos.lat,
          lng: pos.lng,
          severity: "info",
          payload: { geofence_id: f.id, geofence_name: f.name },
        });
      }
    }

    if (stateUpserts.length) {
      await admin
        .from("vehicle_geofence_state")
        .upsert(stateUpserts, { onConflict: "vehicle_id,geofence_id" });
    }
    if (events.length) {
      await admin.from("vehicle_events").insert(events);
    }
  } catch (e) {
    console.error("[geofence] eval error:", (e as Error).message);
  }
}
