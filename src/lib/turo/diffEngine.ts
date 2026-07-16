/**
 * Motor de diff/merge inteligente entre linhas do CSV Turo e reservas no banco.
 *
 * Regras críticas:
 *  - Match exclusivo por turo_reservation_id (jamais por nome/data)
 *  - Nunca sobrescreve dado preenchido manualmente sem opt-in do usuário
 *  - Auto-marca campos só quando o destino está vazio OU quando o status avança naturalmente
 *  - Soft fields (notes, phone, email) nunca são auto-marcados
 */
import type { TuroRow, TuroStatus } from "./csvParser";

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "pending_payment";

/** Snapshot da reserva existente no banco (somente campos relevantes). */
export interface BookingSnapshot {
  id: string;
  booking_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_id: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: BookingStatus;
  payment_status: string;
  deleted_at: string | null;
  addons: Record<string, any> | null;
}

export type ClassificationKind =
  | "new"            // não existe → criar
  | "enrich"         // existe, há campos a atualizar
  | "identical"      // existe e está em dia
  | "cancelled_csv"  // CSV diz cancelada
  | "unmapped"       // veículo não mapeado → bloqueia inserção
  | "invalid";       // dados insuficientes

export interface FieldDiff {
  field: keyof BookingSnapshot;
  label: string;
  currentValue: any;
  newValue: any;
  autoSelected: boolean; // marcado por padrão?
  protected: boolean;    // soft field: sempre opt-in
  reason: string;        // explicação curta
}

export interface Classification {
  kind: ClassificationKind;
  row: TuroRow;
  existing?: BookingSnapshot;
  vehicleId?: string | null;          // resolvido via mapping
  diffs: FieldDiff[];                 // somente em enrich
  selected: boolean;                  // marcado para aplicar
  selectedFields: Set<keyof BookingSnapshot>; // campos marcados em enrich
}

// Ordem natural do ciclo de vida (índices maiores = mais avançado).
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  pending_payment: 0,
  confirmed: 1,
  in_progress: 2,
  active: 2,
  completed: 3,
  cancelled: -1,
};

function statusFromTuro(s: TuroStatus): BookingStatus | null {
  if (s === "completed") return "completed";
  if (s === "in_progress") return "in_progress";
  if (s === "confirmed") return "confirmed";
  if (s === "cancelled") return "cancelled";
  return null;
}

function statusAdvanced(current: string, next: string): boolean {
  if (next === "cancelled") return false; // cancelamento tratado à parte
  return (STATUS_RANK[next] ?? -99) > (STATUS_RANK[current] ?? -99);
}

function isEmpty(field: string, v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "") return true;
    if ((field === "pickup_location" || field === "return_location") && (s === "(casa/endereço)" || s === "casa/endereço")) return true;
  }
  // Em imports antigos, total_price = 0 foi usado como valor ausente.
  return field === "total_price" && v === 0;
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  total_price: "Valor total",
  pickup_date: "Data de retirada",
  return_date: "Data de devolução",
  pickup_time: "Hora de retirada",
  return_time: "Hora de devolução",
  pickup_location: "Local de retirada",
  return_location: "Local de devolução",
  customer_name: "Nome do cliente",
};

const PROTECTED_FIELDS: Set<string> = new Set([
  "customer_name", // só auto-marca se estiver vazio
]);

/** Normaliza valores por tipo para comparação robusta (evita "13:00" != "13:00:00"). */
function normalizeForCompare(field: string, v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s === "") return "";
  if (field === "pickup_time" || field === "return_time") {
    // "13:00:00" → "13:00"; "13:00" → "13:00"
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
    return s;
  }
  if (field === "pickup_date" || field === "return_date") {
    // ISO date possivelmente com timestamp → YYYY-MM-DD
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  }
  if (field === "total_price") {
    const n = typeof v === "number" ? v : parseFloat(s);
    return isFinite(n) ? n.toFixed(2) : s;
  }
  if (field === "pickup_location" || field === "return_location" || field === "customer_name") {
    const normalized = s.replace(/\s+/g, " ").replace(/\./g, "").toLowerCase();
    if (field === "pickup_location" || field === "return_location") {
      if (normalized === "(casa/endereço)" || normalized === "casa/endereço") return "";
      // Qualquer variação do MCO/Orlando International colapsa para o mesmo token.
      // Cobre: "MCO", "Aeroporto MCO - Orlando", "Orlando International Airport",
      // "Orlando Intl Airport", "Jeff Fuqua Blvd", "MCO Orlando", "Aeroporto MCO" etc.
      if (
        /\bmco\b/.test(normalized) ||
        normalized.includes("orlando international") ||
        normalized.includes("orlando intl") ||
        normalized.includes("orlando airport") ||
        normalized.includes("aeroporto orlando") ||
        normalized.includes("jeff fuqua")
      ) return "mco-orlando";
    }
    return normalized;
  }
  return s;
}

/**
 * Campos onde a Turo é a fonte de verdade: auto-marca sempre que divergir,
 * mesmo se o campo no banco já estiver preenchido. Esses dados podem mudar
 * na Turo (extensão/redução de viagem, ajuste de valor pós-viagem) e o sistema
 * precisa refletir isso sem opt-in manual.
 */
const TURO_AUTHORITATIVE_FIELDS: Set<string> = new Set([
  "pickup_date",
  "return_date",
  "pickup_time",
  "return_time",
  "total_price",
]);

function buildDiff(field: keyof BookingSnapshot, current: any, next: any, opts: { allowAutoIfEmpty?: boolean; reason?: string } = {}): FieldDiff | null {
  if (next === null || next === undefined || next === "") return null;
  // Comparação normalizada por tipo (cobre "13:00" vs "13:00:00", price 127.29 vs "127.29", etc.)
  if (normalizeForCompare(String(field), current) === normalizeForCompare(String(field), next)) return null;
  const currentEmpty = isEmpty(String(field), current);
  const isProtected = PROTECTED_FIELDS.has(String(field));
  if (isProtected && !currentEmpty) return null;
  const isAuthoritative = TURO_AUTHORITATIVE_FIELDS.has(String(field));
  const autoSelected = isAuthoritative || (currentEmpty && (opts.allowAutoIfEmpty ?? true));
  return {
    field,
    label: FIELD_LABELS[String(field)] || String(field),
    currentValue: current,
    newValue: next,
    autoSelected,
    protected: isProtected,
    reason: opts.reason || (isAuthoritative && !currentEmpty ? "Turo é fonte de verdade .  alteração detectada" : currentEmpty ? "Campo vazio no sistema" : "Divergência com CSV"),
  };
}

export interface ClassifyOptions {
  /** Mapa turo_vehicle_name (modelo) → vehicle_id */
  vehicleMapping: Map<string, string>;
  /** Reservas existentes indexadas por turo_reservation_id */
  existingByTuroId: Map<string, BookingSnapshot>;
}

export function classifyRow(row: TuroRow, opts: ClassifyOptions): Classification {
  const existing = opts.existingByTuroId.get(row.reservationId);
  const vehicleId = opts.vehicleMapping.get(row.vehicleModel.trim()) || null;

  // CSV cancelada
  if (row.status === "cancelled") {
    if (!existing || existing.deleted_at) {
      // Sem veículo mapeado → bloqueia (mesma regra das novas)
      if (!vehicleId) {
        return { kind: "unmapped", row, vehicleId: null, diffs: [], selected: false, selectedFields: new Set() };
      }
      if (!row.pickupDate || !row.returnDate) {
        return { kind: "invalid", row, vehicleId, diffs: [], selected: false, selectedFields: new Set() };
      }
      // Auto-seleciona: cancelada vai entrar no sistema marcada como cancelada
      return {
        kind: "cancelled_csv",
        row,
        vehicleId,
        diffs: [],
        selected: true,
        selectedFields: new Set(),
      };
    }
    // Existe → talvez precise atualizar status / valor
    const diffs: FieldDiff[] = [];
    if (existing.status !== "cancelled") {
      diffs.push({
        field: "status",
        label: FIELD_LABELS.status,
        currentValue: existing.status,
        newValue: "cancelled",
        autoSelected: true,
        protected: false,
        reason: "CSV marca como cancelada",
      });
    }
    // Atualiza valor se divergente (cancelamento pode ter ganho residual ou zerar)
    const totalDiff = buildDiff("total_price", existing.total_price, row.totalEarnings, {
      reason: "Valor pós-cancelamento conforme CSV",
    });
    if (totalDiff) {
      diffs.push({ ...totalDiff, autoSelected: true });
    }
    if (diffs.length === 0) {
      return { kind: "identical", row, existing, vehicleId, diffs: [], selected: false, selectedFields: new Set() };
    }
    return {
      kind: "enrich",
      row,
      existing,
      vehicleId,
      diffs,
      selected: true,
      selectedFields: new Set(diffs.filter((d) => d.autoSelected).map((d) => d.field)),
    };
  }

  // Novo registro
  if (!existing || existing.deleted_at) {
    if (!vehicleId) {
      return {
        kind: "unmapped",
        row,
        vehicleId: null,
        diffs: [],
        selected: false,
        selectedFields: new Set(),
      };
    }
    if (!row.pickupDate || !row.returnDate) {
      return { kind: "invalid", row, vehicleId, diffs: [], selected: false, selectedFields: new Set() };
    }
    return {
      kind: "new",
      row,
      vehicleId,
      diffs: [],
      selected: true,
      selectedFields: new Set(),
    };
  }

  // Existe → compara campo a campo
  const diffs: FieldDiff[] = [];

  const newStatus = statusFromTuro(row.status);
  if (newStatus && newStatus !== existing.status) {
    const advanced = statusAdvanced(existing.status, newStatus);
    if (advanced) {
      diffs.push({
        field: "status",
        label: FIELD_LABELS.status,
        currentValue: existing.status,
        newValue: newStatus,
        autoSelected: true,
        protected: false,
        reason: `Status avançou (${existing.status} → ${newStatus})`,
      });
    } else {
      // regressão de status → mostra mas não auto-marca
      diffs.push({
        field: "status",
        label: FIELD_LABELS.status,
        currentValue: existing.status,
        newValue: newStatus,
        autoSelected: false,
        protected: true,
        reason: "Status regrediria .  confirme manualmente",
      });
    }
  }

  const totalDiff = buildDiff("total_price", existing.total_price, row.totalEarnings, {
    reason: existing.total_price ? "Valor diferente do CSV" : "Sem valor no sistema",
  });
  if (totalDiff) diffs.push(totalDiff);

  const pickupDiff = buildDiff("pickup_date", existing.pickup_date, row.pickupDate);
  if (pickupDiff) diffs.push(pickupDiff);
  const returnDiff = buildDiff("return_date", existing.return_date, row.returnDate);
  if (returnDiff) diffs.push(returnDiff);

  const ptDiff = buildDiff("pickup_time", existing.pickup_time, row.pickupTime);
  if (ptDiff) diffs.push(ptDiff);
  const rtDiff = buildDiff("return_time", existing.return_time, row.returnTime);
  if (rtDiff) diffs.push(rtDiff);

  const ploc = buildDiff("pickup_location", existing.pickup_location, row.pickupLocation);
  if (ploc) diffs.push(ploc);
  const rloc = buildDiff("return_location", existing.return_location, row.returnLocation);
  if (rloc) diffs.push(rloc);

  const nameDiff = buildDiff("customer_name", existing.customer_name, row.guestName, {
    reason: existing.customer_name ? "Nome diferente .  confirme manualmente" : "Sem nome no sistema",
  });
  if (nameDiff) diffs.push(nameDiff);

  if (diffs.length === 0) {
    return { kind: "identical", row, existing, vehicleId, diffs: [], selected: false, selectedFields: new Set() };
  }

  const selectedFields = new Set<keyof BookingSnapshot>(diffs.filter((d) => d.autoSelected).map((d) => d.field));
  return {
    kind: "enrich",
    row,
    existing,
    vehicleId,
    diffs,
    selected: selectedFields.size > 0,
    selectedFields,
  };
}

export interface Summary {
  total: number;
  newCount: number;
  enrichCount: number;
  identicalCount: number;
  cancelledCount: number;
  unmappedCount: number;
  invalidCount: number;
}

export function summarize(classifications: Classification[]): Summary {
  const s: Summary = { total: classifications.length, newCount: 0, enrichCount: 0, identicalCount: 0, cancelledCount: 0, unmappedCount: 0, invalidCount: 0 };
  for (const c of classifications) {
    if (c.kind === "new") s.newCount++;
    else if (c.kind === "enrich") s.enrichCount++;
    else if (c.kind === "identical") s.identicalCount++;
    else if (c.kind === "cancelled_csv") s.cancelledCount++;
    else if (c.kind === "unmapped") s.unmappedCount++;
    else if (c.kind === "invalid") s.invalidCount++;
  }
  return s;
}
