// Filtro global de origem das reservas usado pelo AI Studio (Painel + Simulador)
// Persistido em localStorage para que a escolha feita no painel principal valha
// também na página dedicada do simulador.

export type BookingSource = "all" | "zeus" | "turo";

export const BOOKING_SOURCE_KEY = "zeus_booking_source";

export function readBookingSource(): BookingSource {
  try {
    const v = localStorage.getItem(BOOKING_SOURCE_KEY);
    if (v === "zeus" || v === "turo" || v === "all") return v;
  } catch {}
  return "all";
}

export function writeBookingSource(s: BookingSource) {
  try { localStorage.setItem(BOOKING_SOURCE_KEY, s); } catch {}
}

type SrcBooking = {
  stripe_session_id?: string | null;
  turo_reservation_code?: string | null;
};

export function isTuroBooking(b: SrcBooking): boolean {
  return !!b.turo_reservation_code;
}

export function isZeusBooking(b: SrcBooking): boolean {
  // Tudo que não é Turo é considerado reserva particular Zeus
  // (vendas via Câmbio Real no site + reservas manuais criadas pelo admin).
  return !b.turo_reservation_code;
}

export function filterBookingsBySource<T extends SrcBooking>(
  list: T[],
  source: BookingSource,
): T[] {
  if (source === "all") return list;
  if (source === "turo") return list.filter(isTuroBooking);
  return list.filter(isZeusBooking);
}

export const SOURCE_LABEL: Record<BookingSource, string> = {
  all: "Todas as reservas",
  zeus: "Zeus particular",
  turo: "Turo",
};
