import { supabase } from "@/integrations/supabase/client";
import type { EpassTollRow, EpassParseResult } from "./csvParser";

export type AssignedToll = EpassTollRow & {
  vehicle_id: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
  booking_id: string | null;
  booking_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: "matched" | "no_vehicle" | "no_booking";
};

type VehicleRow = {
  id: string;
  name: string;
  license_plate: string | null;
  e_pass_transponder: string | null;
};

type BookingRow = {
  id: string;
  booking_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  vehicle_id: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  status: string;
};

function combineDateTime(date: string, time: string | null, fallback: string): number {
  const t = (time && /^\d{1,2}:\d{2}/.test(time)) ? time : fallback;
  const parts = t.split(":");
  const h = parts[0]?.padStart(2, "0") || "00";
  const m = parts[1]?.padStart(2, "0") || "00";
  // Sem offset = TZ local do navegador. Para match aproximado isso e ok pois
  // ambos os lados sao convertidos para epoch ms com a mesma regra.
  return new Date(`${date}T${h}:${m}:00`).getTime();
}

export async function assignTolls(tolls: EpassTollRow[]): Promise<AssignedToll[]> {
  if (tolls.length === 0) return [];

  // 1) Veiculos com transponder cadastrado
  const transponders = Array.from(new Set(tolls.map((t) => t.transponder_number.trim()))).filter(Boolean);
  const { data: vehiclesData } = await supabase
    .from("vehicles")
    .select("id,name,license_plate,e_pass_transponder")
    .not("e_pass_transponder", "is", null);

  const byTransponder = new Map<string, VehicleRow>();
  for (const v of (vehiclesData || []) as VehicleRow[]) {
    if (v.e_pass_transponder) byTransponder.set(v.e_pass_transponder.trim(), v);
  }

  // 2) Reservas dos veiculos envolvidos no periodo
  const vehicleIds = Array.from(new Set(
    transponders.map((t) => byTransponder.get(t)?.id).filter(Boolean) as string[]
  ));

  const dates = tolls.map((t) => t.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const bookingsByVehicle = new Map<string, BookingRow[]>();
  if (vehicleIds.length > 0 && minDate && maxDate) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id,booking_number,customer_id,customer_name,vehicle_id,pickup_date,return_date,pickup_time,return_time,status")
      .in("vehicle_id", vehicleIds)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .lte("pickup_date", maxDate)
      .gte("return_date", minDate);
    for (const b of (bookings || []) as BookingRow[]) {
      const arr = bookingsByVehicle.get(b.vehicle_id) || [];
      arr.push(b);
      bookingsByVehicle.set(b.vehicle_id, arr);
    }
  }

  // 3) Pra cada pedagio, decide status
  const out: AssignedToll[] = [];
  for (const t of tolls) {
    const v = byTransponder.get(t.transponder_number.trim());
    if (!v) {
      out.push({
        ...t,
        vehicle_id: null, vehicle_name: null, vehicle_plate: null,
        booking_id: null, booking_number: null,
        customer_id: null, customer_name: null,
        status: "no_vehicle",
      });
      continue;
    }
    const tollMs = combineDateTime(t.date, t.time, "12:00");
    const bookings = bookingsByVehicle.get(v.id) || [];
    // Match: pickup_at <= toll < return_at (intervalo semi-aberto)
    const match = bookings.find((b) => {
      const pickup = combineDateTime(b.pickup_date, b.pickup_time, "10:00");
      const ret = combineDateTime(b.return_date, b.return_time, "10:00");
      return tollMs >= pickup && tollMs < ret;
    });
    if (match) {
      out.push({
        ...t,
        vehicle_id: v.id, vehicle_name: v.name, vehicle_plate: v.license_plate,
        booking_id: match.id, booking_number: match.booking_number,
        customer_id: match.customer_id, customer_name: match.customer_name,
        status: "matched",
      });
    } else {
      out.push({
        ...t,
        vehicle_id: v.id, vehicle_name: v.name, vehicle_plate: v.license_plate,
        booking_id: null, booking_number: null,
        customer_id: null, customer_name: null,
        status: "no_booking",
      });
    }
  }
  return out;
}

export async function applyEpassImport(
  parsed: EpassParseResult,
  assigned: AssignedToll[],
): Promise<{ inserted: number; skipped: number; importId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const total_amount = assigned.reduce((s, t) => s + t.amount, 0);
  const matched_rows = assigned.filter((t) => t.status === "matched").length;
  const unmatched_vehicle_rows = assigned.filter((t) => t.status === "no_vehicle").length;
  const unmatched_booking_rows = assigned.filter((t) => t.status === "no_booking").length;

  const { data: imp, error: impErr } = await supabase
    .from("epass_imports")
    .insert({
      filename: parsed.filename,
      period_label: parsed.period_label,
      account_number: parsed.account_number,
      total_rows: assigned.length,
      matched_rows,
      unmatched_vehicle_rows,
      unmatched_booking_rows,
      total_amount,
      imported_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (impErr || !imp) throw new Error(impErr?.message || "Falha ao registrar importacao");

  // Account activity (auditoria)
  if (parsed.account.length > 0) {
    await supabase.from("epass_account_activity").insert(
      parsed.account.map((a) => ({
        import_id: imp.id,
        account_number: a.account_number,
        activity_date: a.date,
        description: a.description,
        location: a.location,
        amount: a.amount,
      })),
    );
  }

  // Tolls (com dedupe via UPSERT no hash)
  let inserted = 0;
  let skipped = 0;
  const CHUNK = 200;
  for (let i = 0; i < assigned.length; i += CHUNK) {
    const slice = assigned.slice(i, i + CHUNK).map((t) => ({
      import_id: imp.id,
      transponder_number: t.transponder_number,
      vehicle_id: t.vehicle_id,
      booking_id: t.booking_id,
      customer_id: t.customer_id,
      toll_datetime: t.toll_datetime,
      posting_date: t.posting_date,
      location: t.location,
      amount: t.amount,
      toll_type: t.toll_type,
      status: t.status,
      dedupe_hash: t.dedupe_hash,
    }));
    const { data, error } = await supabase
      .from("epass_tolls")
      .upsert(slice, { onConflict: "dedupe_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    inserted += (data?.length || 0);
    skipped += slice.length - (data?.length || 0);
  }

  return { inserted, skipped, importId: imp.id };
}
