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
import { filterBookingsBySource, type BookingSource } from "@/lib/aiStudio/bookingSource";

type Props = {
  onBack: () => void;
  bookingSource: BookingSource;
};

/**
 * Frota Inteligente — seção unificada do AI Studio.
 * Reúne o Briefing de IA narrado (topo) e o Simulador de realocação (abaixo)
 * em uma única tela, sem duplicar cálculos.
 */
export default function FrotaInteligente({ onBack, bookingSource }: Props) {
  const [bookings, setBookings] = useState<PvBooking[]>([]);
  const [vehicles, setVehicles] = useState<PvVehicle[]>([]);
  const [expenses, setExpenses] = useState<PvExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [b, v, e] = await Promise.all([
      supabase.from("bookings")
        .select("id, status, pickup_date, return_date, total_price, vehicle_id, customer_name, customer_id, stripe_session_id, turo_reservation_code, created_at, cancelled_at, payment_status")
        .limit(2000),
      supabase.from("vehicles")
        .select("id, name, status, color, daily_price_usd, purchase_price, acquired_date, category, brand, model")
        .is("deleted_at", null),
      supabase.from("vehicle_expenses")
        .select("vehicle_id, amount, expense_date, type"),
    ]);
    setBookings((b.data as PvBooking[]) || []);
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
      {/* Cabeçalho da seção */}
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 pt-2 pb-4 sm:pb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full transition-all active:scale-95 shrink-0"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(13,29,46,0.14)",
            color: "#0d1d2e",
            boxShadow: "0 4px 12px -6px rgba(13,29,46,0.25)",
          }}
          aria-label="Voltar ao AI Studio"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="min-w-0">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.32em]"
            style={{ color: "rgba(13,29,46,0.55)" }}
          >
            AI Studio
          </div>
          <h1
            className="text-[20px] sm:text-[24px] leading-tight font-light tracking-[-0.01em] mt-0.5"
            style={{ color: "#0d1d2e", fontFamily: "'Cormorant Garamond', 'Inter', serif" }}
          >
            Frota Inteligente
          </h1>
        </div>
      </div>

      {/* Bloco 1 — Briefing narrado */}
      <section aria-label="Briefing de IA" className="mb-6">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 mb-2 px-1">
          <Brain size={14} style={{ color: "#9a7a3a" }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(13,29,46,0.55)" }}>
            Briefing narrado
          </span>
        </div>
        <AiPainel
          bookings={sourceFilteredBookings as any}
          vehicles={vehicles as any}
          briefingOnly
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

      {/* Bloco 2 — Simulador */}
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
