/**
 * Parser do CSV oficial da Turo (versão em português).
 * Detecta colunas pelos cabeçalhos, normaliza datas, valores e status.
 */
import Papa from "papaparse";
import { z } from "zod";

export type TuroStatus = "completed" | "in_progress" | "confirmed" | "cancelled" | "unknown";

export interface TuroRow {
  reservationId: string;
  guestName: string;
  vehicleFull: string;       // ex: "Bruno's Cadillac (FL #DZI3723)"
  vehicleModel: string;      // ex: "Cadillac Escalade ESV 2021"
  pickupDate: string;        // YYYY-MM-DD
  pickupTime: string | null; // HH:mm
  returnDate: string;        // YYYY-MM-DD
  returnTime: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  statusRaw: string;
  status: TuroStatus;
  totalEarnings: number | null;
  bookedAt: string | null; // ISO timestamp da data em que o cliente fez a reserva

}

/** Converte "US$ 1.234,56" → 1234.56, e "- US$ 46,55" → -46.55. */
export function parseTuroMoney(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const negative = /^-/.test(s) || s.includes("(");
  // Remove tudo que não é dígito, vírgula ou ponto
  let cleaned = s.replace(/[^\d.,-]/g, "").replace(/^-/, "");
  // Formato BR: ponto como milhar, vírgula como decimal → remove ponto, troca vírgula
  if (/,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Normaliza endereços conhecidos de aeroportos para nomes legíveis.
 * Detecta por palavras-chave do endereço (street/zipcode) e devolve
 * "Aeroporto MCO - Orlando International (KMCO)" ou similar.
 */
const AIRPORT_PATTERNS: { match: RegExp; label: string }[] = [
  // MCO - Orlando International (8810 Albury Drive, ZIP 32827)
  { match: /\b(8810\s+albury|orlando\s+international|\bmco\b|32827)/i, label: "Aeroporto MCO - Orlando International" },
  // SFB - Orlando Sanford International
  { match: /\b(sanford\s+international|\bsfb\b|orlando-sanford)/i, label: "Aeroporto SFB - Orlando Sanford" },
  // TPA - Tampa International
  { match: /\b(tampa\s+international|\btpa\b)/i, label: "Aeroporto TPA - Tampa International" },
  // FLL - Fort Lauderdale
  { match: /\b(fort\s+lauderdale.*international|\bfll\b)/i, label: "Aeroporto FLL - Fort Lauderdale" },
  // MIA - Miami International
  { match: /\b(miami\s+international|\bmia\b)/i, label: "Aeroporto MIA - Miami International" },
];

export function normalizeLocation(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  for (const { match, label } of AIRPORT_PATTERNS) {
    if (match.test(s)) return label;
  }
  return s;
}


/** Converte "2026-02-13 08:00 PM" → { date: "2026-02-13", time: "20:00" }. */
export function parseTuroDateTime(raw: string | undefined | null): { date: string | null; time: string | null } {
  if (!raw) return { date: null, time: null };
  const s = String(raw).trim();
  // padrão: YYYY-MM-DD HH:MM AM/PM
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (!m) return { date: null, time: null };
  const date = m[1];
  if (!m[2]) return { date, time: null };
  let h = parseInt(m[2], 10);
  const min = m[3];
  const ampm = (m[4] || "").toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { date, time: `${String(h).padStart(2, "0")}:${min}` };
}

export function mapTuroStatus(raw: string | undefined | null): TuroStatus {
  if (!raw) return "unknown";
  const s = String(raw).trim().toLowerCase();
  if (s.includes("conclu")) return "completed";
  if (s.includes("andamento") || s.includes("em viagem")) return "in_progress";
  if (s.includes("reserv")) return "confirmed";
  if (s.includes("cancel")) return "cancelled";
  return "unknown";
}

const HEADERS = {
  id: ["ID da reserva", "Reservation ID", "ID"],
  guest: ["Viajante", "Guest"],
  vehicleFull: ["Veículo", "Vehicle"],
  vehicleModel: ["Nome do veículo", "Vehicle name"],
  tripStart: ["Início da viagem", "Trip start"],
  tripEnd: ["Fim da viagem", "Trip end"],
  pickupLoc: ["Local de retirada", "Pickup location"],
  returnLoc: ["Local de devolução", "Return location"],
  status: ["Status da viagem", "Trip status", "Status"],
  earnings: ["Ganhos totais", "Total earnings"],
};

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

const TuroRowSchema = z.object({
  reservationId: z.string().min(1, "ID da reserva ausente"),
  guestName: z.string().min(1, "Viajante ausente"),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de retirada inválida"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de devolução inválida"),
});

export interface ParseResult {
  rows: TuroRow[];
  errors: { line: number; reason: string }[];
  totalLines: number;
}

export async function parseTuroCsv(file: File): Promise<ParseResult> {
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: { line: number; reason: string }[] = [];
  const rows: TuroRow[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((raw, idx) => {
    const line = idx + 2; // header + 1-indexed
    try {
      const id = pick(raw, HEADERS.id);
      if (!id) return; // linha vazia
      if (seen.has(id)) return; // dedupe dentro do arquivo
      seen.add(id);

      const tripStart = parseTuroDateTime(pick(raw, HEADERS.tripStart));
      const tripEnd = parseTuroDateTime(pick(raw, HEADERS.tripEnd));
      const statusRaw = pick(raw, HEADERS.status);
      const row: TuroRow = {
        reservationId: id,
        guestName: pick(raw, HEADERS.guest),
        vehicleFull: pick(raw, HEADERS.vehicleFull),
        vehicleModel: pick(raw, HEADERS.vehicleModel) || pick(raw, HEADERS.vehicleFull),
        pickupDate: tripStart.date || "",
        pickupTime: tripStart.time,
        returnDate: tripEnd.date || "",
        returnTime: tripEnd.time,
        pickupLocation: normalizeLocation(pick(raw, HEADERS.pickupLoc)) || null,
        returnLocation: normalizeLocation(pick(raw, HEADERS.returnLoc)) || null,
        statusRaw,
        status: mapTuroStatus(statusRaw),
        totalEarnings: parseTuroMoney(pick(raw, HEADERS.earnings)),
      };

      const check = TuroRowSchema.safeParse(row);
      if (!check.success) {
        errors.push({ line, reason: check.error.issues.map((i) => i.message).join("; ") });
        return;
      }
      rows.push(row);
    } catch (e: any) {
      errors.push({ line, reason: e?.message || "erro desconhecido" });
    }
  });

  return { rows, errors, totalLines: parsed.data.length };
}

/** Mescla resultados de múltiplos arquivos, deduplicando por reservationId. */
export function mergeParseResults(results: ParseResult[]): ParseResult {
  const merged: TuroRow[] = [];
  const seen = new Set<string>();
  const errors: { line: number; reason: string }[] = [];
  let total = 0;
  for (const r of results) {
    total += r.totalLines;
    errors.push(...r.errors);
    for (const row of r.rows) {
      if (seen.has(row.reservationId)) continue;
      seen.add(row.reservationId);
      merged.push(row);
    }
  }
  return { rows: merged, errors, totalLines: total };
}
