import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Briefcase, SlidersHorizontal, UserRound, ChevronDown, Check, Diamond } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useVehiclesDB, categoryToKey } from "@/hooks/useVehiclesDB";
import { coverImageMap, galleryMap } from "@/data/fleetAssets";

export interface Vehicle {
  name: string;
  categoryKey: string;
  passengers: number;
  luggage?: number;
  coverImage: string;
  galleryImages: string[];
  galleryThumbs: string[];
  preparing?: boolean;
}

const categoryKeys = ["all", "superSport", "sport", "suvPremium", "suvFullSize", "suv", "suvCompact", "minivan"] as const;
const passengerFilters = ["all", "2", "4-5", "6-7"];

const matchPassenger = (p: number, filter: string) => {
  if (filter === "all") return true;
  if (filter === "2") return p === 2;
  if (filter === "4-5") return p >= 4 && p <= 5;
  if (filter === "6-7") return p >= 6 && p <= 7;
  return true;
};

const FleetSection = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [activePassengers, setActivePassengers] = useState("all");
  
  const [openFilter, setOpenFilter] = useState<"category" | "passengers" | null>(null);
  const { t } = useLanguage();
  const { vehicles: dbVehicles } = useVehiclesDB();

  // Merge DB data with local image assets (DB photos win when present).
  // Dedup by name so duplicate fleet entries (ex: 2 "Chrysler Pacifica") nao
  // estouram a chave do React/AnimatePresence (bug que causava tela em branco).
  const seenNames = new Set<string>();
  const vehicles: Vehicle[] = dbVehicles
    .filter((dbv: any) => {
      const name = (dbv?.name || "").trim();
      if (!name || seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    })
    .map((dbv: any) => {
      const name = (dbv.name || "").trim();
      const gallery = galleryMap[name] || { images: [], thumbs: [] };
      const dbPhotos: string[] = Array.isArray(dbv?.photos)
        ? dbv.photos.map((p: any) => (typeof p === "string" ? p : p?.url)).filter((u: any) => typeof u === "string" && u)
        : [];
      const cover = (typeof dbv?.image_url === "string" && dbv.image_url) || dbPhotos[0] || coverImageMap[name] || "/placeholder.svg";
      const images = dbPhotos.length ? dbPhotos : gallery.images;
      const thumbs = dbPhotos.length ? dbPhotos : gallery.thumbs;
      return {
        name,
        categoryKey: categoryToKey(dbv.category),
        passengers: dbv.passengers,
        luggage: dbv.bags,
        coverImage: cover,
        galleryImages: images,
        galleryThumbs: thumbs,
        preparing: dbv.status === "preparing",
      };
    });

  const categoryLabels: Record<string, string> = {
    all: t.fleet.all,
    superSport: t.fleet.superSport,
    sport: t.fleet.sport,
    suvPremium: t.fleet.suvPremium,
    suvFullSize: t.fleet.suvFullSize,
    suv: t.fleet.suv,
    minivan: t.fleet.minivan,
    suvCompact: t.fleet.suvCompact,
  };

  const passengerLabels: Record<string, string> = {
    all: t.fleet.all,
    "2": "2",
    "4-5": "4-5",
    "6-7": "6-7",
  };

  const filtered = vehicles.filter((v) => {
    const catMatch = activeCategory === "all" || v.categoryKey === activeCategory;
    const pasMatch = matchPassenger(v.passengers, activePassengers);
    return catMatch && pasMatch;
  });


  const activeCount = filtered.length;
  const isPortuguese = t.fleet.sectionTag.includes("Frota");

  const toggleFilter = (filter: "category" | "passengers") => {
    setOpenFilter((prev) => (prev === filter ? null : filter));
  };

  return (
    <section id="frota" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="section-eyebrow">
            {t.fleet.sectionTag}
          </p>
          <h2 className="section-heading">
            {t.fleet.title}<br />
            <span className="gold-text">{t.fleet.titleHighlight}</span>
          </h2>
        </motion.div>

        <div className="mb-12 max-w-md mx-auto space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => toggleFilter("category")}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal size={16} className="text-primary" />
                <span className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
                  {isPortuguese ? "Categoria" : "Category"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {activeCategory !== "all" && (
                  <span className="text-xs text-primary font-medium">{categoryLabels[activeCategory]}</span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-300 ${openFilter === "category" ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            <AnimatePresence>
              {openFilter === "category" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 px-3 py-2">
                    {categoryKeys.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setOpenFilter(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                          activeCategory === cat
                            ? "text-primary font-semibold bg-primary/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <span className="tracking-wide">{categoryLabels[cat]}</span>
                        {activeCategory === cat && <Check size={16} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => toggleFilter("passengers")}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserRound size={16} className="text-primary" />
                <span className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
                  {t.fleet.passengers.replace(":", "")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {activePassengers !== "all" && (
                  <span className="text-xs text-primary font-medium">{activePassengers} pass.</span>
                )}
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-300 ${openFilter === "passengers" ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            <AnimatePresence>
              {openFilter === "passengers" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 px-3 py-2">
                    {passengerFilters.map((pf) => (
                      <button
                        key={pf}
                        onClick={() => {
                          setActivePassengers(pf);
                          setOpenFilter(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                          activePassengers === pf
                            ? "text-primary font-semibold bg-primary/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <span className="tracking-wide">{passengerLabels[pf]}</span>
                        {activePassengers === pf && <Check size={16} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-muted-foreground/70 tracking-wide pt-1">
            {activeCount} {activeCount === 1 ? "veículo" : "veículos"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((v, idx) => {
              const vehicleT = t.vehicles[v.name];
              const eager = idx < 4;
              return (
                <motion.div
                  key={v.name}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25 }}
                  className="group relative flex items-stretch gap-3 sm:gap-4 rounded-xl cursor-pointer overflow-hidden border border-border/40 hover:border-primary/40 bg-card/60 hover:bg-card transition-all duration-300"
                  onClick={() => navigate(`/veiculo/${encodeURIComponent(v.name)}`)}
                >
                  <div className="relative w-28 sm:w-36 shrink-0 overflow-hidden bg-muted/40">
                    <div
                      aria-hidden
                      className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/60 via-muted/30 to-muted/60"
                    />
                    <img
                      src={v.coverImage}
                      alt={v.name}
                      className="relative w-full h-full object-cover object-[center_45%] transition-transform duration-700 group-hover:scale-105"
                      loading={eager ? "eager" : "lazy"}
                      decoding="async"
                      {...({ fetchpriority: eager ? "high" : "auto" } as Record<string, string>)}
                      width={640}
                      height={480}
                      onLoad={(e) => {
                        const prev = (e.currentTarget.previousElementSibling as HTMLElement | null);
                        if (prev) prev.style.display = "none";
                      }}
                    />
                    {v.preparing && (
                      <span className="absolute top-1.5 left-1.5 bg-primary/95 text-primary-foreground text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                        Preparo
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 py-3 pr-3 sm:py-3.5 sm:pr-4 flex flex-col justify-center">
                    <p className="text-[9.5px] text-primary font-bold uppercase tracking-[0.18em] truncate">
                      {categoryLabels[v.categoryKey] || v.categoryKey}
                    </p>
                    <h3 className="text-[13.5px] sm:text-[14.5px] font-black uppercase tracking-wide text-foreground leading-tight mt-0.5 truncate">
                      {v.name}
                    </h3>
                    {vehicleT?.subtitle && (
                      <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                        {vehicleT.subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-primary" /> {v.passengers}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase size={12} className="text-primary" /> {v.luggage}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {[1, 2].map((i) => (
              <motion.div
                key={`surprise-${i}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 * i }}
                className="relative flex items-stretch gap-3 sm:gap-4 rounded-xl border border-dashed border-primary/25 bg-card/40 overflow-hidden"
              >
                <div className="w-28 sm:w-36 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.08]">
                  <Diamond size={22} className="text-primary" strokeWidth={1.2} />
                </div>
                <div className="flex-1 min-w-0 py-3 pr-3 sm:py-3.5 sm:pr-4 flex flex-col justify-center">
                  <p className="text-[9.5px] text-primary font-bold uppercase tracking-[0.18em]">
                    Em breve
                  </p>
                  <h3 className="text-[13.5px] sm:text-[14.5px] font-black uppercase tracking-wide text-foreground/70 leading-tight mt-0.5">
                    Novidade GoDrive
                  </h3>
                  <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                    Surpresa exclusiva
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground mt-12 text-lg">
            {t.fleet.noResults}
          </p>
        )}
      </div>

    </section>
  );
};

export default FleetSection;
