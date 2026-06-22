/**
 * Aplica as classificações aprovadas pelo usuário:
 *  - INSERT para novas
 *  - UPDATE seletivo para enriquecidas (somente campos marcados)
 *
 * Cada operação é independente — falha em uma linha não derruba o lote.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Classification, BookingSnapshot } from "./diffEngine";
import type { TuroRow } from "./csvParser";

export interface ApplyReport {
  insertedIds: string[];
  updatedIds: string[];
  failures: { reservationId: string; reason: string }[];
}

function statusForBooking(row: TuroRow): { status: string; payment_status: string } {
  switch (row.status) {
    case "completed":   return { status: "completed",   payment_status: "paid" };
    case "in_progress": return { status: "in_progress", payment_status: "paid" };
    case "confirmed":   return { status: "confirmed",   payment_status: "pending" };
    case "cancelled":   return { status: "cancelled",   payment_status: "pending" };
    default:            return { status: "confirmed",   payment_status: "pending" };
  }
}

function buildInsertPayload(row: TuroRow, vehicleId: string) {
  const { status, payment_status } = statusForBooking(row);
  return {
    vehicle_id: vehicleId,
    customer_name: row.guestName,
    pickup_date: row.pickupDate,
    return_date: row.returnDate,
    pickup_time: row.pickupTime,
    return_time: row.returnTime,
    pickup_location: row.pickupLocation,
    return_location: row.returnLocation,
    total_price: row.totalEarnings,
    status,
    payment_status,
    contract_status: "not_sent",
    addons: {
      turo_reservation_id: row.reservationId,
      turo_vehicle_name: row.vehicleModel,
      turo_status_raw: row.statusRaw,
      imported_from: "turo_csv_import",
      imported_at: new Date().toISOString(),
    },
  };
}

function buildUpdatePayload(c: Classification): Record<string, any> {
  const payload: Record<string, any> = {};
  if (!c.existing) return payload;
  for (const diff of c.diffs) {
    if (!c.selectedFields.has(diff.field)) continue;
    payload[String(diff.field)] = diff.newValue;
  }
  // Garante que payment_status acompanhe status quando aplicável
  if ("status" in payload && (payload.status === "completed" || payload.status === "in_progress")) {
    // só promove para paid se ainda não estiver pago
    payload.payment_status = "paid";
  }
  return payload;
}

export async function applyClassifications(classifications: Classification[]): Promise<ApplyReport> {
  const report: ApplyReport = { insertedIds: [], updatedIds: [], failures: [] };

  // Filtra apenas selecionadas e com ação real
  const toInsert = classifications.filter((c) => c.kind === "new" && c.selected && c.vehicleId);
  const toUpdate = classifications.filter((c) => c.kind === "enrich" && c.selected && c.existing && c.selectedFields.size > 0);

  // INSERTS (em lote)
  if (toInsert.length > 0) {
    const payloads = toInsert.map((c) => buildInsertPayload(c.row, c.vehicleId!));
    const { data, error } = await supabase
      .from("bookings")
      .insert(payloads)
      .select("id, addons");
    if (error) {
      for (const c of toInsert) report.failures.push({ reservationId: c.row.reservationId, reason: error.message });
    } else {
      for (const r of data || []) {
        report.insertedIds.push((r as any).id);
      }
    }
  }

  // UPDATES (linha a linha — campos variam)
  for (const c of toUpdate) {
    const payload = buildUpdatePayload(c);
    if (Object.keys(payload).length === 0) continue;
    const { error } = await supabase.from("bookings").update(payload).eq("id", c.existing!.id);
    if (error) report.failures.push({ reservationId: c.row.reservationId, reason: error.message });
    else report.updatedIds.push(c.existing!.id);
  }

  return report;
}

/** Carrega snapshot de reservas Turo já existentes (indexa por turo_reservation_id). */
export async function loadExistingTuroBookings(): Promise<Map<string, BookingSnapshot>> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_number, customer_name, customer_email, customer_phone, vehicle_id, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, total_price, status, payment_status, deleted_at, addons")
    .not("addons->>turo_reservation_id", "is", null);
  if (error) throw error;
  const map = new Map<string, BookingSnapshot>();
  for (const row of (data || []) as any[]) {
    const tid = row.addons?.turo_reservation_id;
    if (!tid) continue;
    map.set(String(tid), row as BookingSnapshot);
  }
  return map;
}

/** Carrega mapeamento turo_vehicle_name → vehicle_id. */
export async function loadVehicleMapping(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("turo_vehicle_mapping")
    .select("turo_vehicle_name, vehicle_id");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of (data || []) as any[]) {
    map.set(String(row.turo_vehicle_name).trim(), row.vehicle_id);
  }
  return map;
}

export async function saveVehicleMapping(turoName: string, vehicleId: string): Promise<void> {
  const { error } = await supabase
    .from("turo_vehicle_mapping")
    .upsert({ turo_vehicle_name: turoName.trim(), vehicle_id: vehicleId }, { onConflict: "turo_vehicle_name" });
  if (error) throw error;
}
