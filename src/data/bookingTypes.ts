import corvetteCover from "@/assets/fleet/covers/corvette-cover.jpg";
import durangoCover from "@/assets/fleet/covers/durango-cover.jpg";
import bmwX5Cover from "@/assets/fleet/covers/bmw-x5-cover.jpg";
import mustangCover from "@/assets/fleet/covers/mustang-cover.jpg";
import escaladeCover from "@/assets/fleet/covers/escalade-cover.jpg";

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

export const mockBookings: Booking[] = [
  {
    id: "BK-2026-0712",
    vehicle: "Corvette Stingray C8",
    category: "Super Esportivo",
    coverImage: corvetteCover,
    pickupDate: "2026-01-10T10:00",
    dropoffDate: "2026-01-17T10:00",
    pickupLocation: "Orlando International Airport (MCO)",
    dropoffLocation: "Orlando International Airport (MCO)",
    status: "completed",
    dailyRate: 189,
    rentalDays: 7,
    extras: { premiumInsurance: true, childSeat: false, tollTag: true, oneWay: false },
    pricing: { base: 1323, insurance: 159, tollTag: 28, oneWayFee: 0, discount: 0, total: 1510 },
    deposit: 0,
    franchise: 0,
    fuelPickup: "full",
    fuelDropoff: "full",
    extraCharges: [],
    contractUrl: "#",
    rating: 5,
  },
  {
    id: "BK-2026-0819",
    vehicle: "Dodge Durango",
    category: "SUV",
    coverImage: durangoCover,
    pickupDate: "2026-02-15T14:00",
    dropoffDate: "2026-02-22T14:00",
    pickupLocation: "International Drive",
    dropoffLocation: "International Drive",
    status: "completed",
    dailyRate: 85,
    rentalDays: 7,
    extras: { premiumInsurance: false, childSeat: true, tollTag: true, oneWay: false },
    pricing: { base: 595, insurance: 0, childSeat: 63, tollTag: 28, oneWayFee: 0, discount: 0, total: 686 },
    deposit: 550,
    franchise: 935,
    fuelPickup: "full",
    fuelDropoff: "3/4",
    extraCharges: [{ description: "Reabastecimento parcial (1/4 tanque)", amount: 45 }],
    contractUrl: "#",
    rating: 4,
  },
  {
    id: "BK-2026-0923",
    vehicle: "BMW X5 M Sport",
    category: "SUV Premium",
    coverImage: bmwX5Cover,
    pickupDate: "2026-03-28T10:00",
    dropoffDate: "2026-04-04T10:00",
    pickupLocation: "Orlando International Airport (MCO)",
    dropoffLocation: "Kissimmee",
    status: "active",
    dailyRate: 149,
    rentalDays: 7,
    extras: { premiumInsurance: true, childSeat: true, tollTag: true, oneWay: true },
    pricing: { base: 1043, insurance: 126, childSeat: 63, tollTag: 28, oneWayFee: 150, discount: 0, total: 1410 },
    deposit: 0,
    franchise: 0,
    fuelPickup: "full",
    fuelDropoff: null,
    extraCharges: [],
    contractUrl: "#",
    daysRemaining: 4,
  },
  {
    id: "BK-2026-1055",
    vehicle: "Mustang Conversível",
    category: "Esportivo",
    coverImage: mustangCover,
    pickupDate: "2026-05-20T09:00",
    dropoffDate: "2026-06-01T09:00",
    pickupLocation: "Orlando International Airport (MCO)",
    dropoffLocation: "Orlando International Airport (MCO)",
    status: "confirmed",
    dailyRate: 120,
    rentalDays: 12,
    extras: { premiumInsurance: true, childSeat: false, tollTag: true, oneWay: false },
    pricing: { base: 1440, insurance: 173, tollTag: 48, oneWayFee: 0, discount: -83, total: 1578 },
    deposit: 0,
    franchise: 0,
    fuelPickup: "full",
    fuelDropoff: null,
    extraCharges: [],
    contractUrl: "#",
    discountApplied: "5% (10+ diárias)",
  },
  {
    id: "BK-2026-1102",
    vehicle: "Cadillac Escalade",
    category: "SUV Premium",
    coverImage: escaladeCover,
    pickupDate: "2026-07-10T11:00",
    dropoffDate: "2026-07-20T11:00",
    pickupLocation: "Orlando International Airport (MCO)",
    dropoffLocation: "Miami International Airport",
    status: "pending",
    dailyRate: 175,
    rentalDays: 10,
    extras: { premiumInsurance: true, childSeat: true, tollTag: true, oneWay: true },
    pricing: { base: 1750, insurance: 210, childSeat: 90, tollTag: 40, oneWayFee: 150, discount: -112, total: 2128 },
    deposit: 0,
    franchise: 0,
    fuelPickup: "full",
    fuelDropoff: null,
    extraCharges: [],
    contractUrl: "#",
    discountApplied: "5% (10+ diárias)",
  },
];

export const statusConfig: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: "Ativa", color: "#1D9E75", bgColor: "rgba(29,158,117,0.15)" },
  in_progress: { label: "Em andamento", color: "#D97706", bgColor: "rgba(217,119,6,0.15)" },
  confirmed: { label: "Confirmada", color: "#378ADD", bgColor: "rgba(55,138,221,0.15)" },
  pending: { label: "Aguardando confirmação", color: "#B08D37", bgColor: "rgba(176,141,55,0.15)" },
  completed: { label: "Concluída", color: "#808080", bgColor: "rgba(128,128,128,0.15)" },
  cancelled: { label: "Cancelada", color: "#C0392B", bgColor: "rgba(192,57,43,0.15)" },
};
