import type { Booking, BookingStatus } from "@/data/bookingTypes";
import type { DbBookingWithVehicle } from "@/hooks/useUserBookings";
import { getCoverImage } from "@/data/vehicleImages";

const VALID_STATUSES: BookingStatus[] = [
  "completed", "active", "in_progress", "confirmed", "pending", "cancelled",
];

function mapStatus(raw: string): BookingStatus {
  if (VALID_STATUSES.includes(raw as BookingStatus)) return raw as BookingStatus;
  return "pending";
}

export function adaptBookingFromDb(db: DbBookingWithVehicle): Booking {
  const vehicleName = db.vehicle?.name ?? "Veículo";
  const totalPrice = db.total_price ?? 0;

  // Try to compute rental days from dates
  const pickupMs = new Date(db.pickup_date).getTime();
  const returnMs = new Date(db.return_date).getTime();
  const rentalDays = Math.max(1, Math.round((returnMs - pickupMs) / (1000 * 60 * 60 * 24)));
  const dailyRate = rentalDays > 0 ? Math.round(totalPrice / rentalDays) : 0;

  return {
    id: db.booking_number || db.id,
    vehicle: vehicleName,
    category: db.vehicle?.category ?? "",
    coverImage: db.vehicle?.image_url || getCoverImage(vehicleName),
    pickupDate: `${db.pickup_date}T${db.pickup_time || "10:00"}`,
    dropoffDate: `${db.return_date}T${db.return_time || "10:00"}`,
    pickupLocation: db.pickup_location || "",
    dropoffLocation: db.return_location || "",
    status: mapStatus(db.status),
    dailyRate,
    rentalDays,
    extras: {
      premiumInsurance: false,
      childSeat: false,
      tollTag: false,
      oneWay: false,
    },
    pricing: {
      base: totalPrice,
      insurance: 0,
      tollTag: 0,
      oneWayFee: 0,
      discount: 0,
      total: totalPrice,
    },
    deposit: 0,
    franchise: 0,
    fuelPickup: "full",
    fuelDropoff: null,
    extraCharges: [],
    contractUrl: "",
    contractAvailable: ["confirmed", "in_progress", "completed"].includes(db.status),
  };
}
