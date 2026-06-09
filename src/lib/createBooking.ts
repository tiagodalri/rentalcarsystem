import { supabase } from "@/integrations/supabase/client";

export type CreateBookingPayload = {
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_id: string;
  pickup_date: string;
  pickup_time: string;
  return_date: string;
  return_time: string;
  pickup_location: string | null;
  return_location: string | null;
  plan_id: string;
  total_price: number | null;
  status: string;
  notes: string | null;
  deposit_amount: number;
  deposit_refund_days: number | null;
  franchise_amount: number;
  payment_method: string | null;
  payment_status: string;
  currency: string;
  driver_age?: number | null;
  extra_driver?: boolean | null;
  addons?: Record<string, any>;
};

export async function checkAvailability(
  vehicleId: string,
  pickup: string,
  ret: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_vehicle_availability", {
      p_vehicle_id: vehicleId,
      p_pickup: pickup,
      p_return: ret,
      p_exclude_id: null,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export async function createBooking(p: CreateBookingPayload) {
  const payload: any = {
    customer_id: p.customer_id,
    customer_name: p.customer_name,
    customer_email: p.customer_email,
    customer_phone: p.customer_phone,
    vehicle_id: p.vehicle_id,
    pickup_date: p.pickup_date,
    pickup_time: p.pickup_time,
    return_date: p.return_date,
    return_time: p.return_time,
    pickup_location: p.pickup_location,
    return_location: p.return_location,
    plan_id: p.plan_id,
    total_price: p.total_price,
    status: p.status,
    notes: p.notes,
    deposit_amount: p.deposit_amount,
    deposit_refund_days: p.deposit_refund_days,
    franchise_amount: p.franchise_amount,
    payment_method: p.payment_method,
    payment_status: p.payment_status,
    paid_at: p.payment_status === "paid" ? new Date().toISOString() : null,
    driver_age: p.driver_age ?? null,
    extra_driver: p.extra_driver ?? false,
    addons: {
      currency: p.currency,
      manual_entry: true,
      ...(p.addons || {}),
    },
  };
  return supabase.from("bookings").insert(payload).select("id, booking_number").single();
}
