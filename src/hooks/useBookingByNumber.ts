import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DbBookingWithVehicle } from "./useUserBookings";

export function useBookingByNumber(bookingNumber: string | undefined) {
  const [booking, setBooking] = useState<DbBookingWithVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingNumber) {
      setLoading(false);
      setError("Número da reserva não informado.");
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          if (!cancelled) { setError("Não autenticado."); setLoading(false); }
          return;
        }

        // Get customer for this user
        const { data: customer, error: custErr } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (custErr || !customer) {
          if (!cancelled) { setError("Perfil de cliente não encontrado."); setLoading(false); }
          return;
        }

        // Get the booking by booking_number, scoped to this customer (RLS also enforces)
        const { data: bookingRow, error: bookErr } = await supabase
          .from("bookings")
          .select("id, booking_number, status, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, total_price, plan_id, addons, extra_driver, driver_age, notes, created_at, customer_id, vehicle_id")
          .eq("booking_number", bookingNumber)
          .eq("customer_id", customer.id)
          .maybeSingle();

        if (bookErr) {
          if (!cancelled) { setError("Erro ao buscar reserva."); setLoading(false); }
          return;
        }

        if (!bookingRow) {
          if (!cancelled) { setError("Reserva não encontrada."); setLoading(false); }
          return;
        }

        // Fetch vehicle
        let vehicle: DbBookingWithVehicle["vehicle"] = null;
        if (bookingRow.vehicle_id) {
          const { data: v } = await supabase
            .from("vehicles")
            .select("id, name, category, image_url")
            .eq("id", bookingRow.vehicle_id)
            .maybeSingle();
          vehicle = v || null;
        }

        if (!cancelled) {
          setBooking({
            id: bookingRow.id,
            booking_number: bookingRow.booking_number,
            status: bookingRow.status,
            pickup_date: bookingRow.pickup_date,
            return_date: bookingRow.return_date,
            pickup_time: bookingRow.pickup_time,
            return_time: bookingRow.return_time,
            pickup_location: bookingRow.pickup_location,
            return_location: bookingRow.return_location,
            total_price: bookingRow.total_price,
            plan_id: bookingRow.plan_id,
            addons: bookingRow.addons,
            extra_driver: bookingRow.extra_driver,
            driver_age: bookingRow.driver_age,
            notes: bookingRow.notes,
            created_at: bookingRow.created_at,
            customer_id: bookingRow.customer_id,
            vehicle,
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError("Erro inesperado."); setLoading(false); }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [bookingNumber]);

  return { booking, loading, error };
}
