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

const DATE_TOKEN = String.raw`(?:\d{1,2}[-/\s][A-Za-z]{3,9}[-/,\s]+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})`;
const TIME_TOKEN = String.raw`(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)`;

// "1-May-26" => "2026-05-01"   |  "18-MAY-2026" => "2026-05-18"
export function parseEpassDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim().replace(/^"|"$/g, "").replace(/,/g, "").replace(/\s+/g, " ");

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const monthName = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/);
  if (monthName) {
    const dd = monthName[1].padStart(2, "0");
    const mm = MONTHS[monthName[2].slice(0, 3).toLowerCase()];
    if (!mm) return null;
    let yy = monthName[3];
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm}-${dd}`;
  }

  const monthFirst = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{2,4})$/);
  if (monthFirst) {
    const mm = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (!mm) return null;
    const dd = monthFirst[2].padStart(2, "0");
    let yy = monthFirst[3];
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${mm}-${dd}`;
  }

  const numeric = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    const month = a > 12 ? b : a; // E-Pass é EUA: MM/DD/YYYY; se o primeiro passar de 12, assume DD/MM.
    const day = a > 12 ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let yy = numeric[3];
    if (yy.length === 2) yy = "20" + yy;
    return `${yy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

// Offset NY (EST -05:00 / EDT -04:00) para uma data ISO yyyy-mm-dd
const nyOffsetCache = new Map<string, string>();
const nyOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "shortOffset",
});

function nyOffsetFor(isoDate: string): string {
  const cached = nyOffsetCache.get(isoDate);
  if (cached) return cached;
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const parts = nyOffsetFormatter.formatToParts(d);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-5";
    const mm = tz.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
    if (!mm) return "-05:00";
    const sign = mm[1] === "+" ? "+" : "-";
    const h = mm[2].padStart(2, "0");
    const min = (mm[3] || "00").padStart(2, "0");
    const offset = `${sign}${h}:${min}`;
    nyOffsetCache.set(isoDate, offset);
    return offset;
  } catch {
    return "-05:00";
  }
}

function normalizeTime(t: string): string {
  // "16:18:44", "0:33:17", "4:18 PM".
  const s = t.trim().replace(/^"|"$/g, "");
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return "00:00:00";
  let h = parseInt(m[1], 10);
  const ampm = m[4]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}:${(m[3] || "00").padStart(2, "0")}`;
}

// Hash sincrono e estavel (FNV-1a 64-bit em hex). Suficiente pra deduplicar
// transponder|datetime|location|valor — evitamos centenas de awaits em
// crypto.subtle.digest, que era a causa real da lentidao no E-Pass.
function hashString(s: string): string {
  let h1 = 0xcbf29ce4 >>> 0;
  let h2 = 0x84222325 >>> 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c >>> 4) | (c << 4)), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function splitDelimitedLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (ch === delimiter && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function splitBestDelimitedLine(line: string): string[] {
  const candidates = [",", "\t", ";", "|"];
  let best = splitDelimitedLine(line, ",");
  for (const delimiter of candidates.slice(1)) {
    if (!line.includes(delimiter)) continue;
    const cells = splitDelimitedLine(line, delimiter);
    if (cells.length > best.length) best = cells;
  }
  return best;
}

function parseAmount(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const negative = /^\(|^-/.test(raw);
  let s = raw.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  if (/^\d+,\d{2}$/.test(raw.trim())) s = raw.trim().replace(",", ".");
  const value = parseFloat(s.replace(/[^0-9.-]/g, ""));
  if (isNaN(value)) return null;
  return negative ? -Math.abs(value) : value;
}

function looksLikeTollCells(cells: string[]): boolean {
  return cells.length >= 5 && /^\d{4,}$/.test(cells[0]?.replace(/\D/g, "") || "") && !!parseEpassDate(cells[1] || "") && /^\d{1,2}:\d{2}/.test((cells[2] || "").trim());
}

function buildTollRow(
  transponder: string,
  date: string,
  time: string,
  postingDate: string | null,
  location: string,
  amount: number,
  tollType: string,
): EpassTollRow {
  const normalizedTime = normalizeTime(time);
  const offset = nyOffsetFor(date);
  const toll_datetime = `${date}T${normalizedTime}${offset}`;
  const cleanLocation = location.trim().replace(/^"|"$/g, "");
  const hash = hashString(`${transponder}|${toll_datetime}|${cleanLocation}|${amount.toFixed(2)}`);
  return {
    transponder_number: transponder,
    date,
    time: normalizedTime,
    toll_datetime,
    posting_date: postingDate || date,
    location: cleanLocation,
    amount,
    toll_type: tollType.trim().replace(/^"|"$/g, ""),
    dedupe_hash: hash,
  };
}

function parseTollCells(cells: string[]): EpassTollRow | null {
  if (!looksLikeTollCells(cells)) return null;
  const transponder = cells[0].replace(/\D/g, "");
  const date = parseEpassDate(cells[1]);
  const posting = parseEpassDate(cells[3] || "") || date;
  if (!transponder || !date) return null;

  let amountIndex = -1;
  let amount: number | null = null;
  for (let i = cells.length - 1; i >= 4; i--) {
    const parsed = parseAmount(cells[i]);
    if (parsed !== null) {
      amountIndex = i;
      amount = parsed;
      break;
    }
  }
  if (amountIndex < 0 || amount === null) return null;

  const location = cells.slice(4, amountIndex).join(" ").trim();
  const tollType = cells.slice(amountIndex + 1).join(" ").trim();
  return buildTollRow(transponder, date, cells[2], posting, location, Math.abs(amount), tollType);
}

function parseTollTextLine(raw: string): EpassTollRow | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!/^"?\d{4,}"?\s/.test(line)) return null;
  const re = new RegExp(`^"?(\\d{4,})"?\\s+(${DATE_TOKEN})\\s+(${TIME_TOKEN})\\s+(${DATE_TOKEN})\\s+(.+)$`, "i");
  const match = line.match(re);
  if (!match) return null;

  const date = parseEpassDate(match[2]);
  const posting = parseEpassDate(match[4]) || date;
  if (!date) return null;

  const rest = match[5].trim();
  const amountMatches = Array.from(rest.matchAll(/\$?\(?-?\d{1,4}(?:[.,]\d{2})\)?/g));
  if (amountMatches.length === 0) return null;
  const amountMatch = amountMatches[amountMatches.length - 1];
  const amount = parseAmount(amountMatch[0]);
  if (amount === null) return null;

  const amountStart = amountMatch.index ?? 0;
  const amountEnd = amountStart + amountMatch[0].length;
  const location = rest.slice(0, amountStart).trim();
  const tollType = rest.slice(amountEnd).trim();
  return buildTollRow(match[1], date, match[3], posting, location, Math.abs(amount), tollType);
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
    const lower = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (lower.startsWith("account activity") || lower.includes(" account activity")) { section = "account"; continue; }
    if (lower.startsWith("vehicle activity") || lower.includes(" vehicle activity")) { section = "tolls"; continue; }
    if (lower.startsWith("account number,date") || lower.startsWith("account number date")) continue;
    if (lower.startsWith("transponder number") || lower.startsWith("transponder #") || lower.includes("transponder number date time")) {
      section = "tolls";
      continue;
    }

    const cells = splitBestDelimitedLine(raw);
    if (section === "account" && cells.length >= 6) {
      const acc = cells[0];
      const date = parseEpassDate(cells[1]);
      const posting = parseEpassDate(cells[2]);
      const amt = parseAmount(cells[5]);
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
      continue;
    }

    const tollFromCells = parseTollCells(cells);
    const tollFromText = tollFromCells || parseTollTextLine(raw);
    if (tollFromText) {
      tolls.push(tollFromText);
    } else if (section === "tolls" && /^"?\d{4,}"?/.test(raw.trim())) {
      errors.push({ line: i + 1, reason: "Linha invalida" });
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
        errors.push({ line: i + 1, reason: "Linha invalida" });
        continue;
      }
    tolls.push(buildTollRow(
      transponder,
      date,
      time,
      typeof t?.posting_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.posting_date) ? t.posting_date : date,
      location,
      Math.abs(amt),
      String(t?.toll_type || "").trim(),
    ));
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
