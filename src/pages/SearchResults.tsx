import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Briefcase, CalendarIcon, MapPin, Clock, ArrowLeft, Check, AlertTriangle, Settings2, Fuel, Gauge, Snowflake, DoorOpen, Shield } from "lucide-react";
import { SearchResultsSkeleton } from "@/components/skeletons/PublicSkeletons";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { useCurrency } from "@/i18n/CurrencyContext";
import { useVehiclesDB, categoryToKey, buildPriceMap } from "@/hooks/useVehiclesDB";
import { useVehicleAvailability } from "@/hooks/useVehicleAvailability";
import { useVehiclesPricingMap } from "@/hooks/useVehiclePricing";
import { getCoverImage } from "@/data/vehicleImages";
import { useAuth } from "@/hooks/useAuth";
import { calculateAge, isBlockedAge, isYoungDriver, YOUNG_DRIVER_SURCHARGE } from "@/lib/age";

interface SearchVehicle {
  id: string;
  name: string;
  categoryKey: string;
  passengers: number;
  luggage?: number;
  transmission?: string;
  fuel?: string;
  doors?: number | null;
  coverImage: string;
  preparing?: boolean;
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

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const { formatPrice, exchangeRate } = useCurrency();
  const toBRL = (usd: number) =>
    exchangeRate ? `R$ ${Math.ceil(usd * exchangeRate).toLocaleString("pt-BR")}` : `R$ ${Math.ceil(usd * 6.27).toLocaleString("pt-BR")}`;
  const toUSD = (usd: number) => `US$ ${Math.round(usd).toLocaleString("en-US")}`;
  const { vehicles: dbVehicles } = useVehiclesDB();
  const { customer, loading: authLoading } = useAuth();
  const vehiclePrices = buildPriceMap(dbVehicles);

  // Build vehicles list from DB (exclude archived/sold/preparing-for-sale states)
  const baseVehicles: SearchVehicle[] = dbVehicles
    .filter((v) => !["archived", "sold", "test"].includes((v.status || "").toLowerCase()))
    .map((dbv) => ({
      id: dbv.id,
      name: dbv.name,
      categoryKey: categoryToKey(dbv.category),
      passengers: dbv.passengers,
      luggage: dbv.bags,
      transmission: dbv.transmission,
      fuel: dbv.fuel,
      doors: dbv.doors,
      coverImage: getCoverImage(dbv.name),
      preparing: dbv.status === "preparing",
    }));

  const pickupDateStr = searchParams.get("pickupDate");
  const returnDateStr = searchParams.get("returnDate");
  const pickupTime = searchParams.get("pickupTime") || "10:00";
  const pickupLocation = searchParams.get("pickupLocation") || "";
  const returnLocation = searchParams.get("returnLocation") || pickupLocation;
  const driverAgeParam = searchParams.get("driverAge");
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

  // Real availability — filter out vehicles with overlapping bookings (Turo + future paid)
  const { unavailableIds, loading: availabilityLoading } = useVehicleAvailability(pickupDate, returnDate);
  const vehicles = baseVehicles.filter((v) => !unavailableIds.has(v.id));

  // Fetch real pricing (seasons, overrides, weekend multipliers, duration discounts)
  const { map: pricingMap } = useVehiclesPricingMap(
    vehicles.map((v) => v.id),
    pickupDate,
    returnDate,
  );

  const whatsappMsg = (name: string) => {
    const dateInfo = pickupDate
      ? `\nRetirada: ${format(pickupDate, "dd/MM/yyyy", { locale: pt })} às ${pickupTime}\nLocal: ${pickupLocation}`
      : "";
    const returnInfo = returnDate
      ? `\nDevolução: ${format(returnDate, "dd/MM/yyyy", { locale: pt })}\nLocal devolução: ${returnLocation}`
      : "";
    return `https://wa.me/16892981754?text=${encodeURIComponent(
      `Olá! Tenho interesse no ${name}.${dateInfo}${returnInfo}\n\nGostaria de mais informações!`
    )}`;
  };

  if (authLoading) {
    return <SearchResultsSkeleton />;
  }

  if (blockedByAge) {
    return (
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 max-w-2xl">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm mb-6"
            >
              <ArrowLeft size={16} />
              Voltar à página inicial
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

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back + Search Summary */}
          <div className="mb-10">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm mb-6"
            >
              <ArrowLeft size={16} />
              Voltar à página inicial
            </Link>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-wider mb-2">
              Veículos <span className="gold-text">Disponíveis</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              {availabilityLoading
                ? "Checando disponibilidade…"
                : `${vehicles.length} ${vehicles.length === 1 ? "carro disponível" : "carros disponíveis"} para o período`}
            </p>

            {/* Search criteria summary */}
            {(pickupDate || pickupLocation) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 rounded-xl inline-flex flex-wrap gap-4 text-sm"
              >
                {pickupDate && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon size={14} className="text-primary" />
                    {format(pickupDate, "dd MMM yyyy", { locale: pt })}
                    {returnDate && ` → ${format(returnDate, "dd MMM yyyy", { locale: pt })}`}
                    <span className="text-primary font-semibold ml-1">({days} {days === 1 ? "dia" : "dias"})</span>
                  </span>
                )}
                {pickupTime && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={14} className="text-primary" />
                    {pickupTime}
                  </span>
                )}
                {pickupLocation && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin size={14} className="text-primary" />
                    {pickupLocation}
                  </span>
                )}
              </motion.div>
            )}
          </div>

          {/* Results List (Booking/Decolar style) */}
          <div className="flex flex-col gap-4 max-w-5xl mx-auto">
            {vehicles.map((v, i) => {
              const basePrice = vehiclePrices[v.name] || 99;
              const pricing = pricingMap[v.id];
              const ruleSubtotal = pricing?.subtotal_rental ?? basePrice * days;
              const avgDaily = pricing?.avg_per_day ?? basePrice;
              const dailyDisplay = youngDriver ? Math.ceil(avgDaily * (1 + YOUNG_DRIVER_SURCHARGE)) : avgDaily;
              const totalPrice = youngDriver ? Math.ceil(ruleSubtotal * (1 + YOUNG_DRIVER_SURCHARGE)) : ruleSubtotal;

              const detailUrl = `/veiculo/${encodeURIComponent(v.name)}?${searchParams.toString()}`;

              return (
                <motion.div
                  key={v.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  onClick={() => (window.location.href = detailUrl)}
                  className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:shadow-[0_6px_24px_-12px_hsl(var(--primary)/0.25)] transition-all duration-300 cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className="relative sm:w-[200px] md:w-[220px] shrink-0 h-36 sm:h-[150px] overflow-hidden">
                      <img
                        src={v.coverImage}
                        alt={v.name}
                        className="w-full h-full object-cover object-[center_40%] transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                        width={640}
                        height={360}
                      />
                      <div className="absolute top-2 left-2">
                        <span className="flex items-center gap-1 bg-emerald-500/95 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md">
                          <Check size={9} strokeWidth={3} />
                          Disponível
                        </span>
                      </div>
                      {v.preparing && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md">
                            Em preparação
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Middle: info */}
                    <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <p className="text-[9px] text-primary font-semibold uppercase tracking-[0.18em] mb-0.5">
                          {categoryLabels[v.categoryKey] || v.categoryKey}
                        </p>
                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-foreground leading-tight">
                          {v.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users size={12} className="text-primary" /> {v.passengers} passageiros
                          </span>
                          {v.luggage && (
                            <span className="flex items-center gap-1">
                              <Briefcase size={12} className="text-primary" /> {v.luggage} malas
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          Quilometragem livre
                        </span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
                          Cancelamento grátis
                        </span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/40">
                          Suporte PT
                        </span>
                      </div>
                    </div>

                    {/* Right: price + CTA */}
                    <div className="sm:w-[180px] shrink-0 border-t sm:border-t-0 sm:border-l border-border/50 bg-muted/10 p-3 sm:p-4 flex sm:flex-col items-end sm:items-stretch justify-between gap-2">
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                          {days} {days === 1 ? "diária" : "diárias"} · total
                        </p>
                        <p className="text-xl md:text-2xl font-black gold-text leading-none mt-1">
                          {toBRL(totalPrice)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          equivalente a {toUSD(totalPrice)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {toBRL(dailyDisplay)} <span className="opacity-70">/dia</span>
                        </p>
                      </div>

                      <Link
                        to={detailUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="gold-gradient text-primary-foreground px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity whitespace-nowrap text-center sm:w-full"
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {!availabilityLoading && vehicles.length === 0 && (
            <div className="rounded-xl border border-border/40 bg-card/40 p-8 sm:p-12 text-center">
              <AlertTriangle size={28} className="text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Nenhum carro disponível para essas datas</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Todos os veículos têm reservas sobrepondo o período escolhido. Tente outras datas.
              </p>
              <Link to="/" className="inline-block gold-gradient text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                Mudar datas
              </Link>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <WhatsAppBubble />
    </div>
  );
};

export default SearchResults;
