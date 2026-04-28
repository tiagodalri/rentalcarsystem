import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Briefcase, CalendarIcon, MapPin, Clock, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { useCurrency } from "@/i18n/CurrencyContext";
import { useVehiclesDB, categoryToKey, buildPriceMap } from "@/hooks/useVehiclesDB";
import { getCoverImage } from "@/data/vehicleImages";
import { useAuth } from "@/hooks/useAuth";
import { calculateAge, isBlockedAge, isYoungDriver, YOUNG_DRIVER_SURCHARGE } from "@/lib/age";

interface SearchVehicle {
  name: string;
  categoryKey: string;
  passengers: number;
  luggage?: number;
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
  const { formatPrice } = useCurrency();
  const { vehicles: dbVehicles } = useVehiclesDB();
  const { customer } = useAuth();
  const vehiclePrices = buildPriceMap(dbVehicles);

  // Build vehicles list from DB
  const vehicles: SearchVehicle[] = dbVehicles.map((dbv) => ({
    name: dbv.name,
    categoryKey: categoryToKey(dbv.category),
    passengers: dbv.passengers,
    luggage: dbv.bags,
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

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-wider mb-4">
              Veículos <span className="gold-text">Disponíveis</span>
            </h1>

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

          {/* Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((v, i) => {
              const basePrice = vehiclePrices[v.name] || 99;
              const dailyPrice = isUnder26 ? Math.ceil(basePrice * (1 + YOUNG_DRIVER_SURCHARGE)) : basePrice;
              const totalPrice = dailyPrice * days;

              const bookingUrl = `/reserva/${encodeURIComponent(v.name)}?${searchParams.toString()}`;

              return (
                <motion.div
                  key={v.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  onClick={() => window.location.href = bookingUrl}
                  className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 cursor-pointer"
                >
                  {/* Image */}
                  <div className="relative h-48 sm:h-64 overflow-hidden">
                    <img
                      src={v.coverImage}
                      alt={v.name}
                      className="w-full h-full object-cover object-[center_40%] transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* no fade overlay */}

                    {/* Availability badge */}
                    <div className="absolute top-3 left-3">
                      <span className="flex items-center gap-1.5 bg-emerald-500/90 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">
                        <Check size={12} strokeWidth={3} />
                        Disponível
                      </span>
                    </div>

                    {v.preparing && (
                      <div className="absolute top-3 right-3">
                        <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">
                          Em preparação
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-wider text-foreground">{v.name}</h3>
                        <p className="text-xs text-primary font-medium uppercase tracking-widest">
                          {categoryLabels[v.categoryKey] || v.categoryKey}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Users size={13} className="text-primary" /> {v.passengers} pass.
                      </span>
                      {v.luggage && (
                        <span className="flex items-center gap-1">
                          <Briefcase size={13} className="text-primary" /> {v.luggage} malas
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="border-t border-border/40 pt-4 flex flex-col xs:flex-row items-stretch xs:items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">A partir de</p>
                        <p className="text-2xl font-black text-foreground">
                          {formatPrice(dailyPrice)}
                          <span className="text-sm font-medium text-muted-foreground"> /dia</span>
                        </p>
                        {days > 1 && (
                          <p className="text-xs text-primary font-semibold mt-0.5">
                            Total: {formatPrice(totalPrice)} ({days} dias)
                          </p>
                        )}
                      </div>

                      <Link
                        to={bookingUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="gold-gradient text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity whitespace-nowrap text-center"
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppBubble />
    </div>
  );
};

export default SearchResults;
