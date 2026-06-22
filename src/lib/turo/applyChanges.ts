/**
 * Aplica as classificações aprovadas pelo usuário:
 *  - INSERT para novas (com re-check anti-duplicação imediatamente antes do insert)
 *  - UPDATE seletivo para enriquecidas (somente campos marcados)
 *
 * Garantias:
 *  - Re-busca os turo_reservation_id existentes no momento do apply (evita
 *    duplicar caso outra aba/usuário já tenha inserido entre o load e o apply).
 *  - Inserts em chunks de 25; se um chunk falhar, faz retry linha-a-linha
 *    para que o erro seja atribuído à linha correta.
 *  - Updates linha-a-linha (campos variam) com captura de erro por reserva.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Classification, BookingSnapshot } from "./diffEngine";
import type { TuroRow } from "./csvParser";

export interface ApplyReport {
  insertedIds: string[];
  updatedIds: string[];
  skipped: { reservationId: string; reason: string }[];
  failures: { reservationId: string; reason: string }[];
}

const INSERT_CHUNK_SIZE = 25;

function statusForBooking(row: TuroRow): { status: string; payment_status: string } {
  switch (row.status) {
    case "completed":   return { status: "completed",   payment_status: "paid" };
    case "in_progress": return { status: "in_progress", payment_status: "paid" };
    case "confirmed":   return { status: "confirmed",   payment_status: "pending" };
    case "cancelled":   return { status: "cancelled",   payment_status: "cancelled" };
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
  if ("status" in payload && (payload.status === "completed" || payload.status === "in_progress")) {
    payload.payment_status = "paid";
  }
  return payload;
}

/** Re-busca os turo_reservation_id já existentes no banco para um conjunto de candidatos. */
async function fetchExistingTuroIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const existing = new Set<string>();
  // OR filter em chunks pra não estourar limite de URL
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const filter = slice.map((id) => `addons->>turo_reservation_id.eq.${id}`).join(",");
    const { data, error } = await supabase
      .from("bookings")
      .select("addons")
      .or(filter);
    if (error) throw error;
    for (const row of (data || []) as any[]) {
      const tid = row.addons?.turo_reservation_id;
      if (tid) existing.add(String(tid));
    }
  }
  return existing;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function applyClassifications(classifications: Classification[]): Promise<ApplyReport> {
  const report: ApplyReport = { insertedIds: [], updatedIds: [], skipped: [], failures: [] };

  const toInsertAll = classifications.filter(
    (c) => c.kind === "new" && c.selected && c.vehicleId
  );
  const toUpdate = classifications.filter(
    (c) => c.kind === "enrich" && c.selected && c.existing && c.selectedFields.size > 0
  );

  // 1) Re-check anti-duplicação no momento do apply
  let alreadyExisting = new Set<string>();
  try {
    alreadyExisting = await fetchExistingTuroIds(toInsertAll.map((c) => c.row.reservationId));
  } catch (e: any) {
    // Se o re-check falhar, ainda assim seguimos — o índice/conflito do banco será o último recurso
    console.warn("[turo-import] re-check failed, proceeding without it:", e?.message);
  }

  const toInsert: Classification[] = [];
  for (const c of toInsertAll) {
    if (alreadyExisting.has(c.row.reservationId)) {
      report.skipped.push({
        reservationId: c.row.reservationId,
        reason: "Já existe no sistema (criada por outra importação)",
      });
    } else {
      toInsert.push(c);
    }
  }

  // 2) INSERTS em chunks; em caso de erro de chunk, retry linha-a-linha
  for (const group of chunk(toInsert, INSERT_CHUNK_SIZE)) {
    const payloads = group.map((c) => buildInsertPayload(c.row, c.vehicleId!));
    const { data, error } = await supabase
      .from("bookings")
      .insert(payloads)
      .select("id");

    if (!error && data) {
      for (const r of data as any[]) report.insertedIds.push(r.id);
      continue;
    }

    // Fallback: insere uma a uma pra atribuir erro corretamente
    for (let i = 0; i < group.length; i++) {
      const c = group[i];
      const { data: single, error: singleErr } = await supabase
        .from("bookings")
        .insert(payloads[i])
        .select("id")
        .single();
      if (singleErr) {
        report.failures.push({ reservationId: c.row.reservationId, reason: singleErr.message });
      } else if (single) {
        report.insertedIds.push((single as any).id);
      }
    }
  }

  // 3) UPDATES linha-a-linha
  for (const c of toUpdate) {
    const payload = buildUpdatePayload(c);
    if (Object.keys(payload).length === 0) continue;
    const { error } = await supabase
      .from("bookings")
      .update(payload)
      .eq("id", c.existing!.id);
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
