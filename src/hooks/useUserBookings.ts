import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbBookingWithVehicle {
  id: string;
  booking_number: string | null;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  plan_id: string | null;
  addons: any;
  extra_driver: boolean | null;
  driver_age: number | null;
  notes: string | null;
  created_at: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  vehicle: {
    id: string;
    name: string;
    category: string;
    image_url: string | null;
  } | null;
}

export function useUserBookings() {
  const [bookings, setBookings] = useState<DbBookingWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setBookings([]);
        setLoading(false);
        return;
      }

      // First get the customer id for this user
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (custErr) {
        setError("Erro ao buscar dados do cliente.");
        setLoading(false);
        return;
      }

      if (!customer) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data, error: bookErr } = await supabase
        .from("bookings")
        .select("id, booking_number, status, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, total_price, plan_id, addons, extra_driver, driver_age, notes, created_at, customer_id, vehicle_id, customer_email, customer_name")
        .eq("customer_id", customer.id)
        .order("pickup_date", { ascending: false });

      if (bookErr) {
        setError("Erro ao buscar reservas.");
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      // Fetch vehicles for all bookings via the safe public view
      const vehicleIds = [...new Set(data.map((b) => b.vehicle_id))];
      const { data: vehicles } = await supabase
        .from("vehicles_public" as "vehicles")
        .select("id, name, category, image_url")
        .in("id", vehicleIds);

      const vehicleMap = new Map(
        (vehicles || []).map((v) => [v.id, v])
      );

      const mapped: DbBookingWithVehicle[] = data.map((b) => ({
        id: b.id,
        booking_number: b.booking_number,
        status: b.status,
        pickup_date: b.pickup_date,
        return_date: b.return_date,
        pickup_time: b.pickup_time,
        return_time: b.return_time,
        pickup_location: b.pickup_location,
        return_location: b.return_location,
        total_price: b.total_price,
        plan_id: b.plan_id,
        addons: b.addons,
        extra_driver: b.extra_driver,
        driver_age: b.driver_age,
        notes: b.notes,
        created_at: b.created_at,
        customer_id: b.customer_id,
        customer_email: b.customer_email,
        customer_name: b.customer_name,
        vehicle: vehicleMap.get(b.vehicle_id) || null,
      }));

      setBookings(mapped);
    } catch {
      setError("Erro inesperado ao buscar reservas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
}
