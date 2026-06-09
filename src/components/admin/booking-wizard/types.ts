import type { CustomerLite } from "@/components/admin/CustomerCombobox";

export type AddonPricingMode = "per_day" | "total";

export type AddonItem = {
  id: string;
  name: string;
  price: string; // stored as string for input control
  mode: AddonPricingMode;
};

export const DEFAULT_ADDON_PRESETS: Omit<AddonItem, "id">[] = [
  { name: "Motorista adicional", price: "10", mode: "per_day" },
  { name: "Cadeirinha infantil", price: "8", mode: "per_day" },
  { name: "Toll Tag (pedágio)", price: "12", mode: "per_day" },
  { name: "Seguro Premium", price: "25", mode: "per_day" },
];


export type WizardFormState = {
  // Customer
  customer: CustomerLite | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;

  // Vehicle
  vehicle_id: string;
  daily_price_override: string; // editable daily rate, defaults to vehicle's configured price


  // Pickup
  pickup_date: string;
  pickup_time: string;
  pickup_location: string;
  pickup_notes: string;

  // Return
  return_date: string;
  return_time: string;
  return_location: string;
  return_notes: string;


  // Deposit & franchise
  deposit_amount: string;
  franchise_amount: string;
  deposit_refund_days: string;

  // Extras (addons dynamic list)
  addons_list: AddonItem[];

  // Payment
  total_price: string;
  currency: "USD" | "BRL";
  payment_method: string;
  payment_status: "pending" | "paid" | "partial";
  paid_date: string; // when status = paid
  payment_due_date: string; // when status = pending OR remaining due date when partial
  deposit_paid_amount: string; // when status = partial
  deposit_paid_date: string; // when status = partial

  // Notes
  notes: string;
};



export const initialWizardForm: WizardFormState = {
  customer: null,
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  vehicle_id: "",
  daily_price_override: "",

  pickup_date: "",
  pickup_time: "10:00",
  pickup_location: "",
  pickup_notes: "",
  return_date: "",
  return_time: "10:00",
  return_location: "",
  return_notes: "",
  deposit_amount: "",
  franchise_amount: "",
  deposit_refund_days: "30",
  addons_list: DEFAULT_ADDON_PRESETS.map((a, i) => ({
    ...a,
    id: `preset-${i}-${Math.random().toString(36).slice(2, 8)}`,
  })),
  total_price: "",
  currency: "USD",
  payment_method: "Cartão de Crédito",
  payment_status: "pending",
  paid_date: "",
  payment_due_date: "",
  deposit_paid_amount: "",
  deposit_paid_date: "",
  notes: "",

};


export type AiExtractResult = {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  vehicle_name?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  return_date?: string | null;
  return_time?: string | null;
  pickup_location?: string | null;
  return_location?: string | null;
  total_price?: number | null;
  currency?: "USD" | "BRL" | null;
  payment_method?: string | null;
  deposit_amount?: number | null;
  franchise_amount?: number | null;
  notes?: string | null;
};

export const WIZARD_STEPS = [
  { id: "customer", title: "Cliente" },
  { id: "vehicle", title: "Veículo" },
  { id: "schedule", title: "Retirada e devolução" },
  { id: "deposit", title: "Caução & Franquia" },
  { id: "extras", title: "Opcionais" },
  { id: "payment", title: "Pagamento" },
  { id: "review", title: "Revisão" },

] as const;

export type StepId = (typeof WIZARD_STEPS)[number]["id"];
