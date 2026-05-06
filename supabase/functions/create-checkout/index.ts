import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const {
      bookingId,
      vehicleName,
      vehicleCategory,
      dailyRate,
      rentalDays,
      pickupDate,
      dropoffDate,
      pickupTime,
      dropoffTime,
      pickupLocation,
      dropoffLocation,
      premiumInsurance,
      childSeat,
      childSeatQty,
      tollTag,
      extraDriver,
      isDifferentCity,
      pricing,
      customerEmail,
    } = await req.json();

    if (!vehicleName || !pricing?.total) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate bookingId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (bookingId && !uuidRegex.test(bookingId)) {
      return new Response(
        JSON.stringify({ error: "Invalid bookingId format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Base rental
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `${vehicleName} — ${rentalDays} diárias`,
          description: `${vehicleCategory} · ${pickupLocation} → ${dropoffLocation} · ${pickupDate} a ${dropoffDate}`,
        },
        unit_amount: Math.round(pricing.subtotalRental * 100),
      },
      quantity: 1,
    });

    // Premium Insurance
    if (premiumInsurance && pricing.insuranceTotal > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Seguro Premium — Franquia Zero",
            description: `${rentalDays} diárias · Cobertura total, sem caução`,
          },
          unit_amount: Math.round(pricing.insuranceTotal * 100),
        },
        quantity: 1,
      });
    }

    // Extra driver
    if (extraDriver && pricing.extraDriverTotal > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Condutor Extra",
            description: `${rentalDays} diárias`,
          },
          unit_amount: Math.round(pricing.extraDriverTotal * 100),
        },
        quantity: 1,
      });
    }

    // Child seat
    if (childSeat && pricing.childSeatTotal > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Cadeirinha infantil (x${childSeatQty})`,
            description: `${rentalDays} diárias`,
          },
          unit_amount: Math.round(pricing.childSeatTotal * 100),
        },
        quantity: 1,
      });
    }

    // Toll tag
    if (tollTag && pricing.tollTagTotal > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "TAG Pedágio Ilimitada (SunPass)",
            description: `${rentalDays} diárias · Todos os pedágios da Flórida`,
          },
          unit_amount: Math.round(pricing.tollTagTotal * 100),
        },
        quantity: 1,
      });
    }

    // One-way fee
    if (isDifferentCity && pricing.returnFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Taxa de retorno (one-way)",
            description: `${pickupLocation} → ${dropoffLocation}`,
          },
          unit_amount: Math.round(pricing.returnFee * 100),
        },
        quantity: 1,
      });
    }

    // Build session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      success_url: `${req.headers.get("origin")}/reserva/confirmada?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/reserva/${encodeURIComponent(vehicleName)}?cancelled=true`,
      metadata: {
        vehicleName,
        vehicleCategory,
        dailyRate: String(dailyRate),
        rentalDays: String(rentalDays),
        pickupDate,
        dropoffDate,
        pickupTime,
        dropoffTime,
        pickupLocation,
        dropoffLocation,
        premiumInsurance: String(premiumInsurance),
        childSeat: String(childSeat),
        tollTag: String(tollTag),
        extraDriver: String(extraDriver),
        isDifferentCity: String(isDifferentCity),
        total: String(pricing.total),
        ...(bookingId ? { bookingId } : {}),
      },
    };

    // Apply discount as coupon if applicable
    if (pricing.discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(pricing.discountAmount * 100),
        currency: "usd",
        name: "Desconto 10+ diárias (5%)",
        duration: "once",
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Persist stripe_session_id on the booking record
    if (bookingId && session.id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({ stripe_session_id: session.id })
          .eq("id", bookingId);
        if (updateErr) {
          console.warn("Failed to persist stripe_session_id:", updateErr.message);
        }
      } catch (e) {
        console.warn("Error updating booking with stripe_session_id:", e.message);
      }
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
