import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { buildCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query bookings with pickup_date = tomorrow
    const { data: bookings, error: queryError } = await supabase.rpc(
      "get_pickup_reminders" // We'll use a direct query instead
    ).maybeSingle();

    // Direct query via supabase client
    const { data: eligibleBookings, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_number,
        customer_email,
        customer_name,
        pickup_date,
        pickup_time,
        pickup_location,
        return_date,
        return_time,
        vehicle_id,
        customer_id
      `)
      .in("status", ["pending", "confirmed"])
      .eq("pickup_date", getTomorrowDate());

    if (fetchError) {
      console.error("Failed to fetch eligible bookings:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bookings", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!eligibleBookings || eligibleBookings.length === 0) {
      console.log("No bookings eligible for pickup reminder today.");
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No eligible bookings" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${eligibleBookings.length} booking(s) eligible for pickup reminder.`);

    // Enrich with vehicle names and customer language
    const vehicleIds = [...new Set(eligibleBookings.map((b) => b.vehicle_id).filter(Boolean))];
    const customerIds = [...new Set(eligibleBookings.map((b) => b.customer_id).filter(Boolean))];

    const [vehiclesResult, customersResult] = await Promise.all([
      vehicleIds.length > 0
        ? supabase.from("vehicles").select("id, name").in("id", vehicleIds)
        : { data: [], error: null },
      customerIds.length > 0
        ? supabase.from("customers").select("id, preferred_language").in("id", customerIds)
        : { data: [], error: null },
    ]);

    const vehicleMap = new Map(
      (vehiclesResult.data || []).map((v: any) => [v.id, v.name])
    );
    const customerLangMap = new Map(
      (customersResult.data || []).map((c: any) => [c.id, c.preferred_language])
    );

    // Send emails via send-email Edge Function
    const sendPromises = eligibleBookings.map(async (booking) => {
      const firstName = (booking.customer_name || "").split(" ")[0].trim();
      const vehicleName = vehicleMap.get(booking.vehicle_id) || "—";
      const language = customerLangMap.get(booking.customer_id) || "pt";
      const idempotencyKey = `pickup-reminder-${booking.id}-${booking.pickup_date}`;

      if (!booking.customer_email) {
        return { bookingId: booking.id, status: "skipped", reason: "No email" };
      }

      try {
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: {
            templateName: "pickup-reminder",
            recipientEmail: booking.customer_email,
            idempotencyKey,
            language,
            templateData: {
              firstName,
              vehicleName,
              bookingNumber: booking.booking_number || "—",
              pickupDate: booking.pickup_date,
              pickupTime: booking.pickup_time || "10:00",
              pickupLocation: booking.pickup_location || "—",
              bookingDetailsUrl: "https://rentalcarsystem.lovable.app/minha-conta",
            },
          },
        });

        if (error) {
          console.error(`Failed to send reminder for booking ${booking.id}:`, error);
          return { bookingId: booking.id, status: "failed", error: error.message };
        }

        console.log(`Reminder sent for booking ${booking.id} (${booking.booking_number})`);
        return { bookingId: booking.id, status: "sent" };
      } catch (err) {
        console.error(`Exception sending reminder for booking ${booking.id}:`, err);
        return { bookingId: booking.id, status: "failed", error: err.message };
      }
    });

    const results = await Promise.allSettled(sendPromises);

    const summary = results.reduce(
      (acc, r) => {
        if (r.status === "fulfilled") {
          const val = r.value;
          if (val.status === "sent") acc.sent++;
          else if (val.status === "failed") {
            acc.failed++;
            acc.errors.push(val);
          } else {
            acc.skipped++;
          }
        } else {
          acc.failed++;
          acc.errors.push({ error: r.reason?.message || "Unknown" });
        }
        return acc;
      },
      { sent: 0, failed: 0, skipped: 0, errors: [] as any[] }
    );

    console.log(`Pickup reminder results: sent=${summary.sent}, failed=${summary.failed}, skipped=${summary.skipped}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pickup-reminder-cron fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Returns tomorrow's date in YYYY-MM-DD format (UTC). */
function getTomorrowDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}
