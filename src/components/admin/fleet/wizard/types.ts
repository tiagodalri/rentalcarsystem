export type WizardForm = {
  // Identificação
  name: string;
  brand: string;
  model: string;
  version: string;
  manufacture_year: number | null;
  model_year: number | null;
  vin: string;
  
  license_plate: string;
  color: string;
  bouncie_imei: string;
  e_pass_transponder: string;
  // Especificações
  category: string;
  passengers: number;
  bags: number;
  doors: number | null;
  transmission: string;
  fuel: string;
  engine_type: string;
  engine_size: string;
  features: string[];
  // Comercial & Preços
  daily_price_usd: number | null;
  default_deposit_amount: number | null;
  default_franchise_amount: number | null;
  status: string;
  purchase_price: number | null;
  acquired_date: string | null;
  initial_odometer: number | null;
  current_odometer: number | null;
  insurance_policy: string;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  // Distribuição
  listed_on_turo: boolean;
  // Publicação
  published: boolean;
};

export const EMPTY_FORM: WizardForm = {
  name: "",
  brand: "",
  model: "",
  version: "",
  manufacture_year: null,
  model_year: null,
  vin: "",
  
  license_plate: "",
  color: "",
  bouncie_imei: "",
  e_pass_transponder: "",
  category: "Economy",
  passengers: 5,
  bags: 2,
  doors: 4,
  transmission: "Automatic",
  fuel: "Gasoline",
  engine_type: "",
  engine_size: "",
  features: [],
  daily_price_usd: null,
  default_deposit_amount: 500,
  default_franchise_amount: 2500,
  status: "available",
  purchase_price: null,
  acquired_date: null,
  initial_odometer: null,
  current_odometer: null,
  insurance_policy: "",
  insurance_expiry: null,
  registration_expiry: null,
  published: false,
};

export const CATEGORIES = [
  "Economy", "Compact", "Midsize", "Fullsize", "SUV", "Premium SUV",
  "Luxury", "Sports", "Minivan", "Pickup", "Convertible",
];

export const FEATURE_OPTIONS = [
  "Bluetooth",
  "Ar-condicionado",
  "GPS",
  "Câmera de ré",
  "Sensor de estacionamento",
  "Apple CarPlay",
  "Android Auto",
  "Bancos em couro",
  "Teto solar",
  "Cruise control",
  "USB",
  "Carregador sem fio",
];

export const inputCls =
  "w-full h-11 px-3 rounded-lg border border-border/60 bg-background text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";
export const labelCls =
  "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";
