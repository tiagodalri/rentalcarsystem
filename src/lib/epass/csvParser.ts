// Parser de CSV exportado do portal E-Pass.
// O arquivo tem 2 secoes: "Account Activity" (descontos/pagamentos) e
// "Vehicle Activity" (pedagios atrelados a transponders).

export type EpassAccountRow = {
  account_number: string;
  date: string; // ISO yyyy-mm-dd
  posting_date: string;
  description: string;
  location: string;
  amount: number;
};

export type EpassTollRow = {
  transponder_number: string;
  date: string;          // yyyy-mm-dd
  time: string;          // HH:MM:SS
  toll_datetime: string; // ISO com offset NY
  posting_date: string;  // yyyy-mm-dd
  location: string;
  amount: number;
  toll_type: string;
  dedupe_hash: string;
};

export type EpassParseResult = {
  filename: string;
  account_number: string | null;
  period_label: string | null;
  account: EpassAccountRow[];
  tolls: EpassTollRow[];
  errors: { line: number; reason: string }[];
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// "1-May-26" => "2026-05-01"   |  "18-MAY-2026" => "2026-05-18"
export function parseEpassDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim().replace(/^"|"$/g, "");
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  let yy = m[3];
  if (yy.length === 2) yy = "20" + yy;
  return `${yy}-${mm}-${dd}`;
}

// Offset NY (EST -05:00 / EDT -04:00) para uma data ISO yyyy-mm-dd
function nyOffsetFor(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    }).formatToParts(d);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-5";
    const mm = tz.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
    if (!mm) return "-05:00";
    const sign = mm[1] === "+" ? "+" : "-";
    const h = mm[2].padStart(2, "0");
    const min = (mm[3] || "00").padStart(2, "0");
    return `${sign}${h}:${min}`;
  } catch {
    return "-05:00";
  }
}

function normalizeTime(t: string): string {
  // "16:18:44" ou "0:33:17"
  const s = t.trim().replace(/^"|"$/g, "");
  const parts = s.split(":");
  while (parts.length < 3) parts.push("00");
  return parts.map((p) => p.padStart(2, "0")).join(":");
}

async function hashString(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function parseEpassCsv(file: File): Promise<EpassParseResult> {
  // Roteia PDF para o pipeline OCR (Gemini); CSV continua no parser local.
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    return parseEpassPdf(file);
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const account: EpassAccountRow[] = [];
  const tolls: EpassTollRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  let section: "none" | "account" | "tolls" = "none";
  let accountNumber: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const lower = raw.toLowerCase();
    if (lower.startsWith("account activity")) { section = "account"; continue; }
    if (lower.startsWith("vehicle activity")) { section = "tolls"; continue; }
    if (lower.startsWith("account number,date")) continue;
    if (lower.startsWith("transponder number")) continue;

    const cells = splitCsvLine(raw);
    if (section === "account" && cells.length >= 6) {
      const acc = cells[0];
      const date = parseEpassDate(cells[1]);
      const posting = parseEpassDate(cells[2]);
      const amt = parseFloat(cells[5]);
      if (!date || isNaN(amt)) { errors.push({ line: i + 1, reason: "Data ou valor invalido" }); continue; }
      accountNumber = accountNumber || acc;
      account.push({
        account_number: acc,
        date,
        posting_date: posting || date,
        description: cells[3],
        location: cells[4],
        amount: amt,
      });
    } else if (section === "tolls" && cells.length >= 6) {
      const transponder = cells[0];
      const date = parseEpassDate(cells[1]);
      const time = normalizeTime(cells[2]);
      const posting = parseEpassDate(cells[3]);
      const amt = parseFloat(cells[5]);
      if (!transponder || !date || isNaN(amt)) {
        errors.push({ line: i + 1, reason: "Linha invalida" });
        continue;
      }
      const offset = nyOffsetFor(date);
      const toll_datetime = `${date}T${time}${offset}`;
      const hash = await hashString(`${transponder}|${toll_datetime}|${cells[4]}|${amt.toFixed(2)}`);
      tolls.push({
        transponder_number: transponder,
        date,
        time,
        toll_datetime,
        posting_date: posting || date,
        location: cells[4],
        amount: amt,
        toll_type: cells[6] || "",
        dedupe_hash: hash,
      });
    }
  }

  const periodMatch = file.name.match(/(\d{1,2})[_-](\d{4})/);
  const period_label = periodMatch ? `${periodMatch[1]}/${periodMatch[2]}` : null;

  return {
    filename: file.name,
    account_number: accountNumber,
    period_label,
    account,
    tolls,
    errors,
  };
}

// ===== PDF (OCR via edge function `epass-pdf-parse`) =====

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function parseEpassPdf(file: File): Promise<EpassParseResult> {
  const { supabase } = await import("@/integrations/supabase/client");
  const pdfBase64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("epass-pdf-parse", {
    body: { pdfBase64, filename: file.name },
  });
  if (error) throw new Error(error.message || "Falha ao processar PDF do E-Pass.");
  const payload = (data as any)?.data;
  const rawTolls: any[] = Array.isArray(payload?.tolls) ? payload.tolls : [];

  const tolls: EpassTollRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  for (let i = 0; i < rawTolls.length; i++) {
    const t = rawTolls[i];
    const transponder = String(t?.transponder_number || "").trim();
    const date: string = typeof t?.date === "string" ? t.date : "";
    const time = normalizeTime(typeof t?.time === "string" ? t.time : "00:00:00");
    const amt = typeof t?.amount === "number" ? t.amount : parseFloat(String(t?.amount ?? ""));
    const location = String(t?.location || "").trim();
    if (!transponder || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(amt)) {
      errors.push({ line: i + 1, reason: "Linha OCR inválida" });
      continue;
    }
    const offset = nyOffsetFor(date);
    const toll_datetime = `${date}T${time}${offset}`;
    const hash = await hashString(`${transponder}|${toll_datetime}|${location}|${amt.toFixed(2)}`);
    tolls.push({
      transponder_number: transponder,
      date,
      time,
      toll_datetime,
      posting_date: typeof t?.posting_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.posting_date) ? t.posting_date : date,
      location,
      amount: amt,
      toll_type: String(t?.toll_type || "").trim(),
      dedupe_hash: hash,
    });
  }

  const periodMatch = file.name.match(/(\d{1,2})[_-](\d{4})/);
  const period_label =
    (typeof payload?.period_label === "string" && payload.period_label) ||
    (periodMatch ? `${periodMatch[1]}/${periodMatch[2]}` : null);

  return {
    filename: file.name,
    account_number: typeof payload?.account_number === "string" ? payload.account_number : null,
    period_label,
    account: [],
    tolls,
    errors,
  };
}

export function mergeEpassResults(results: EpassParseResult[]): EpassParseResult {
  const seen = new Set<string>();
  const tolls: EpassTollRow[] = [];
  const account: EpassAccountRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  for (const r of results) {
    for (const t of r.tolls) {
      if (seen.has(t.dedupe_hash)) continue;
      seen.add(t.dedupe_hash);
      tolls.push(t);
    }
    account.push(...r.account);
    errors.push(...r.errors);
  }
  return {
    filename: results.map((r) => r.filename).join(", "),
    account_number: results.find((r) => r.account_number)?.account_number || null,
    period_label: results.find((r) => r.period_label)?.period_label || null,
    account,
    tolls,
    errors,
  };
}
