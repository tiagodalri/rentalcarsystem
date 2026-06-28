import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay } from "date-fns";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FleetSimulator from "@/components/admin/zeus-brain/FleetSimulator";
import {
  computePerVehicle,
  type PvVehicle,
  type PvBooking,
  type PvExpense,
} from "@/lib/zeusBrain/perVehicle";

export default function AiSimulador() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<PvBooking[]>([]);
  const [vehicles, setVehicles] = useState<PvVehicle[]>([]);
  const [expenses, setExpenses] = useState<PvExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [b, v, e] = await Promise.all([
      supabase.from("bookings")
        .select("id, status, pickup_date, return_date, total_price, vehicle_id, customer_name, customer_id")
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
  const realBookings = useMemo(
    () => bookings.filter(b => b.status !== "cancelled"),
    [bookings],
  );
  const perVehicle = useMemo(
    () => computePerVehicle(vehicles, realBookings, expenses, today),
    [vehicles, realBookings, expenses, today],
  );

  return (
    <div
      className="ai-shell relative -mx-4 lg:-mx-6 -mt-3 lg:-mt-6 min-h-[calc(100vh-80px)]"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)",
      }}
    >
      {/* Header dedicado */}
      <div
        className="sticky top-0 z-20 backdrop-blur-xl"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          background:
            "linear-gradient(180deg, rgba(246,241,230,0.96), rgba(246,241,230,0.70))",
          borderBottom: "1px solid rgba(13,29,46,0.10)",
        }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3">
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full transition-all active:scale-95"
            style={{
              background: "#fbf7ee",
              border: "1px solid rgba(13,29,46,0.14)",
              color: "#0d1d2e",
              boxShadow: "0 4px 10px -6px rgba(13,29,46,0.25)",
            }}
            aria-label="Voltar ao painel"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.32em]"
              style={{ color: "rgba(13,29,46,0.55)" }}
            >
              Zeus Brain
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-flex items-center justify-center h-6 w-6 rounded-full"
                style={{ background: "#0d1d2e" }}
              >
                <Gamepad2 size={12} style={{ color: "#d6bf86" }} />
              </span>
              <h1
                className="text-[17px] sm:text-[19px] font-medium leading-none truncate"
                style={{ color: "#0d1d2e", letterSpacing: "-0.01em" }}
              >
                Simulador de Frota
              </h1>
              <span
                className="hidden sm:inline-flex text-[9px] font-semibold uppercase tracking-[0.22em] px-2 py-[3px] rounded-full"
                style={{
                  background: "rgba(214,191,134,0.18)",
                  border: "1px solid rgba(214,191,134,0.45)",
                  color: "#6b4f1d",
                }}
              >
                Experiência exclusiva
              </span>
            </div>
          </div>

          <div
            className="hidden md:block text-[11px] text-right"
            style={{ color: "rgba(13,29,46,0.55)" }}
          >
            {perVehicle.length} carros · {realBookings.length} reservas
          </div>
        </div>
        <div
          className="h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #c8a86b 30%, #9a7a3a 50%, #c8a86b 70%, transparent)",
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
