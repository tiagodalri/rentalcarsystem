import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FleetSimulator from "@/components/admin/ai-studio/FleetSimulator";
import {
  computePerVehicle,
  type PvVehicle,
  type PvBooking,
  type PvExpense,
} from "@/lib/aiStudio/perVehicle";
import {
  type BookingSource,
  readBookingSource,
  writeBookingSource,
  filterBookingsBySource,
  SOURCE_LABEL,
} from "@/lib/aiStudio/bookingSource";

export default function AiSimulador() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<PvBooking[]>([]);
  const [vehicles, setVehicles] = useState<PvVehicle[]>([]);
  const [expenses, setExpenses] = useState<PvExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingSource, setBookingSource] = useState<BookingSource>(() => readBookingSource());
  useEffect(() => { writeBookingSource(bookingSource); }, [bookingSource]);

  // Pinta o topo do admin shell (tabs + header + barra de utilitários) com o mesmo
  // ivory do simulador, eliminando a faixa branca acima da página.
  useEffect(() => {
    document.body.classList.add("simulator-immersive-top");
    return () => { document.body.classList.remove("simulator-immersive-top"); };
  }, []);

  const load = useCallback(async () => {
    const [b, v, e] = await Promise.all([
      supabase.from("bookings")
        .select("id, status, pickup_date, return_date, total_price, vehicle_id, customer_name, customer_id, stripe_session_id, turo_reservation_code")
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
  const sourceFiltered = useMemo(
    () => filterBookingsBySource(bookings, bookingSource),
    [bookings, bookingSource],
  );
  const realBookings = useMemo(
    () => sourceFiltered.filter(b => b.status !== "cancelled"),
    [sourceFiltered],
  );
  const perVehicle = useMemo(
    () => computePerVehicle(vehicles, realBookings, expenses, today),
    [vehicles, realBookings, expenses, today],
  );


  return (
    <div
      className="relative -mx-4 lg:-mx-6 -mt-3 lg:-mt-6 min-h-[calc(100vh-80px)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)",
      }}
    >
      {/* Header dedicado. integrado ao topo do admin shell */}
      <div
        className="relative"
        style={{
          paddingTop: "max(16px, env(safe-area-inset-top))",
          background:
            "linear-gradient(180deg, #f6f1e6 0%, rgba(246,241,230,0.0) 100%)",
        }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate("/admin")}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 shrink-0"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(13,29,46,0.14)",
                color: "#0d1d2e",
                boxShadow: "0 4px 12px -6px rgba(13,29,46,0.25)",
              }}
              aria-label="Voltar ao painel"
            >
              <ArrowLeft size={16} />
            </button>

            <div
              className="text-[10px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: "rgba(13,29,46,0.55)" }}
            >
              AI Studio
            </div>
          </div>

          {/* Source selector. centralizado na mesma linha */}
          <div className="flex-1 flex justify-center">
            <div
              role="tablist"
              aria-label="Origem das reservas"
              className="inline-flex items-center gap-1 p-[3px] rounded-full"
              style={{
                background: "rgba(13,29,46,0.05)",
                border: "1px solid rgba(13,29,46,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              {(["all", "zeus", "turo"] as const).map((s) => {
                const active = bookingSource === s;
                return (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBookingSource(s)}
                    className="relative inline-flex items-center justify-center px-3 sm:px-3.5 h-7 rounded-full text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] transition-all whitespace-nowrap"
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
          </div>

          <div
            className="hidden md:block flex-1 text-[11px] text-right tabular-nums"
            style={{ color: "rgba(13,29,46,0.55)" }}
          >
            {perVehicle.length} carros · {realBookings.length} reservas
          </div>
        </div>
        {/* hairline gold accent */}
        <div
          className="h-[1px] mx-4 sm:mx-6 lg:mx-8 max-w-[1600px] xl:mx-auto"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(154,122,58,0.45) 30%, rgba(154,122,58,0.65) 50%, rgba(154,122,58,0.45) 70%, transparent)",
          }}
        />
      </div>


      {/* Conteúdo */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 pt-5 sm:pt-7 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
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
      </div>
    </div>
  );
}
