export type PlanId = "unico";

export interface RentalPlan {
  id: PlanId;
  name: string;
  dailyExtra: number;
  insurance: "basic" | "premium";
  deposit: number;
  franchise: number;
  tollTag: boolean;
  childSeat: boolean;
  extraDriver: boolean;
  cancellation: string;
  cancellationLabel: string;
  reschedule: string;
  rescheduleLabel: string;
  delivery: boolean;
  priority: boolean;
  upgrade: boolean;
  returnFee: number;
}

export const PLANS: Record<PlanId, RentalPlan> = {
  unico: {
    id: "unico",
    name: "GoDrive",
    dailyExtra: 0,
    insurance: "basic",
    deposit: 300,
    franchise: 1200,
    tollTag: false,
    childSeat: false,
    extraDriver: false,
    cancellation: "0%",
    cancellationLabel: "Sem reembolso",
    reschedule: "none",
    rescheduleLabel: "Não permitida",
    delivery: false,
    priority: false,
    upgrade: false,
    returnFee: 150,
  },
};

export const PLAN_ORDER: PlanId[] = ["unico"];

// Items included in ALL plans
export const BASE_INCLUDES = [
  "Milhagem ilimitada",
  "Seguro básico",
  "Assistência 24h",
  "Limpeza completa",
];
