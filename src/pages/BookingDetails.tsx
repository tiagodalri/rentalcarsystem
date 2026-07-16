import { useSearchParams, Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Briefcase, CalendarIcon, MapPin, Clock, ArrowLeft, Shield, ShieldCheck,
  Baby, CircleDollarSign, Zap, ChevronRight, Check, AlertTriangle, Percent, Car, Fuel, Gauge,
  CreditCard, Lock, Loader2, MessageCircle, X
} from "lucide-react";
import { BookingDetailsSkeleton } from "@/components/skeletons/PublicSkeletons";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { useCurrency } from "@/i18n/CurrencyContext";
import { Switch } from "@/components/ui/switch";
import { useVehiclesDB, buildPriceMap, buildTrimMap, categoryToKey } from "@/hooks/useVehiclesDB";
import { useVehiclePricing } from "@/hooks/useVehiclePricing";
import { getCoverImage } from "@/data/vehicleImages";
import { supabase } from "@/integrations/supabase/client";
import { uploadCnh } from "@/lib/cnhStorage";
import { useToast } from "@/hooks/use-toast";
import PlanSelector from "@/components/booking/PlanSelector";
import CustomerDataStep, { type CustomerData } from "@/components/booking/CustomerDataStep";
import { PLANS } from "@/data/rentalPlans";
import { useAuth } from "@/hooks/useAuth";
import { calculateAge, isBlockedAge, isYoungDriver, YOUNG_DRIVER_SURCHARGE } from "@/lib/age";
import { useFormDraft } from "@/hooks/useFormDraft";

interface VehicleInfo {
  name: string;
  categoryKey: string;
  passengers: number;
  luggage?: number;
  coverImage: string;
  features: string[];
}

const categoryLabels: Record<string, string> = {
  superSport: "Super Esportivo",
  sport: "Esportivo",
  suvPremium: "SUV Premium",
  suvFullSize: "SUV Full Size",
  suv: "SUV",
  suvCompact: "SUV Compacto",
  minivan: "Minivan",
};

const RETURN_FEE_DEFAULT = 150;
const CHILD_SEAT_DAILY = 9;
const TOLL_TAG_DAILY = 4;
const PREMIUM_INSURANCE_DAILY = 22;
const LONG_RENTAL_DISCOUNT_RATE = 0.05;
const LONG_RENTAL_MIN_DAYS = 10;
const BASIC_DEPOSIT = 300;
const BASIC_FRANCHISE = 1200;

type CustomerDataDraft = Omit<CustomerData, "licenseFile">;


const vehicleFeaturesMap: Record<string, string[]> = {
  "Corvette Stingray C8": ["Motor 6.2L V8", "495 HP", "Câmbio automático 8 marchas", "Apple CarPlay / Android Auto", "Modo Track", "Teto Targa removível"],
  "Mustang Conversível": ["Motor 2.3L EcoBoost", "Capota conversível elétrica", "310 HP", "Apple CarPlay / Android Auto", "Câmbio automático 10 marchas", "Banco de couro aquecido"],
  "Cadillac Escalade": ["Motor 6.2L V8", "420 HP", "Tela OLED 38\"", "Sistema AKG 36 alto-falantes", "Bancos de couro ventilados", "Wi-Fi nativo"],
  "BMW X5 M Sport": ["Motor 3.0L Turbo", "335 HP", "xDrive AWD", "Teto panorâmico", "Harman Kardon Sound", "Assistente de estacionamento"],
  "Chevrolet Suburban": ["Motor 5.3L V8", "355 HP", "3ª fileira de bancos", "Tela 10.2\"", "Wi-Fi nativo", "Espaço para até 8 malas"],
  "Dodge Durango": ["Motor 3.6L V6", "295 HP", "3ª fileira de bancos", "Uconnect 10.1\"", "Apple CarPlay", "Tração AWD disponível"],
  "Kia Sorento": ["Motor 2.5L Turbo", "281 HP", "Câmbio DCT 8 marchas", "Tela 10.25\"", "Carregador wireless", "Bancos de couro"],
  "Kia Sportage": ["Motor 2.5L", "187 HP", "Tela panorâmica curva", "Apple CarPlay / Android Auto", "Assistente de faixa", "Câmera 360°"],
  "Mitsubishi Outlander": ["Motor 2.5L", "181 HP", "3ª fileira de bancos", "Tela 9\"", "AWC (tração integral)", "Controle de cruzeiro adaptativo"],
  "Volkswagen Tiguan": ["Motor 2.0L TSI", "184 HP", "3ª fileira de bancos", "Digital Cockpit", "App-Connect", "Tração 4Motion"],
  "Chrysler Pacifica": ["Motor 3.6L V6", "287 HP", "Stow 'n Go Seats", "Uconnect Theater", "Portas deslizantes elétricas", "Aspirador de pó integrado"],
  "Lexus NX": ["Motor 2.5L Turbo", "275 HP", "Lexus Safety System+", "Tela 14\"", "Mark Levinson Audio", "Bancos ventilados"],
  "Audi Q7": ["Motor 2.0L TFSI", "261 HP", "Quattro AWD", "Virtual Cockpit", "Bang & Olufsen 3D Sound", "Suspensão pneumática"],
  "Volvo XC60": ["Motor 2.0L Turbo", "247 HP", "Pilot Assist", "Bowers & Wilkins Audio", "Tela Sensus 9\"", "City Safety"],
  "MUSTANG CONVERSÍVEL": ["Motor 2.3L EcoBoost", "Capota conversível elétrica", "310 HP", "Apple CarPlay / Android Auto", "Câmbio automático 10 marchas", "Cor: Branco Oxford"],
  "VOLKSWAGEN TIGUAN": ["Motor 2.0L TSI", "184 HP", "3ª fileira de bancos", "Digital Cockpit", "App-Connect", "Cor: Branco Pure"],
  "Nissan Kicks": ["Motor 1.6L", "122 HP", "Câmbio CVT", "Tela 8\"", "Apple CarPlay / Android Auto", "Câmera de ré inteligente"],
  "Volkswagen Atlas": ["Motor 3.6L V6", "276 HP", "3ª fileira de bancos", "Digital Cockpit Pro", "4Motion AWD", "Espaço amplo para família"],
  "Mercedes-Benz GLA": ["Motor 2.0L Turbo", "221 HP", "MBUX Infotainment", "Tela dupla 10.25\"", "Pacote AMG Line", "Suspensão esportiva"],
};

const BookingDetails = () => {
  const { vehicleName } = useParams<{ vehicleName: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { formatPrice, formatPriceIn, currency, currencySymbol } = useCurrency();
  const { vehicles: dbVehicles, loading: vehiclesLoading } = useVehiclesDB();
  const vehiclePrices = buildPriceMap(dbVehicles);
  const vehicleTrims = buildTrimMap(dbVehicles);

  const decodedName = decodeURIComponent(vehicleName || "");

  const dbVehicle = dbVehicles.find((v) => v.name === decodedName)
    || dbVehicles.find((v) => v.name.toLowerCase() === decodedName.toLowerCase());

  // Debug: log mismatch for future investigation
  if (!vehiclesLoading && dbVehicles.length > 0 && !dbVehicle) {
    console.warn("[BookingDetails] Vehicle not found in DB.", {
      decodedName,
      availableNames: dbVehicles.map((v) => v.name),
    });
  }
  const vehicle: VehicleInfo | undefined = dbVehicle ? {
    name: dbVehicle.name,
    categoryKey: categoryToKey(dbVehicle.category),
    passengers: dbVehicle.passengers,
    luggage: dbVehicle.bags,
    coverImage: getCoverImage(dbVehicle.name),
    features: vehicleFeaturesMap[dbVehicle.name] || dbVehicle.features || [],
  } : undefined;

  const pickupDateStr = searchParams.get("pickupDate");
  const returnDateStr = searchParams.get("returnDate");
  const pickupTime = searchParams.get("pickupTime") || "10:00";
  const returnTime = searchParams.get("returnTime") || "10:00";
  const pickupLocation = searchParams.get("pickupLocation") || "";
  const returnLocation = searchParams.get("returnLocation") || pickupLocation;
  const driverAgeParam = searchParams.get("driverAge");
  const { customer, loading: authLoading } = useAuth();
  const effectiveAge: number | null = customer?.date_of_birth
    ? calculateAge(customer.date_of_birth)
    : (driverAgeParam ? parseInt(driverAgeParam) : null);
  const youngDriver = effectiveAge !== null && isYoungDriver(effectiveAge);
  const blockedByAge = effectiveAge !== null && isBlockedAge(effectiveAge);

  const pickupDate = pickupDateStr ? new Date(pickupDateStr) : null;
  const returnDate = returnDateStr ? new Date(returnDateStr) : null;

  const days = pickupDate && returnDate
    ? Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  const { toast } = useToast();

  const currentPlan = PLANS.unico;

  // Extra add-ons (separately selectable)
  const [addonInsurance, setAddonInsurance] = useState(false);
  const [addonChildSeat, setAddonChildSeat] = useState(false);
  const [addonChildSeatQty, setAddonChildSeatQty] = useState(1);
  const [addonTollTag, setAddonTollTag] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData>({
    full_name: "", email: "", phone: "", date_of_birth: "",
    nationality: "", document_number: "", address: "", house_number: "", complement: "", zip_code: "",
    district: "", city: "", state: "",
    licenseFile: null,
  });

  const bookingDraftKey = useMemo(
    () => `booking-details-v2:${decodedName}:${pickupDateStr || ""}:${returnDateStr || ""}:${pickupTime}:${returnTime}:${pickupLocation}:${returnLocation}`,
    [decodedName, pickupDateStr, returnDateStr, pickupTime, returnTime, pickupLocation, returnLocation],
  );
  const customerDataDraft = useMemo<CustomerDataDraft>(() => {
    const { licenseFile: _licenseFile, ...draft } = customerData;
    return draft;
  }, [customerData]);

  useFormDraft(
    bookingDraftKey,
    customerDataDraft,
    (draft) => setCustomerData((prev) => ({ ...prev, ...draft, licenseFile: prev.licenseFile })),
    true,
    {
      debounceMs: 150,
      isEmpty: (draft) => Object.values(draft).every((value) => !String(value ?? "").trim()),
    },
  );

  const addonsDraft = useMemo(() => ({
    addonInsurance,
    addonChildSeat,
    addonChildSeatQty,
    addonTollTag,
  }), [addonInsurance, addonChildSeat, addonChildSeatQty, addonTollTag]);

  useFormDraft(
    `${bookingDraftKey}:addons`,
    addonsDraft,
    (draft) => {
      setAddonInsurance(Boolean(draft.addonInsurance));
      setAddonChildSeat(Boolean(draft.addonChildSeat));
      setAddonChildSeatQty(Math.max(1, Number(draft.addonChildSeatQty) || 1));
      setAddonTollTag(Boolean(draft.addonTollTag));
    },
    true,
    {
      debounceMs: 150,
      silentRestore: true,
      isEmpty: (draft) => !draft.addonInsurance && !draft.addonChildSeat && !draft.addonTollTag && Number(draft.addonChildSeatQty || 1) <= 1,
    },
  );

  // Handle cancelled checkout
  useEffect(() => {
    if (searchParams.get("cancelled") === "true") {
      toast({
        title: "Pagamento cancelado",
        description: "Sua reserva não foi finalizada. Você pode tentar novamente.",
        variant: "destructive",
      });
    }
  }, []);

  // Derived: what's effectively active
  const hasPremiumInsurance = currentPlan.insurance === "premium" || addonInsurance;
  const hasChildSeat = currentPlan.childSeat || addonChildSeat;
  const hasTollTag = currentPlan.tollTag || addonTollTag;
  const hasExtraDriver = currentPlan.extraDriver;

  // Check if different cities
  const isDifferentCity = useMemo(() => {
    if (!pickupLocation || !returnLocation) return false;
    return pickupLocation.trim().toLowerCase() !== returnLocation.trim().toLowerCase();
  }, [pickupLocation, returnLocation]);

  // Pricing calculations
  const basePrice = vehiclePrices[decodedName] || 99;
  const basicDeductible = BASIC_FRANCHISE;

  // Real pricing from admin rules (seasons, overrides, weekend multipliers, weekly/monthly discounts)
  const { data: rpcPricing } = useVehiclePricing(dbVehicle?.id, pickupDate, returnDate);

  // Base subtotal/avg from rules; fallback to flat basePrice while loading
  const rulesSubtotal = rpcPricing?.subtotal_rental ?? basePrice * days;
  const rulesAvgDaily = rpcPricing?.avg_per_day ?? basePrice;

  // Young driver surcharge applied on top of the rules-based price
  const dailyPrice = youngDriver ? Math.ceil(rulesAvgDaily * (1 + YOUNG_DRIVER_SURCHARGE)) : rulesAvgDaily;

  const pricing = useMemo(() => {
    const subtotalRental = youngDriver
      ? Math.ceil(rulesSubtotal * (1 + YOUNG_DRIVER_SURCHARGE))
      : rulesSubtotal;
    const planExtra = currentPlan.dailyExtra * days;

    // Add-on costs (only for items added on top of plan)
    const addonInsuranceDailyExtra = (addonInsurance && currentPlan.insurance !== "premium") ? PREMIUM_INSURANCE_DAILY : 0;
    const addonInsuranceTotal = addonInsuranceDailyExtra * days;
    const addonChildSeatTotal = (addonChildSeat && !currentPlan.childSeat) ? CHILD_SEAT_DAILY * addonChildSeatQty * days : 0;
    const addonTollTagTotal = (addonTollTag && !currentPlan.tollTag) ? TOLL_TAG_DAILY * days : 0;

    const returnFee = isDifferentCity ? currentPlan.returnFee : 0;

    const subtotalBeforeDiscount = subtotalRental + planExtra + addonInsuranceTotal + addonChildSeatTotal + addonTollTagTotal + returnFee;
    const qualifiesDiscount = days >= LONG_RENTAL_MIN_DAYS;
    const discountAmount = qualifiesDiscount ? Math.round(subtotalBeforeDiscount * LONG_RENTAL_DISCOUNT_RATE) : 0;
    const total = subtotalBeforeDiscount - discountAmount;

    return {
      dailyPrice,
      subtotalRental,
      planExtra,
      planDailyExtra: currentPlan.dailyExtra,
      addonInsuranceDailyExtra,
      addonInsuranceTotal,
      addonChildSeatTotal,
      addonTollTagTotal,
      returnFee,
      subtotalBeforeDiscount,
      qualifiesDiscount,
      discountAmount,
      total,
      basicDeductible,
      deposit: hasPremiumInsurance ? 0 : BASIC_DEPOSIT,
      deductible: hasPremiumInsurance ? 0 : basicDeductible,
      rulesDiscountPct: rpcPricing?.discount_pct ?? 0,
    };
  }, [dailyPrice, rulesSubtotal, youngDriver, days, currentPlan, addonInsurance, addonChildSeat, addonChildSeatQty, addonTollTag, isDifferentCity, hasPremiumInsurance, rpcPricing]);

  const handleCheckout = async () => {
    // Validate customer data
    if (!customerData.full_name.trim()) {
      return toast({ title: "Preencha seu nome completo", variant: "destructive" });
    }
    if (!customerData.email.trim()) {
      return toast({ title: "Preencha seu e-mail", variant: "destructive" });
    }
    if (!customerData.phone.trim()) {
      return toast({ title: "Preencha seu telefone", variant: "destructive" });
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      // Upload license file if provided. Requires an authenticated session
      // (private customer-licenses bucket). For anonymous guest checkout we
      // skip the upload — the customer can attach it later from Minha Conta.
      let driverLicenseUrl: string | null = null;
      if (customerData.licenseFile) {
        const path = await uploadCnh(customerData.licenseFile);
        if (path) driverLicenseUrl = path;
      }

      // Create or link customer
      const email = customerData.email.trim().toLowerCase();
      const { data: existing } = await supabase
        .from("customers").select("id").eq("email", email).maybeSingle();

      let customerId: string;
      const composedAddress = [
        customerData.address.trim(),
        customerData.district.trim() ? `Bairro ${customerData.district.trim()}` : "",
        [customerData.city.trim(), customerData.state.trim().toUpperCase()].filter(Boolean).join(" - "),
      ].filter(Boolean).join(", ");

      const customerPayload = {
        full_name: customerData.full_name.trim(),
        phone: customerData.phone.trim(),
        document_number: customerData.document_number.trim() || null,
        nationality: customerData.nationality.trim() || null,
        date_of_birth: customerData.date_of_birth || null,
        address: composedAddress || null,
        house_number: customerData.house_number.trim() || null,
        complement: customerData.complement.trim() || null,
        zip_code: customerData.zip_code.trim() || null,
        ...(driverLicenseUrl ? { driver_license_file_url: driverLicenseUrl } : {}),
      };

      if (existing) {
        customerId = existing.id;
        // Update existing - ignore errors (anon may not have update perms)
        await supabase.from("customers").update(customerPayload).eq("id", customerId);
      } else {
        const { data: newCust } = await supabase.from("customers").insert({
          ...customerPayload,
          email,
        }).select("id").single();
        customerId = newCust?.id || "";
      }

      // Build addons object for tracking
      const addonsData = {
        plan_extra: pricing.planExtra,
        insurance_total: pricing.addonInsuranceTotal,
        extra_driver_total: 0,
        child_seat_total: pricing.addonChildSeatTotal,
        child_seat_qty: addonChildSeatQty,
        toll_tag_total: pricing.addonTollTagTotal,
        return_fee: isDifferentCity ? currentPlan.returnFee : 0,
        discount_amount: pricing.discountAmount,
        premium_insurance: hasPremiumInsurance,
        child_seat: hasChildSeat,
        toll_tag: hasTollTag,
        extra_driver: hasExtraDriver,
      };

      // Validate vehicle exists in DB
      if (!dbVehicle?.id) {
        throw new Error("Veículo não encontrado. Atualize a página e tente novamente.");
      }

      // Validate locations are present
      if (!pickupLocation || !returnLocation) {
        throw new Error("Local de retirada e devolução são obrigatórios. Volte à busca e selecione.");
      }

      // Availability check (booking row itself is created by cambioreal-pay
      // after the user picks Pix/Boleto/Card on /checkout).
      const pickupISO = pickupDate ? format(pickupDate, "yyyy-MM-dd") : "";
      const returnISO = returnDate ? format(returnDate, "yyyy-MM-dd") : "";
      try {
        const { data: available, error: availErr } = await supabase.rpc("check_vehicle_availability", {
          p_vehicle_id: dbVehicle.id,
          p_pickup: pickupISO,
          p_return: returnISO,
          p_exclude_id: null,
        });
        if (!availErr && available === false) {
          throw new Error("Veículo já reservado nesse período. Escolha outras datas ou outro veículo.");
        }
      } catch (e: any) {
        if (e?.message?.includes("já reservado")) throw e;
        console.warn("availability check failed, prosseguindo:", e);
      }


      // Build ISO datetimes for Câmbio Real checkout
      const startAt = `${format(pickupDate!, "yyyy-MM-dd")}T${pickupTime}:00`;
      const endAt = `${format(returnDate!, "yyyy-MM-dd")}T${returnTime}:00`;

      // Navigate to embedded checkout (Pix / Boleto / Card). The booking row
      // is created inside cambioreal-pay with status pending_payment.
      navigate("/checkout", {
        state: {
          vehicle_id: dbVehicle.id,
          start_at: startAt,
          end_at: endAt,
          amount_usd: pricing.total,
          vehicleDisplay: {
            name: decodedName,
            image: vehicle?.coverImage,
            days,
            pickupLocation,
          },
          customer: {
            full_name: customerData.full_name.trim(),
            email,
            phone: customerData.phone.trim(),
            cpf: customerData.document_number?.trim() || "",
            birth_date: customerData.date_of_birth || "",
            address: {
              zip_code: customerData.zip_code.replace(/\D/g, ""),
              street: customerData.address.trim(),
              number: customerData.house_number.trim(),
              complement: customerData.complement.trim(),
              district: customerData.district.trim(),
              city: customerData.city.trim(),
              state: customerData.state.trim().toUpperCase().slice(0, 2),
            },
          },
          // pre-collected ops data (license, addons) for future booking-meta sync
          addons: addonsData,
          customerId,
        },
      });
      setIsProcessing(false);
    } catch (err: any) {
      setCheckoutError(err.message || "Erro ao processar pagamento. Tente novamente.");
      setIsProcessing(false);
    }
  };

  // WhatsApp message
  const whatsappMsg = useMemo(() => {
    const planBenefits: string[] = [];
    if (hasPremiumInsurance) planBenefits.push("Seguro Premium (Franquia ZERO)");
    if (hasTollTag) planBenefits.push("TAG Pedágio ilimitada");
    if (hasExtraDriver) planBenefits.push("2º motorista grátis");
    if (hasChildSeat) planBenefits.push("Cadeirinha infantil");
    if (currentPlan.delivery) planBenefits.push("Entrega no hotel");
    if (currentPlan.priority) planBenefits.push("Prioridade WhatsApp");
    if (currentPlan.upgrade) planBenefits.push("Upgrade grátis (quando disponível)");

    const lines = [
      `Olá! Gostaria de reservar o *${decodedName}*.`,
      ``,
      `📅 *Período:*`,
      pickupDate ? `Retirada: ${format(pickupDate, "dd/MM/yyyy", { locale: pt })} às ${pickupTime}` : "",
      returnDate ? `Devolução: ${format(returnDate, "dd/MM/yyyy", { locale: pt })} às ${returnTime}` : "",
      `Duracao: ${days} ${days === 1 ? "dia" : "dias"}`,
      ``,
      `📍 *Locais:*`,
      `Retirada: ${pickupLocation}`,
      `Devolução: ${returnLocation}`,
      ``,
      `🏷️ *Plano: ${currentPlan.name}*`,
      ...planBenefits.map(b => `✅ ${b}`),
      `Remarcação: ${currentPlan.rescheduleLabel}`,
      ``,
      `💰 *Resumo:*`,
      youngDriver ? `⚠️ Condutor entre 21-25 anos (young driver fee aplicado, idade: ${effectiveAge})` : "",
      `Diária: ${formatPrice(dailyPrice)}`,
      currentPlan.dailyExtra > 0 ? `${currentPlan.name}: ${formatPrice(currentPlan.dailyExtra)}/dia` : "",
      pricing.addonInsuranceTotal > 0 ? `Seguro Premium (avulso): ${formatPrice(pricing.addonInsuranceTotal)}` : "",
      pricing.addonChildSeatTotal > 0 ? `Cadeirinha (avulsa): ${formatPrice(pricing.addonChildSeatTotal)}` : "",
      pricing.addonTollTagTotal > 0 ? `TAG Pedágio (avulso): ${formatPrice(pricing.addonTollTagTotal)}` : "",
      isDifferentCity ? `Taxa de retorno: ${currentPlan.returnFee === 0 ? "ZERO" : formatPrice(currentPlan.returnFee)}` : "",
      pricing.qualifiesDiscount ? `Desconto 10+ diárias: -${formatPrice(pricing.discountAmount)}` : "",
      ``,
      `*TOTAL: ${formatPrice(pricing.total)}*`,
      hasPremiumInsurance ? `✅ Caução: ZERO | Franquia: ZERO` : `⚠️ Caução: ${formatPrice(BASIC_DEPOSIT)} | Franquia: ${formatPrice(basicDeductible)}`,
    ].filter(Boolean);

    return `https://wa.me/16892981754?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [decodedName, pickupDate, returnDate, pickupTime, returnTime, days, pickupLocation, returnLocation, dailyPrice, pricing, currentPlan, hasPremiumInsurance, hasChildSeat, hasTollTag, hasExtraDriver, isDifferentCity]);

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Veículo não encontrado</h1>
          <Link to="/buscar" className="text-primary hover:underline">Voltar à busca</Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (authLoading) {
    return <BookingDetailsSkeleton />;
  }

  if (blockedByAge) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 max-w-2xl">
            <Link
              to={`/buscar?${searchParams.toString()}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-xs tracking-wide mb-6"
            >
              <ArrowLeft size={14} />
              Voltar aos resultados
            </Link>
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-destructive mb-2">
                    Reserva não permitida
                  </h2>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Não atendemos condutores menores de 21 anos.
                    {customer?.date_of_birth && " A idade foi verificada com base na sua data de nascimento cadastrada."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  // Which add-ons are available for the current plan
  const availableAddons = {
    insurance: currentPlan.insurance !== "premium",
    childSeat: !currentPlan.childSeat,
    tollTag: !currentPlan.tollTag,
  };
  const hasAnyAddonAvailable = availableAddons.insurance || availableAddons.childSeat || availableAddons.tollTag;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Back */}
          {location.state?.fromLive ? (
            <Link
              to="/admin/live"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-xs tracking-wide mb-6"
            >
              <ArrowLeft size={14} />
              Voltar ao Live Tracking
            </Link>
          ) : (
            <Link
              to={`/buscar?${searchParams.toString()}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-xs tracking-wide mb-6"
            >
              <ArrowLeft size={14} />
              Voltar aos resultados
            </Link>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT: Vehicle + Plans */}
            <div className="lg:col-span-3 space-y-5">
              {/* Vehicle Photo */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden border border-border/40"
              >
                <div className="relative h-56 sm:h-72">
                  <img
                    src={vehicle.coverImage}
                    alt={vehicle.name}
                    className="w-full h-full object-cover object-[center_40%]"
                    loading="eager"
                    width={1280}
                    height={720}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-white drop-shadow-lg">
                      {vehicle.name}
                    </h1>
                  </div>
                </div>
              </motion.div>

              {/* Vehicle Specs Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 }}
                className="rounded-xl border border-border/40 bg-card p-5"
              >
                <p className="text-[10px] text-primary font-semibold uppercase tracking-[0.2em] mb-1">
                  {categoryLabels[vehicle.categoryKey]}
                </p>
                {vehicleTrims[decodedName] && (
                  <p className="text-sm text-muted-foreground mb-3">{vehicleTrims[decodedName]}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users size={13} className="text-primary" /> {vehicle.passengers}</span>
                  {vehicle.luggage && <span className="flex items-center gap-1.5"><Briefcase size={13} className="text-primary" /> {vehicle.luggage}</span>}
                  <span className="flex items-center gap-1.5"><Fuel size={13} className="text-primary" /> Gasolina</span>
                  <span className="flex items-center gap-1.5"><Gauge size={13} className="text-primary" /> Auto</span>
                </div>
              </motion.div>

              {/* Trip Details */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl border border-border/40 bg-card p-5"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-foreground">
                  <CalendarIcon size={15} className="text-primary" />
                  Detalhes da <span className="gold-text">Viagem</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <div className="w-7 h-7 rounded-md gold-gradient flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarIcon size={12} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Retirada</p>
                        <p className="text-sm font-medium text-foreground">
                          {pickupDate ? format(pickupDate, "dd 'de' MMMM, yyyy", { locale: pt }) : ""}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={10} /> {pickupTime}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <div className="w-7 h-7 rounded-md gold-gradient flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={12} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Local de Retirada</p>
                        <p className="text-sm font-medium text-foreground">{pickupLocation || ""}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <div className="w-7 h-7 rounded-md gold-gradient flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarIcon size={12} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Devolução</p>
                        <p className="text-sm font-medium text-foreground">
                          {returnDate ? format(returnDate, "dd 'de' MMMM, yyyy", { locale: pt }) : ""}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={10} /> {returnTime}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <div className="w-7 h-7 rounded-md gold-gradient flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={12} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Local de Devolução</p>
                        <p className="text-sm font-medium text-foreground">{returnLocation || ""}</p>
                        {isDifferentCity && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                            <AlertTriangle size={9} /> Cidade diferente
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2.5 rounded-lg bg-primary/8 border border-primary/15 text-center">
                  <p className="text-xs font-semibold text-primary">
                    {days} {days === 1 ? "diária" : "diárias"} · {formatPrice(dailyPrice)}/dia
                  </p>
                </div>
                {youngDriver && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Condutor com {effectiveAge} anos. Acréscimo young driver de 8% aplicado.
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Vehicle Features */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-border/40 bg-card p-5"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-foreground">
                  <Car size={15} className="text-primary" />
                  Destaques do <span className="gold-text">Veículo</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {vehicle.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-1.5 p-2 rounded-md bg-muted/15 border border-border/15 text-xs">
                      <Check size={12} className="text-emerald-400 shrink-0" />
                      <span className="text-muted-foreground">{feat}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* PLAN SELECTOR */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-border/40 bg-card p-5"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-5 flex items-center gap-2 text-foreground">
                  <Shield size={15} className="text-primary" />
                  O que está <span className="gold-text">incluso</span>
                </h2>

                <PlanSelector dailyPrice={dailyPrice} />
              </motion.div>

              {/* ADD-ONS (only items not in plan) */}
              <AnimatePresence mode="wait">
                {hasAnyAddonAvailable ? (
                  <motion.div
                    key="addons"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border border-border/40 bg-card p-5"
                  >
                    <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-foreground">
                      <Zap size={15} className="text-primary" />
                      Quer adicionar algo ao seu <span className="gold-text">plano</span>?
                    </h2>

                    <div className="space-y-3">
                      {/* Addon: Premium Insurance */}
                      {availableAddons.insurance && (
                        <>
                          <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                            addonInsurance ? "border-primary/30 bg-primary/5" : "border-border/20 bg-muted/10"
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center">
                                <ShieldCheck size={16} className="text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground">Seguro Premium</p>
                                <p className="text-[10px] text-muted-foreground">Franquia ZERO, Caução ZERO</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <p className="text-xs font-bold text-foreground whitespace-nowrap">+{formatPrice(PREMIUM_INSURANCE_DAILY)}/dia</p>
                              <Switch
                                checked={addonInsurance}
                                onCheckedChange={setAddonInsurance}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </div>
                          </div>

                        </>
                      )}

                      {/* Addon: Child Seat */}
                      {availableAddons.childSeat && (
                        <>
                          <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                            addonChildSeat ? "border-primary/30 bg-primary/5" : "border-border/20 bg-muted/10"
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center">
                                <Baby size={16} className="text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground">Cadeirinha Bebê/Criança</p>
                                <p className="text-[10px] text-muted-foreground">Homologada ISOFIX</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <p className="text-xs font-bold text-foreground whitespace-nowrap">{formatPrice(CHILD_SEAT_DAILY)}/dia</p>
                              <Switch
                                checked={addonChildSeat}
                                onCheckedChange={setAddonChildSeat}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </div>
                          </div>

                          <AnimatePresence>
                            {addonChildSeat && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="flex items-center gap-2.5 pl-12 pb-1">
                                  <p className="text-[10px] text-muted-foreground">Qtd:</p>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setAddonChildSeatQty(Math.max(1, addonChildSeatQty - 1))}
                                      className="w-6 h-6 rounded bg-muted/30 border border-border/30 text-foreground font-medium text-xs hover:bg-muted/50 transition-colors"
                                    >
                                      −
                                    </button>
                                    <span className="w-5 text-center text-xs font-semibold text-foreground">{addonChildSeatQty}</span>
                                    <button
                                      onClick={() => setAddonChildSeatQty(Math.min(3, addonChildSeatQty + 1))}
                                      className="w-6 h-6 rounded bg-muted/30 border border-border/30 text-foreground font-medium text-xs hover:bg-muted/50 transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-primary font-semibold">= {formatPrice(CHILD_SEAT_DAILY * addonChildSeatQty)}/dia</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}

                      {/* Addon: Toll Tag */}
                      {availableAddons.tollTag && (
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                          addonTollTag ? "border-primary/30 bg-primary/5" : "border-border/20 bg-muted/10"
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center">
                              <CircleDollarSign size={16} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">TAG Ilimitada Pedágios FL</p>
                              <p className="text-[10px] text-muted-foreground">SunPass inclusos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <p className="text-xs font-bold text-foreground whitespace-nowrap">{formatPrice(TOLL_TAG_DAILY)}/dia</p>
                            <Switch
                              checked={addonTollTag}
                              onCheckedChange={setAddonTollTag}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="all-included"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <ShieldCheck size={18} />
                      <p className="text-sm font-semibold">
                        Seu plano {currentPlan.name} já inclui todos os extras disponíveis
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT: Sticky Summary */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="sticky top-24 space-y-4"
              >
                {/* Price Summary Card */}
                <div className="rounded-xl border border-primary/20 bg-card p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-foreground">
                    <CircleDollarSign size={15} className="text-primary" />
                    Resumo do <span className="gold-text">Orçamento</span>
                  </h2>

                  <div className="space-y-2.5 text-xs">
                    {/* Rental */}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Locação ({days} {days === 1 ? "dia" : "dias"} x {formatPrice(dailyPrice)})</span>
                      <span className="font-semibold text-foreground">{formatPrice(pricing.subtotalRental)}</span>
                    </div>

                    {/* Plan extra */}
                    {pricing.planExtra > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{currentPlan.name} ({days} x {formatPrice(currentPlan.dailyExtra)})</span>
                        <span className="font-semibold text-foreground">{formatPrice(pricing.planExtra)}</span>
                      </div>
                    )}

                    {/* Add-on insurance */}
                    {pricing.addonInsuranceTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seguro Premium (avulso)</span>
                        <span className="font-semibold text-foreground">{formatPrice(pricing.addonInsuranceTotal)}</span>
                      </div>
                    )}

                    {/* Add-on child seat */}
                    {pricing.addonChildSeatTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cadeirinha (x{addonChildSeatQty})</span>
                        <span className="font-semibold text-foreground">{formatPrice(pricing.addonChildSeatTotal)}</span>
                      </div>
                    )}

                    {/* Add-on toll tag */}
                    {pricing.addonTollTagTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TAG Pedágios FL</span>
                        <span className="font-semibold text-foreground">{formatPrice(pricing.addonTollTagTotal)}</span>
                      </div>
                    )}

                    {/* Return fee */}
                    {isDifferentCity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Taxa de retorno
                          <span className="text-[9px] text-amber-400">(cidade diferente)</span>
                        </span>
                        <span className="font-semibold text-foreground">{currentPlan.returnFee === 0 ? "ZERO" : formatPrice(currentPlan.returnFee)}</span>
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-border/30 my-1.5" />

                    {/* Discount */}
                    {pricing.qualifiesDiscount && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex justify-between items-center p-2 rounded-md bg-emerald-500/10 border border-emerald-500/15"
                      >
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Percent size={12} />
                          Desconto 10+ diárias
                        </span>
                        <span className="font-bold text-emerald-400">- {formatPrice(pricing.discountAmount)}</span>
                      </motion.div>
                    )}

                    {!pricing.qualifiesDiscount && days >= 7 && (
                      <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-primary">
                          Reserve {LONG_RENTAL_MIN_DAYS - days}+ dia(s) a mais e ganhe 5% OFF
                        </p>
                      </div>
                    )}

                    {/* Total */}
                    <div className="pt-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-muted-foreground text-xs font-medium">Total</span>
                        <div className="text-right">
                          {pricing.qualifiesDiscount && (
                            <p className="text-[10px] text-muted-foreground line-through">{formatPrice(pricing.subtotalBeforeDiscount)}</p>
                          )}
                          <motion.p
                            key={pricing.total}
                            initial={{ scale: 1.05, opacity: 0.7 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-xl font-bold text-foreground"
                          >
                            {formatPrice(pricing.total)}
                          </motion.p>
                          {currency === "USD" && (
                            <p className="text-[11px] font-semibold text-primary mt-0.5">
                              ≈ {formatPriceIn(pricing.total, "BRL")}
                            </p>
                          )}
                          {currency === "BRL" && (
                            <p className="text-[11px] font-semibold text-primary mt-0.5">
                              ≈ {formatPriceIn(pricing.total, "USD")}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground text-right mt-0.5">
                        ≈ {formatPrice(Math.round(pricing.total / days))} /dia (média)
                        {currency === "USD" && (
                          <span className="ml-1 text-primary/80">· {formatPriceIn(Math.round(pricing.total / days), "BRL")}/dia</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Deposit / Deductible info */}
                  <div className={`mt-4 p-3 rounded-lg text-[11px] ${
                    hasPremiumInsurance
                      ? "bg-emerald-500/8 border border-emerald-500/15"
                      : "bg-amber-500/8 border border-amber-500/15"
                  }`}>
                    {hasPremiumInsurance ? (
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <ShieldCheck size={12} /> Proteção Premium ativa
                        </p>
                        <p className="text-emerald-400/80">Caução: <strong>ZERO</strong> · Franquia: <strong>ZERO</strong></p>
                        <p className="text-emerald-400/60">Você está 100% protegido</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <AlertTriangle size={12} /> Seguro Básico
                        </p>
                        <p className="text-amber-700 dark:text-amber-400/80">Caução: <strong>{formatPrice(BASIC_DEPOSIT)}</strong></p>
                        <p className="text-amber-700 dark:text-amber-400/80">Franquia: <strong>{formatPrice(basicDeductible)}</strong></p>
                        <p className="text-amber-600/70 dark:text-amber-400/50 text-[10px] mt-1">Depósito de segurança cobrado na retirada do veículo</p>
                        <p className="text-amber-600/80 dark:text-amber-400/60 mt-0.5">Adicione Seguro Premium para eliminar caução e franquia</p>
                      </div>
                    )}
                  </div>

                  {/* Plan badge */}
                  <div className="mt-3 p-2 rounded-lg bg-muted/20 border border-border/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Plano selecionado</p>
                    <p className="text-xs font-bold text-foreground">{currentPlan.name}</p>
                  </div>

                  {/* Customer Data */}
                  <div className="mt-4">
                    <CustomerDataStep data={customerData} onChange={setCustomerData} />
                  </div>

                  {/* Payment CTA */}
                  <button
                    onClick={handleCheckout}
                    disabled={isProcessing || vehiclesLoading || !dbVehicle}
                    className="mt-5 w-full gold-gradient text-primary-foreground py-3 rounded-lg text-xs font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        Pagar e Reservar {formatPrice(pricing.total)}
                      </>
                    )}
                  </button>

                  {checkoutError && (
                    <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                      <p className="text-[10px] text-destructive">{checkoutError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Lock size={10} className="text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground">
                      Pagamento seguro · Câmbio Real
                    </p>
                  </div>

                  {/* WhatsApp fallback */}
                  <a
                    href={whatsappMsg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center block underline underline-offset-2"
                  >
                    Prefere reservar pelo WhatsApp?
                  </a>
                </div>

                {/* Trust badges */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                  <div className="grid grid-cols-2 gap-2.5 text-center text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {[
                      { icon: ShieldCheck, label: "Seguro incluso" },
                      { icon: Car, label: "Milhas ilimitadas" },
                      { icon: Zap, label: "Retirada rápida" },
                      { icon: Users, label: "2º motorista grátis" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1 p-1.5">
                        <Icon size={15} className="text-primary" />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppBubble />
    </div>
  );
};

export default BookingDetails;
