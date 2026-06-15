import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ZeusBooking = {
  id: string;
  booking_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  pickup_date: string;
  return_date: string;
  status: string;
  total_price: number | null;
  contract_status: string | null;
  payment_status: string | null;
};

export type ZeusIncident = {
  id: string;
  type: string | null;
  severity: string | null;
  status: string | null;
  title: string | null;
  incident_date: string | null;
  actual_cost: number | null;
  estimated_cost: number | null;
};

export type ZeusCondition = {
  tire: string | null;
  brake: string | null;
  battery: string | null;
  body: string | null;
};

export type VehicleZeusContext = {
  current: ZeusBooking | null;
  next: ZeusBooking | null;
  revenue30: number;
  expenses30: number;
  incidentsOpen: number;
  lastIncident: ZeusIncident | null;
  condition: ZeusCondition;
};

export function useVehicleZeusContext(vehicleId: string | null) {
  return useQuery({
    queryKey: ["vehicle-zeus-context", vehicleId],
    enabled: !!vehicleId,
    staleTime: 60_000,
    queryFn: async (): Promise<VehicleZeusContext> => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

      const [bookingsRes, expensesRes, incidentsRes, condRes, txRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, booking_number, customer_name, customer_phone, pickup_date, return_date, status, total_price, contract_status, payment_status")
          .eq("vehicle_id", vehicleId!)
          .is("deleted_at", null)
          .in("status", ["confirmed", "active", "in_progress", "pending", "pending_payment"])
          .gte("return_date", today)
          .order("pickup_date", { ascending: true })
          .limit(10),
        supabase
          .from("vehicle_expenses")
          .select("amount, expense_date")
          .eq("vehicle_id", vehicleId!)
          .gte("expense_date", since),
        supabase
          .from("vehicle_incidents")
          .select("id, type, severity, status, title, incident_date, actual_cost, estimated_cost")
          .eq("vehicle_id", vehicleId!)
          .order("incident_date", { ascending: false })
          .limit(20),
        supabase
          .from("vehicles")
          .select("tire_condition, brake_condition, battery_condition, body_condition")
          .eq("id", vehicleId!)
          .maybeSingle(),
        supabase
          .from("financial_transactions")
          .select("amount, type, transaction_date, is_cancelled")
          .eq("vehicle_id", vehicleId!)
          .eq("type", "income")
          .eq("is_cancelled", false)
          .gte("transaction_date", since),
      ]);

      const allBookings = (bookingsRes.data ?? []) as ZeusBooking[];
      const current =
        allBookings.find((b) => b.pickup_date <= today && b.return_date >= today) ?? null;
      const next =
        allBookings
          .filter((b) => b.pickup_date > today)
          .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))[0] ?? null;

      const expenses30 = (expensesRes.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      const revenue30 = (txRes.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      const incidents = (incidentsRes.data ?? []) as ZeusIncident[];
      const incidentsOpen = incidents.filter((i) => i.status && i.status !== "resolved" && i.status !== "closed").length;
      const lastIncident = incidents[0] ?? null;

      const c = (condRes.data ?? {}) as any;
      const condition: ZeusCondition = {
        tire: c.tire_condition ?? null,
        brake: c.brake_condition ?? null,
        battery: c.battery_condition ?? null,
        body: c.body_condition ?? null,
      };

      return { current, next, revenue30, expenses30, incidentsOpen, lastIncident, condition };
    },
  });
}
