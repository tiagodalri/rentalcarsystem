import { useCallback, useEffect, useMemo, useState } from "react";
import { startOfDay } from "date-fns";
import { ArrowLeft, Brain, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FleetSimulator from "@/components/admin/ai-studio/FleetSimulator";
import AiPainel from "@/pages/admin/AiPainel";
import {
  computePerVehicle,
  type PvVehicle,
  type PvBooking,
  type PvExpense,
} from "@/lib/aiStudio/perVehicle";
import {
  filterBookingsBySource,
  readBookingSource,
  writeBookingSource,
  SOURCE_LABEL,
  type BookingSource,
} from "@/lib/aiStudio/bookingSource";

type Props = {
  onBack?: () => void;
  bookingSource?: BookingSource;
  /** Se true, esconde o header interno (usado quando o wrapper já renderiza título/seletor). */
  hideHeader?: boolean;
};

/**
 * Frota Inteligente — união COMPLETA do Hall Estratégico (AiPainel) + Simulador.
 * Auto-suficiente: carrega bookings/vehicles/expenses e computa perVehicle.
 * Aceita bookingSource controlado externamente (overlay do Brain) ou gerencia
 * seletor local (rota standalone via sidebar).
 */
export default function FrotaInteligente({
  onBack,
  bookingSource: bookingSourceProp,
  hideHeader = false,
}: Props) {
  const [bookings, setBookings] = useState<PvBooking[]>([]);
  const [vehicles, setVehicles] = useState<PvVehicle[]>([]);
  const [expenses, setExpenses] = useState<PvExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Origem: se veio por prop, é controlada; senão, gerencia localmente com persistência.
  const [localSource, setLocalSource] = useState<BookingSource>(() => readBookingSource());
  const bookingSource = bookingSourceProp ?? localSource;
  const showLocalSelector = bookingSourceProp === undefined && !hideHeader;
  useEffect(() => {
    if (bookingSourceProp === undefined) writeBookingSource(localSource);
  }, [localSource, bookingSourceProp]);

  const load = useCallback(async () => {
    // Bookings: paginado em lotes de 1000 para trazer TODAS as reservas
    // (Supabase limita cada request a ~1000 linhas). Sem isso, a receita
    // aparece truncada enquanto as despesas somam a frota inteira e a
    // margem fica artificialmente negativa.
    const bookingCols = "id, status, pickup_date, return_date, total_price, vehicle_id, customer_name, customer_id, stripe_session_id, turo_reservation_code, created_at, cancelled_at, payment_status";
    const allBookings: PvBooking[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 20000; from += pageSize) {
      const { data, error } = await supabase
        .from("bookings")
        .select(bookingCols)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) break;
      const page = (data as PvBooking[]) || [];
      allBookings.push(...page);
      if (page.length < pageSize) break;
    }

    const [v, e] = await Promise.all([
      supabase.from("vehicles")
        .select("id, name, status, color, daily_price_usd, purchase_price, acquired_date, category, brand, model")
        .is("deleted_at", null),
      supabase.from("vehicle_expenses")
        .select("vehicle_id, amount, expense_date, type"),
    ]);
    setBookings(allBookings);
    setVehicles((v.data as PvVehicle[]) || []);
    setExpenses((e.data as PvExpense[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const sourceFilteredBookings = useMemo(
    () => filterBookingsBySource(bookings, bookingSource),
    [bookings, bookingSource],
  );
  const realBookings = useMemo(
    () => sourceFilteredBookings.filter(b => b.status !== "cancelled"),
    [sourceFilteredBookings],
  );
  const perVehicle = useMemo(
    () => computePerVehicle(vehicles, realBookings, expenses, today),
    [vehicles, realBookings, expenses, today],
  );

  return (
    <div className="px-3 sm:px-4 lg:px-6 pb-10 overflow-x-hidden">
      {!hideHeader && (
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 pt-2 pb-4 sm:pb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full transition-all active:scale-95 shrink-0"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(13,29,46,0.14)",
                color: "#0d1d2e",
                boxShadow: "0 4px 12px -6px rgba(13,29,46,0.25)",
              }}
              aria-label="Voltar"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: "rgba(13,29,46,0.55)" }}
            >
              Inteligência de frota
            </div>
            <h1
              className="text-[20px] sm:text-[26px] leading-tight font-bold tracking-[-0.025em] mt-0.5"
              style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
            >
              Frota Inteligente
            </h1>
          </div>

          {showLocalSelector && (
            <div
              role="tablist"
              aria-label="Origem das reservas"
              className="hidden sm:inline-flex items-center gap-1 p-1 rounded-full shrink-0"
              style={{
                background: "rgba(13,29,46,0.05)",
                border: "1px solid rgba(13,29,46,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              {(["all", "zeus", "turo"] as const).map((s) => {
                const active = localSource === s;
                return (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setLocalSource(s)}
                    className="relative inline-flex items-center justify-center px-3 h-7 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] transition-all whitespace-nowrap"
                    style={
                      active
                        ? {
                            background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                            color: "#f3e6c4",
                            boxShadow: "0 6px 14px -8px rgba(13,29,46,0.55), 0 0 0 1px rgba(154,122,58,0.45)",
                          }
                        : { color: "rgba(13,29,46,0.60)" }
                    }
                  >
                    {SOURCE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile selector (quando standalone) */}
      {showLocalSelector && (
        <div className="max-w-[1600px] mx-auto sm:hidden flex justify-center mb-4">
          <div
            role="tablist"
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: "rgba(13,29,46,0.05)",
              border: "1px solid rgba(13,29,46,0.10)",
            }}
          >
            {(["all", "zeus", "turo"] as const).map((s) => {
              const active = localSource === s;
              return (
                <button
                  key={s}
                  onClick={() => setLocalSource(s)}
                  className="px-3 h-7 rounded-full text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap"
                  style={
                    active
                      ? {
                          background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                          color: "#f3e6c4",
                        }
                      : { color: "rgba(13,29,46,0.60)" }
                  }
                >
                  {SOURCE_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bloco 1. Painel de inteligência COMPLETO (briefing + todas as métricas) */}
      <section aria-label="Painel de inteligência" className="mb-6">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 mb-2 px-1">
          <Brain size={14} style={{ color: "#9a7a3a" }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>
            Painel de inteligência
          </span>
        </div>
        <AiPainel
          bookings={sourceFilteredBookings as any}
          vehicles={vehicles as any}
        />
      </section>

      {/* Divisor dourado */}
      <div
        className="max-w-[1600px] mx-auto h-[1px] my-6"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(154,122,58,0.45) 30%, rgba(154,122,58,0.65) 50%, rgba(154,122,58,0.45) 70%, transparent)",
        }}
      />

      {/* Bloco 2. Simulador */}
      <section aria-label="Simulador de realocação" className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Gamepad2 size={14} style={{ color: "#9a7a3a" }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>
            Simulador de realocação
          </span>
        </div>
        {loading ? (
          <div
            className="rounded-2xl p-10 text-center text-[13px]"
            style={{
              background: "#fbf7ee",
              border: "1px solid rgba(13,29,46,0.10)",
              color: "rgba(13,29,46,0.60)",
            }}
          >
            Carregando dados da frota…
          </div>
        ) : (
          <FleetSimulator perVehicle={perVehicle as any} />
        )}
      </section>
    </div>
  );
}
