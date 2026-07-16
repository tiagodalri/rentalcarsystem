import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, Briefcase, CalendarIcon, MapPin, Clock, ArrowLeft, Check, AlertTriangle, Settings2, Fuel, Gauge, Snowflake, DoorOpen, Shield, SlidersHorizontal, ArrowUpDown, Pencil } from "lucide-react";
import { SearchResultsSkeleton } from "@/components/skeletons/PublicSkeletons";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import SearchBar from "@/components/SearchBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCurrency } from "@/i18n/CurrencyContext";
import { useVehiclesDB, categoryToKey, buildPriceMap } from "@/hooks/useVehiclesDB";
import { useVehicleAvailability } from "@/hooks/useVehicleAvailability";
import { useVehiclesPricingMap } from "@/hooks/useVehiclePricing";
import { getCoverImage } from "@/data/vehicleImages";
import { useAuth } from "@/hooks/useAuth";
import { calculateAge, isBlockedAge, isYoungDriver, YOUNG_DRIVER_SURCHARGE } from "@/lib/age";
import MobileSearchResults from "@/components/search/MobileSearchResults";

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
  const pickDbPhoto = (dbv: any): string | null => {
    const arr = Array.isArray(dbv?.photos) ? dbv.photos : [];
    const first = arr.find((p: any) => typeof p === "string" && p)
      || (typeof arr[0]?.url === "string" ? arr[0].url : null);
    return (typeof dbv?.image_url === "string" && dbv.image_url) ? dbv.image_url : first;
  };
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
      coverImage: pickDbPhoto(dbv) || getCoverImage(dbv.name),
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

  // Real availability — keep all vehicles, but mark unavailable ones so they appear at the bottom
  const { unavailableIds, loading: availabilityLoading } = useVehicleAvailability(pickupDate, returnDate);
  const isUnavailable = (id: string) => unavailableIds.has(id);
  const availableVehicles = baseVehicles; // alias kept for minimal downstream churn

  // Fetch real pricing (seasons, overrides, weekend multipliers, duration discounts) — for all vehicles
  const { map: pricingMap } = useVehiclesPricingMap(
    baseVehicles.map((v) => v.id),
    pickupDate,
    returnDate,
  );

  // ---- Filters + Sort state ----
  const [sortBy, setSortBy] = useState<"recommended" | "price_asc" | "price_desc" | "passengers_desc">("recommended");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPassengers, setMinPassengers] = useState<number>(0);
  const [minLuggage, setMinLuggage] = useState<number>(0);
  const [selectedTransmissions, setSelectedTransmissions] = useState<string[]>([]);

  const toggleArr = (arr: string[], v: string, setter: (a: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  // Helper to get total price for a vehicle (used for sort/display)
  const getTotalPrice = (v: SearchVehicle) => {
    const basePrice = vehiclePrices[v.name] || 99;
    const pricing = pricingMap[v.id];
    const ruleSubtotal = pricing?.subtotal_rental ?? basePrice * days;
    return youngDriver ? Math.ceil(ruleSubtotal * (1 + YOUNG_DRIVER_SURCHARGE)) : ruleSubtotal;
  };

  // Available filter options derived from data
  const availableCategories = useMemo(() => {
    const set = new Set(availableVehicles.map((v) => v.categoryKey));
    return Array.from(set);
  }, [availableVehicles]);
  const availableTransmissions = useMemo(() => {
    const set = new Set(availableVehicles.map((v) => v.transmission).filter(Boolean) as string[]);
    return Array.from(set);
  }, [availableVehicles]);

  // Apply filters + sort. Unavailable cars ALWAYS go to the bottom of the list.
  const vehicles = useMemo(() => {
    let list = availableVehicles.filter((v) => {
      if (selectedCategories.length && !selectedCategories.includes(v.categoryKey)) return false;
      if (minPassengers && v.passengers < minPassengers) return false;
      if (minLuggage && (v.luggage ?? 0) < minLuggage) return false;
      if (selectedTransmissions.length && (!v.transmission || !selectedTransmissions.includes(v.transmission))) return false;
      return true;
    });
    if (sortBy === "price_asc") list = [...list].sort((a, b) => getTotalPrice(a) - getTotalPrice(b));
    else if (sortBy === "price_desc") list = [...list].sort((a, b) => getTotalPrice(b) - getTotalPrice(a));
    else if (sortBy === "passengers_desc") list = [...list].sort((a, b) => b.passengers - a.passengers);
    // Stable: keep ordering above but push unavailable to the end
    list = [...list].sort((a, b) => Number(isUnavailable(a.id)) - Number(isUnavailable(b.id)));
    return list;
  }, [availableVehicles, selectedCategories, minPassengers, minLuggage, selectedTransmissions, sortBy, pricingMap, youngDriver, days, unavailableIds]);

  const availableCount = vehicles.filter((v) => !isUnavailable(v.id)).length;
  const unavailableCount = vehicles.length - availableCount;

  const activeFiltersCount =
    selectedCategories.length + selectedTransmissions.length + (minPassengers ? 1 : 0) + (minLuggage ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategories([]);
    setMinPassengers(0);
    setMinLuggage(0);
    setSelectedTransmissions([]);
  };

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

      {/* ───────── MOBILE ───────── */}
      <MobileSearchResults
        vehicles={vehicles}
        categoryLabels={categoryLabels}
        availableCategories={availableCategories}
        availableTransmissions={availableTransmissions}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        selectedTransmissions={selectedTransmissions}
        setSelectedTransmissions={setSelectedTransmissions}
        minPassengers={minPassengers}
        setMinPassengers={setMinPassengers}
        minLuggage={minLuggage}
        setMinLuggage={setMinLuggage}
        sortBy={sortBy}
        setSortBy={setSortBy}
        activeFiltersCount={activeFiltersCount}
        clearFilters={clearFilters}
        availableCount={availableCount}
        availabilityLoading={availabilityLoading}
        pickupDate={pickupDate}
        returnDate={returnDate}
        pickupTime={pickupTime}
        pickupLocation={pickupLocation}
        days={days}
        isUnavailable={isUnavailable}
        getPricing={(v) => {
          const basePrice = vehiclePrices[v.name] || 99;
          const pricing = pricingMap[v.id];
          const ruleSubtotal = pricing?.subtotal_rental ?? basePrice * days;
          const avgDaily = pricing?.avg_per_day ?? basePrice;
          const dailyDisplay = youngDriver ? Math.ceil(avgDaily * (1 + YOUNG_DRIVER_SURCHARGE)) : avgDaily;
          const totalPrice = youngDriver ? Math.ceil(ruleSubtotal * (1 + YOUNG_DRIVER_SURCHARGE)) : ruleSubtotal;
          return { totalPrice, dailyDisplay };
        }}
        toBRL={toBRL}
        detailUrlFor={(name) => `/veiculo/${encodeURIComponent(name)}?${searchParams.toString()}`}
      />

      {/* ───────── DESKTOP / TABLET ───────── */}
      <section className="hidden lg:block pt-24 pb-16">
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

            <div className="flex flex-col items-center text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-wider mb-2">
                Veículos <span className="gold-text">Disponíveis</span>
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                {availabilityLoading
                  ? "Checando disponibilidade…"
                  : `${availableCount} ${availableCount === 1 ? "carro disponível" : "carros disponíveis"} para o período`}
              </p>

              {/* Search criteria summary */}
              {(pickupDate || pickupLocation) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 rounded-xl inline-flex flex-wrap justify-center gap-4 text-sm"
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

              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                  >
                    <Pencil size={14} />
                    Alterar busca
                  </button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-5xl p-0 gap-0 overflow-hidden bg-background border-border/40">
                  <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
                    <DialogTitle className="text-lg font-bold uppercase tracking-wider">
                      Alterar <span className="gold-text">busca</span>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="px-4 sm:px-8 py-6 max-h-[80vh] overflow-y-auto [&_.glass-card]:!border-0 [&_.glass-card]:!bg-transparent [&_.glass-card]:!p-0 [&_.glass-card]:!shadow-none">
                    <SearchBar />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>


          {/* Layout: Sidebar filters + Results */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-7xl mx-auto">
            {/* Sidebar filters */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    <SlidersHorizontal size={14} className="text-primary" /> Filtros
                  </h2>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Limpar ({activeFiltersCount})
                    </button>
                  )}
                </div>

                {/* Category */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Categoria</p>
                  <div className="space-y-1.5">
                    {availableCategories.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => toggleArr(selectedCategories, cat, setSelectedCategories)}
                          className="accent-primary w-3.5 h-3.5"
                        />
                        {categoryLabels[cat] || cat}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Passengers */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Passageiros (mín.)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 2, 4, 5, 7].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMinPassengers(n)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          minPassengers === n
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/50 hover:border-primary/50"
                        }`}
                      >
                        {n === 0 ? "Todos" : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Luggage */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Malas (mín.)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMinLuggage(n)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          minLuggage === n
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/50 hover:border-primary/50"
                        }`}
                      >
                        {n === 0 ? "Todos" : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transmission */}
                {availableTransmissions.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Câmbio</p>
                    <div className="space-y-1.5">
                      {availableTransmissions.map((tx) => (
                        <label key={tx} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedTransmissions.includes(tx)}
                            onChange={() => toggleArr(selectedTransmissions, tx, setSelectedTransmissions)}
                            className="accent-primary w-3.5 h-3.5"
                          />
                          {tx === "Automatic" ? "Automático" : tx}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Main column: sort bar + results */}
            <div>
              {/* Sort bar */}
              <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-semibold">{vehicles.length}</span> {vehicles.length === 1 ? "resultado" : "resultados"}
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <ArrowUpDown size={13} className="text-primary" />
                  <span className="text-muted-foreground hidden sm:inline">Ordenar por</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-background border border-border/50 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="recommended">Recomendado</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="passengers_desc">Mais passageiros</option>
                  </select>
                </label>
              </div>

              {/* Results List */}
              <div className="flex flex-col gap-4">
            {vehicles.map((v, i) => {
              const basePrice = vehiclePrices[v.name] || 99;
              const pricing = pricingMap[v.id];
              const ruleSubtotal = pricing?.subtotal_rental ?? basePrice * days;
              const avgDaily = pricing?.avg_per_day ?? basePrice;
              const dailyDisplay = youngDriver ? Math.ceil(avgDaily * (1 + YOUNG_DRIVER_SURCHARGE)) : avgDaily;
              const totalPrice = youngDriver ? Math.ceil(ruleSubtotal * (1 + YOUNG_DRIVER_SURCHARGE)) : ruleSubtotal;
              const unavailable = isUnavailable(v.id);

              const detailUrl = `/veiculo/${encodeURIComponent(v.name)}?${searchParams.toString()}`;

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  onClick={() => { if (!unavailable) window.location.href = detailUrl; }}
                  className={`group relative overflow-hidden rounded-lg border bg-card/60 backdrop-blur-sm transition-all duration-300 ${
                    unavailable
                      ? "border-border/40 cursor-not-allowed"
                      : "border-border/50 hover:border-primary/50 hover:shadow-[0_6px_24px_-12px_hsl(var(--primary)/0.25)] cursor-pointer"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className={`relative sm:w-[210px] md:w-[230px] shrink-0 h-40 sm:h-auto sm:self-stretch overflow-hidden bg-muted/20 ${unavailable ? "opacity-60" : ""}`}>
                      <img
                        src={v.coverImage}
                        alt={v.name}
                        className={`w-full h-full object-contain transition-transform duration-700 ${unavailable ? "grayscale" : "group-hover:scale-105"}`}
                        loading="lazy"
                        width={640}
                        height={360}
                      />




                      <div className="absolute top-2 left-2">
                        {unavailable ? (
                          <span className="flex items-center gap-1 bg-muted-foreground/90 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md">
                            <AlertTriangle size={9} strokeWidth={3} />
                            Indisponível
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-emerald-500/95 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md">
                            <Check size={9} strokeWidth={3} />
                            Disponível
                          </span>
                        )}
                      </div>
                      {v.preparing && !unavailable && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-md">
                            Em preparação
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Middle: info */}
                    <div className="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between min-w-0">
                      <div>
                        <p className="text-[9px] text-primary font-semibold uppercase tracking-[0.18em] mb-0.5">
                          {categoryLabels[v.categoryKey] || v.categoryKey}
                        </p>
                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-foreground leading-tight">
                          {v.name}
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          ou similar da categoria
                        </p>

                        {/* Specs grid. Booking/Rentcars style */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 mt-2 text-[11px] text-foreground/80">
                          <span className="flex items-center gap-1.5">
                            <Users size={13} className="text-muted-foreground shrink-0" /> {v.passengers} passageiros
                          </span>
                          {v.luggage != null && (
                            <span className="flex items-center gap-1.5">
                              <Briefcase size={13} className="text-muted-foreground shrink-0" /> {v.luggage} {v.luggage === 1 ? "mala" : "malas"}
                            </span>
                          )}
                          {v.transmission && (
                            <span className="flex items-center gap-1.5">
                              <Settings2 size={13} className="text-muted-foreground shrink-0" /> {v.transmission === "Automatic" ? "Automático" : v.transmission === "Manual" ? "Manual" : v.transmission}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Gauge size={13} className="text-muted-foreground shrink-0" /> Quilometragem livre
                          </span>
                          {v.fuel && (
                            <span className="flex items-center gap-1.5">
                              <Fuel size={13} className="text-muted-foreground shrink-0" /> {v.fuel === "Gasoline" ? "Gasolina" : v.fuel === "Electric" ? "Elétrico" : v.fuel === "Hybrid" ? "Híbrido" : v.fuel === "Diesel" ? "Diesel" : v.fuel}
                            </span>
                          )}
                          {v.doors != null && (
                            <span className="flex items-center gap-1.5">
                              <DoorOpen size={13} className="text-muted-foreground shrink-0" /> {v.doors} portas
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Snowflake size={13} className="text-muted-foreground shrink-0" /> Ar-condicionado
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Shield size={13} className="text-muted-foreground shrink-0" /> Seguro básico incluso
                          </span>
                        </div>
                      </div>

                      {/* Benefits row (location + support) */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {pickupLocation ? (
                          <p className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <MapPin size={12} className="text-primary shrink-0" />
                            <span className="truncate">{pickupLocation}</span>
                          </p>
                        ) : <span />}
                        <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium min-w-0">
                          <Check size={12} strokeWidth={3} className="shrink-0" />
                          <span className="truncate">Suporte em português 24/7</span>
                        </p>
                      </div>

                    </div>

                    {/* Right: price + CTA */}
                    <div className={`sm:w-[190px] shrink-0 border-t sm:border-t-0 sm:border-l border-border/50 px-3 py-2.5 sm:px-4 sm:py-3 flex sm:flex-col items-end sm:items-stretch justify-between gap-2 ${unavailable ? "bg-muted/30" : "bg-muted/10"}`}>
                      {unavailable ? (
                        <>
                          <div className="text-right sm:text-right">
                            <p className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                              <AlertTriangle size={11} strokeWidth={3} />
                              Indisponível
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                              Este veículo já está reservado para as datas selecionadas.
                            </p>
                            <p className="text-[10px] text-muted-foreground/80 mt-2">
                              Diária a partir de <span className="font-semibold text-foreground/80">{toBRL(dailyDisplay)}</span>
                            </p>
                          </div>
                          <Link
                            to="/"
                            onClick={(e) => e.stopPropagation()}
                            className="border border-border/60 text-foreground/80 px-3 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-widest hover:bg-muted/40 transition-colors whitespace-nowrap text-center sm:w-full"
                          >
                            Mudar datas
                          </Link>
                        </>
                      ) : (
                        <>
                          <div className="text-right sm:text-right">
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                              Preço por {days} {days === 1 ? "dia" : "dias"}
                            </p>
                            <p className="text-xl md:text-2xl font-black gold-text leading-none mt-1">
                              {toBRL(totalPrice)}
                            </p>
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">
                              à vista com desconto
                            </p>
                            <p className="text-[10px] text-muted-foreground/80 mt-1.5 pt-1.5 border-t border-border/30">
                              {toBRL(dailyDisplay)} <span className="opacity-70">/dia</span>
                            </p>
                            <p className="text-[9px] text-muted-foreground/70 leading-snug mt-1.5">
                              Parcele sua reserva em até 12x. Consulte condições nas próximas etapas.
                            </p>
                          </div>
                          <Link
                            to={detailUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="gold-gradient text-primary-foreground px-3 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity whitespace-nowrap text-center sm:w-full"
                          >
                            Efetuar Reserva
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
              </div>

              {!availabilityLoading && vehicles.length === 0 && (
                <div className="rounded-xl border border-border/40 bg-card/40 p-8 sm:p-12 text-center">
                  <AlertTriangle size={28} className="text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-2">Nenhum carro disponível</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    {activeFiltersCount > 0
                      ? "Nenhum veículo corresponde aos filtros. Tente ajustá-los ou limpá-los."
                      : "Todos os veículos têm reservas sobrepondo o período escolhido. Tente outras datas."}
                  </p>
                  {activeFiltersCount > 0 ? (
                    <button onClick={clearFilters} className="inline-block gold-gradient text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                      Limpar filtros
                    </button>
                  ) : (
                    <Link to="/" className="inline-block gold-gradient text-primary-foreground px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                      Mudar datas
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </section>

      <Footer />
      <WhatsAppBubble />
    </div>
  );
};

export default SearchResults;
