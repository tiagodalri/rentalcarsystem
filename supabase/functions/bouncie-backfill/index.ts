// Motor resumível de importação histórica Bouncie.
// 2 estágios por veículo:
//   STAGE 'recent': últimos 60 dias, semana a semana, do mais novo pro mais antigo.
//   STAGE 'deep':   continua voltando até a instalação. Para após 8 semanas vazias
//                   seguidas ou após atingir o teto (3 anos).
// Resumível: cada invocação processa no máximo MAX_WEEKS_PER_RUN semanas por veículo
// e MAX_VEHICLES_PER_RUN veículos, guardando o cursor em bouncie_backfill_progress.
//
// POST { manual: true, imei?: string, weeksPerVehicle?: number, vehiclesPerRun?: number }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

import { buildCorsHeaders } from "../_shared/cors.ts";
const WEEK_MS = 7 * 86400_000;
const RECENT_DAYS = 60;
const DEEP_CAP_YEARS = 3;
const EMPTY_STREAK_STOP = 8;

async function getToken(admin: any): Promise<string> {
  const { data: integ } = await admin
    .from("bouncie_integration")
    .select("access_token, token_expires_at, authorization_code")
    .eq("id", 1).maybeSingle();
  if (!integ) throw new Error("bouncie_integration row missing");
  const exp = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
  if (integ.access_token && exp > Date.now()) return integ.access_token;
  if (!integ.authorization_code) throw new Error("no authorization_code on file");
  const resp = await fetch("https://auth.bouncie.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: BOUNCIE_CLIENT_ID, client_secret: BOUNCIE_CLIENT_SECRET,
      grant_type: "authorization_code", code: integ.authorization_code,
      redirect_uri: BOUNCIE_REDIRECT_URI,
    }),
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`token refresh ${resp.status}: ${body}`);
  const parsed = JSON.parse(body);
  const token = parsed.access_token as string;
  const expiresAt = parsed.expires_in
    ? new Date(Date.now() + (parsed.expires_in - 60) * 1000).toISOString() : null;
  await admin.from("bouncie_integration").update({
    access_token: token, token_expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return token;
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}

function mapTrip(vehicleId: string, imei: string, trip: any) {
  const startedAt = trip.startTime ? new Date(trip.startTime).toISOString() : null;
  const endedAt = trip.endTime ? new Date(trip.endTime).toISOString() : null;
  const duration = startedAt && endedAt
    ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
    : null;
  const coords: number[][] | null = trip?.gps?.coordinates && Array.isArray(trip.gps.coordinates)
    ? trip.gps.coordinates : null;
  const first = coords?.[0] ?? null;
  const last = coords?.[coords.length - 1] ?? null;
  const distanceMi = num(trip.distance);
  const fuelGal = num(trip.fuelConsumed);
  const avgMpg = distanceMi !== null && fuelGal && fuelGal > 0
    ? Number((distanceMi / fuelGal).toFixed(2)) : null;
  return {
    id: String(trip.transactionId),
    transaction_id: String(trip.transactionId),
    vehicle_id: vehicleId,
    imei,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: duration,
    distance_mi: distanceMi,
    max_speed_mph: num(trip.maxSpeed),
    avg_speed_mph: num(trip.averageSpeed),
    start_odometer: num(trip.startOdometer),
    end_odometer: num(trip.endOdometer),
    fuel_consumed_gal: fuelGal,
    average_mpg: avgMpg,
    idle_seconds: num(trip.totalIdleDuration),
    hard_braking: num(trip.hardBrakingCount) ?? 0,
    hard_accel: num(trip.hardAccelerationCount) ?? 0,
    start_lat: first ? num(first[1]) : null,
    start_lng: first ? num(first[0]) : null,
    end_lat: last ? num(last[1]) : null,
    end_lng: last ? num(last[0]) : null,
    start_address: null, end_address: null,
    time_zone_offset: trip.timeZone ?? null,
    gps: trip.gps ?? null,
    raw: trip,
  };
}

async function fetchTripsWindow(token: string, imei: string, startsAfter: string, endsBefore: string) {
  const url = `https://api.bouncie.dev/v1/trips?imei=${encodeURIComponent(imei)}&starts-after=${encodeURIComponent(startsAfter)}&ends-before=${encodeURIComponent(endsBefore)}&gps-format=geojson`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: { Authorization: token } });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`trips ${resp.status}: ${text.slice(0, 200)}`);
      try { return JSON.parse(text); } catch { return []; }
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return [];
}

async function refreshVehicleRaw(admin: any, token: string, vehicleId: string, imei: string) {
  try {
    const resp = await fetch(`https://api.bouncie.dev/v1/vehicles?imei=${encodeURIComponent(imei)}`, {
      headers: { Authorization: token },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const v = Array.isArray(data) ? data[0] : data;
    if (!v) return;
    await admin.from("vehicles").update({ bouncie_raw: v }).eq("id", vehicleId);
  } catch { /* ignore */ }
}

function isoDate(ms: number) { return new Date(ms).toISOString().slice(0, 10); }

async function processVehicle(
  admin: any, token: string, vehicle: any, progress: any, maxWeeks: number,
) {
  const imei: string = vehicle.bouncie_imei;
  const vehicleId: string = vehicle.id;
  let stage: string = progress?.stage ?? "recent";
  let newestDone: Date | null = progress?.newest_week_done ? new Date(progress.newest_week_done) : null;
  let oldestDone: Date | null = progress?.oldest_week_done ? new Date(progress.oldest_week_done) : null;
  let emptyStreak: number = progress?.empty_streak ?? 0;
  let importedThisRun = 0;
  let weeksProcessed = 0;
  let lastError: string | null = null;

  // primeira passada: garantir bouncie_raw atualizado
  if (!progress?.last_run) await refreshVehicleRaw(admin, token, vehicleId, imei);

  // marca status running
  await admin.from("bouncie_backfill_progress").upsert({
    vehicle_id: vehicleId, imei, status: "running", stage,
    newest_week_done: newestDone ? isoDate(newestDone.getTime()) : null,
    oldest_week_done: oldestDone ? isoDate(oldestDone.getTime()) : null,
    empty_streak: emptyStreak, last_run: new Date().toISOString(),
  }, { onConflict: "vehicle_id" });

  const now = Date.now();
  const recentFloor = now - RECENT_DAYS * 86400_000;
  const deepFloor = now - DEEP_CAP_YEARS * 365 * 86400_000;

  while (weeksProcessed < maxWeeks) {
    let cursorEnd: number; let cursorStart: number; let floorMs: number;
    if (stage === "recent") {
      cursorEnd = oldestDone ? oldestDone.getTime() : now;
      if (cursorEnd <= recentFloor) { stage = "deep"; continue; }
      floorMs = recentFloor;
    } else if (stage === "deep") {
      cursorEnd = oldestDone ? oldestDone.getTime() : recentFloor;
      if (cursorEnd <= deepFloor) {
        stage = "done"; break;
      }
      floorMs = deepFloor;
    } else { break; }

    cursorStart = Math.max(floorMs, cursorEnd - WEEK_MS);
    const startsAfter = new Date(cursorStart).toISOString();
    const endsBefore = new Date(cursorEnd).toISOString();

    try {
      const trips = await fetchTripsWindow(token, imei, startsAfter, endsBefore);
      const list = Array.isArray(trips) ? trips : [];
      if (list.length > 0) {
        const rows = list
          .filter((t: any) => t?.transactionId && t.startTime && t.endTime)
          .map((t: any) => mapTrip(vehicleId, imei, t));
        if (rows.length > 0) {
          const { error: upErr } = await admin.from("vehicle_trips")
            .upsert(rows, { onConflict: "id" });
          if (upErr) throw upErr;
          importedThisRun += rows.length;
        }
        emptyStreak = 0;
      } else {
        if (stage === "deep") emptyStreak += 1;
      }
    } catch (e) {
      lastError = (e as Error).message;
      break;
    }

    // cursor avança pra trás
    oldestDone = new Date(cursorStart);
    if (!newestDone || cursorEnd > newestDone.getTime()) newestDone = new Date(cursorEnd);
    weeksProcessed += 1;

    // condição de parada do deep
    if (stage === "deep" && emptyStreak >= EMPTY_STREAK_STOP) { stage = "done"; break; }
    if (cursorStart <= floorMs) {
      if (stage === "recent") stage = "deep"; else { stage = "done"; break; }
    }

    // respiro entre chamadas
    await new Promise((r) => setTimeout(r, 150));
  }

  const finalStatus = stage === "done" ? "done" : (lastError ? "error" : "pending");
  const { data: cur } = await admin.from("bouncie_backfill_progress")
    .select("trips_imported").eq("vehicle_id", vehicleId).maybeSingle();
  const totalSoFar = (cur?.trips_imported ?? 0) + importedThisRun;

  await admin.from("bouncie_backfill_progress").upsert({
    vehicle_id: vehicleId, imei, status: finalStatus, stage,
    newest_week_done: newestDone ? isoDate(newestDone.getTime()) : null,
    oldest_week_done: oldestDone ? isoDate(oldestDone.getTime()) : null,
    empty_streak: emptyStreak, trips_imported: totalSoFar,
    last_error: lastError, last_run: new Date().toISOString(),
  }, { onConflict: "vehicle_id" });

  return {
    vehicle_id: vehicleId, imei, stage_after: stage, status: finalStatus,
    weeks_processed: weeksProcessed, trips_imported_this_run: importedThisRun,
    total_trips: totalSoFar, oldest: oldestDone ? isoDate(oldestDone.getTime()) : null,
    error: lastError,
  };
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manual = body?.manual === true || req.headers.get("x-manual-backfill") === "true";
    if (!manual) {
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        manual_required: true,
        reason: "Backfill histórico não roda mais por cron. Use o gatilho manual no painel quando quiser continuar a importação histórica.",
      }, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const onlyImei: string | undefined = body?.imei;
    const weeksPerVehicle = Math.max(1, Math.min(8, Number(body?.weeksPerVehicle ?? 2)));
    const vehiclesPerRun = Math.max(1, Math.min(5, Number(body?.vehiclesPerRun ?? 2)));
    const maxRunMs = Math.max(10, Math.min(90, Number(body?.maxRunSeconds ?? 45))) * 1000;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await getToken(admin);

    // pega veículos com IMEI + progresso
    let q = admin.from("vehicles").select("id, bouncie_imei, license_plate, brand, model")
      .not("bouncie_imei", "is", null);
    if (onlyImei) q = q.eq("bouncie_imei", onlyImei);
    const { data: vehicles, error: vErr } = await q;
    if (vErr) throw vErr;
    if (!vehicles?.length) throw new Error("nenhum veículo com IMEI encontrado");

    const { data: progressRows } = await admin
      .from("bouncie_backfill_progress").select("*")
      .in("vehicle_id", vehicles.map((v: any) => v.id));
    const progressMap = new Map<string, any>(
      (progressRows ?? []).map((p: any) => [p.vehicle_id, p]),
    );

    // filtra só veículos ainda não concluídos; dados já importados não são reprocessados.
    const candidates = vehicles.filter((v: any) => {
      const p = progressMap.get(v.id);
      if (!p) return true;
      return p.status !== "done";
    }).slice(0, vehiclesPerRun);

    const summary: any[] = [];
    for (const v of candidates) {
      if (Date.now() - t0 >= maxRunMs) break;
      const r = await processVehicle(admin, token, v, progressMap.get(v.id), weeksPerVehicle);
      summary.push(r);
    }

    // estatísticas globais
    const { data: progAll } = await admin.from("bouncie_backfill_progress")
      .select("status, stage, trips_imported");
    const totals = {
      vehicles: progAll?.length ?? 0,
      done: progAll?.filter((p: any) => p.status === "done").length ?? 0,
      pending: progAll?.filter((p: any) => p.status === "pending").length ?? 0,
      running: progAll?.filter((p: any) => p.status === "running").length ?? 0,
      error: progAll?.filter((p: any) => p.status === "error").length ?? 0,
      total_trips: (progAll ?? []).reduce((a: number, p: any) => a + (p.trips_imported ?? 0), 0),
    };

    return new Response(JSON.stringify({
      ok: true, ran_in_seconds: Math.round((Date.now() - t0) / 1000),
      processed: summary.length,
      all_done: totals.vehicles > 0 && totals.done === totals.vehicles,
      more_needed: totals.vehicles > 0 && totals.done < totals.vehicles,
      summary,
      totals,
    }, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
