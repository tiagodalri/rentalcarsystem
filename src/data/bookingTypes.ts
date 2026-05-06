export type BookingStatus = "completed" | "active" | "in_progress" | "confirmed" | "pending" | "cancelled";

export interface ExtraCharge {
  description: string;
  amount: number;
}

export interface BookingExtras {
  premiumInsurance: boolean;
  childSeat: boolean;
  tollTag: boolean;
  oneWay: boolean;
}

export interface BookingPricing {
  base: number;
  insurance: number;
  childSeat?: number;
  tollTag: number;
  oneWayFee: number;
  discount: number;
  total: number;
}

export interface Booking {
  id: string;
  vehicle: string;
  category: string;
  coverImage: string;
  pickupDate: string;
  dropoffDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  status: BookingStatus;
  dailyRate: number;
  rentalDays: number;
  extras: BookingExtras;
  pricing: BookingPricing;
  deposit: number;
  franchise: number;
  fuelPickup: string;
  fuelDropoff: string | null;
  extraCharges: ExtraCharge[];
  contractUrl: string;
  rating?: number;
  daysRemaining?: number;
  discountApplied?: string;
}

export const statusConfig: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: "Ativa", color: "#1D9E75", bgColor: "rgba(29,158,117,0.15)" },
  in_progress: { label: "Em andamento", color: "#D97706", bgColor: "rgba(217,119,6,0.15)" },
  confirmed: { label: "Confirmada", color: "#378ADD", bgColor: "rgba(55,138,221,0.15)" },
  pending: { label: "Aguardando confirmação", color: "#B08D37", bgColor: "rgba(176,141,55,0.15)" },
  completed: { label: "Concluída", color: "#808080", bgColor: "rgba(128,128,128,0.15)" },
  cancelled: { label: "Cancelada", color: "#C0392B", bgColor: "rgba(192,57,43,0.15)" },
};
