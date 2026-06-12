import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the Set of vehicle IDs UNAVAILABLE in the given period.
 * Matches the SQL function check_vehicle_availability:
 *   - statuses pending / confirmed / active / in_progress always block
 *   - pending_payment blocks only if hold_expires_at > now()
 *   - overlap uses half-open interval [pickup_date, return_date)
 *   - deleted bookings ignored
 */
export function useVehicleAvailability(
  pickupDate: Date | null,
  returnDate: Date | null,
) {
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickupDate || !returnDate) {
      setUnavailableIds(new Set());
      return;
    }
    const pickupISO = format(pickupDate, "yyyy-MM-dd");
    const returnISO = format(returnDate, "yyyy-MM-dd");

    setLoading(true);

    // Overlap (half-open): existing.pickup < requested.return AND existing.return > requested.pickup
    supabase
      .from("bookings")
      .select("vehicle_id, status, hold_expires_at, pickup_date, return_date")
      .is("deleted_at", null)
      .lt("pickup_date", returnISO)
      .gt("return_date", pickupISO)
      .then(({ data, error }) => {
        if (error) {
          console.warn("[useVehicleAvailability] query failed", error);
          setUnavailableIds(new Set());
          setLoading(false);
          return;
        }
        const now = Date.now();
        const ids = new Set<string>();
        for (const b of data || []) {
          if (!b.vehicle_id) continue;
          const blocking = ["pending", "confirmed", "active", "in_progress"].includes(b.status);
          const holdActive = b.status === "pending_payment"
            && b.hold_expires_at
            && new Date(b.hold_expires_at).getTime() > now;
          if (blocking || holdActive) ids.add(b.vehicle_id);
        }
        setUnavailableIds(ids);
        setLoading(false);
      });
  }, [pickupDate?.getTime(), returnDate?.getTime()]);

  return { unavailableIds, loading };
}
