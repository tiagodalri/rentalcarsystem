import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Users, Briefcase, Settings, Smartphone, X, Share2, Check, Calendar, MapPin, Shield, CreditCard, Plane, Clock, FileCheck, Fuel, BadgeCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { useLanguage } from "@/i18n/LanguageContext";
import { useVehiclesDB, categoryToKey } from "@/hooks/useVehiclesDB";
import { useVehiclePricing } from "@/hooks/useVehiclePricing";
import { useCurrency } from "@/i18n/CurrencyContext";
import { coverImageMap, galleryMap } from "@/data/fleetAssets";
import { useToast } from "@/hooks/use-toast";
import { LoadingRows } from "@/components/skeletons/LoadingRows";

const VehicleDetail = () => {
  const { vehicleName } = useParams<{ vehicleName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { formatPrice, currency, exchangeRate } = useCurrency();
  const { vehicles: dbVehicles, loading } = useVehiclesDB();
  const { toast } = useToast();
  const [currentImage, setCurrentImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useState({ x: 0 })[0];

  const pickupDateStr = searchParams.get("pickupDate");
  const returnDateStr = searchParams.get("returnDate");
  const pickupLocation = searchParams.get("pickupLocation") || "";
  const pickupDate = pickupDateStr ? new Date(pickupDateStr) : null;
  const returnDate = returnDateStr ? new Date(returnDateStr) : null;
  const days = pickupDate && returnDate
    ? Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    let frame = 0;
    let timeout = 0;

    const scrollTop = () => {
      root.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      root.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollTop();
    frame = window.requestAnimationFrame(scrollTop);
    timeout = window.setTimeout(scrollTop, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      root.style.scrollBehavior = previousScrollBehavior;
    };
  }, [vehicleName, loading]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.x = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.x;
    if (Math.abs(diff) < 50) return;
    if (diff < 0) setCurrentImage((p) => (p + 1) % images.length);
    else setCurrentImage((p) => (p - 1 + images.length) % images.length);
  };

  const decodedName = vehicleName ? decodeURIComponent(vehicleName) : "";
  const dbv = dbVehicles.find((v) => v.name === decodedName);
  const dbPhotos = useMemo(() => {
    const raw = dbv?.photos;
    if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === "string" && p.length > 0);
    return [];
  }, [dbv?.photos]);
  const fallbackGallery = galleryMap[decodedName] || { images: [], thumbs: [] };
  const fallbackCover = coverImageMap[decodedName] || "/placeholder.svg";
  const cover = dbPhotos.length > 0 ? (dbv?.image_url || dbPhotos[0]) : fallbackCover;
  const images = useMemo(() => {
    if (dbPhotos.length > 0) {
      return [cover, ...dbPhotos.filter((img) => img !== cover)];
    }
    return [cover, ...fallbackGallery.images.filter((img) => img !== cover)];
  }, [cover, dbPhotos, fallbackGallery.images]);
  const thumbnails = useMemo(() => {
    if (dbPhotos.length > 0) return images;
    return [cover, ...fallbackGallery.thumbs];
  }, [cover, dbPhotos, images, fallbackGallery.thumbs]);
  const vehicleT = t.vehicles[decodedName];

  // Real pricing for the selected period (seasons, weekend, discounts)
  const { data: rpcPricing } = useVehiclePricing(dbv?.id, pickupDate, returnDate);
  const basePrice = dbv?.daily_price_usd || 0;
  const subtotalRental = days > 0 ? (rpcPricing?.subtotal_rental ?? basePrice * days) : 0;
  const avgDaily = rpcPricing?.avg_per_day ?? basePrice;
  const deposit = dbv?.default_deposit_amount ?? 300;
  const franchise = dbv?.default_franchise_amount ?? 1200;

  const hasDates = !!(pickupDate && returnDate);
  const forwardQuery = searchParams.toString();

  const nextImage = useCallback(() => setCurrentImage((p) => (p + 1) % images.length), [images.length]);
  const prevImage = useCallback(() => setCurrentImage((p) => (p - 1 + images.length) % images.length), [images.length]);

  // Preload adjacent images so swipes/clicks feel instant
  useEffect(() => {
    if (images.length < 2) return;
    const next = (currentImage + 1) % images.length;
    const prev = (currentImage - 1 + images.length) % images.length;
    [images[next], images[prev]].forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  }, [currentImage, images]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, nextImage, prevImage]);

  useEffect(() => {
    document.title = decodedName ? `${decodedName} | GoDrive` : "Veículo | GoDrive";
  }, [decodedName]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: decodedName, url });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado", description: "Compartilhe com quem quiser" });
      } catch {
        toast({ title: "Não foi possível copiar", variant: "destructive" });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 px-4 max-w-5xl mx-auto"><LoadingRows count={4} rowHeight={120} /></div>
      </div>
    );
  }

  if (!dbv) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 pt-32 text-center">
          <h1 className="text-2xl font-bold mb-4">Veículo não encontrado</h1>
          <Link to="/" className="text-primary hover:underline">Voltar para a frota</Link>
        </div>
      </div>
    );
  }

  const seoTitle = `${decodedName} | Aluguel em Orlando — GoDrive`;
  const seoDescription = `Alugue ${decodedName} em Orlando com a GoDrive. Diária a partir de US$ ${basePrice}. Atendimento em português, retirada no aeroporto.`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: decodedName,
    image: cover,
    brand: { "@type": "Brand", name: (decodedName || "").split(" ")[0] },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: basePrice,
      availability: "https://schema.org/InStock",
      url: `https://rentalcarsystem.lovable.app/veiculo/${encodeURIComponent(decodedName)}`,
    },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden w-full max-w-[100vw] [overflow-anchor:none]">
      <Seo title={seoTitle} description={seoDescription} path={`/veiculo/${encodeURIComponent(decodedName)}`} image={cover} jsonLd={productJsonLd} />
      <Navbar />


      <main className="flex-1 pt-24 sm:pt-28 w-full max-w-full overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full min-w-0">
          <div className="flex items-center justify-between gap-3 mb-5 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share2 size={16} /> Compartilhar
            </button>
          </div>

          {/* Header */}
          <header className="mb-6 sm:mb-8 min-w-0 max-w-full">
            {dbv.category && (
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-primary/80 font-semibold mb-2">
                {dbv.category}
              </p>
            )}
            <h1 className="max-w-full break-words text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              {decodedName}
            </h1>
            {vehicleT?.subtitle && (
              <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">{vehicleT.subtitle}</p>
            )}
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10 min-w-0">
            {/* Coluna principal */}
            <div className="min-w-0 max-w-full space-y-8">
              {/* Galeria */}
              <section className="min-w-0 max-w-full">
                <div
                  className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/40 bg-muted max-w-full touch-pan-y"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    key={currentImage}
                    src={images[currentImage]}
                    alt={`${decodedName} - ${currentImage + 1}`}
                    className="w-full h-full object-cover cursor-zoom-in animate-fade-in"
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    onClick={() => setIsFullscreen(true)}
                  />

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        aria-label="Imagem anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={nextImage}
                        aria-label="Próxima imagem"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-2.5 right-3 text-[10px] uppercase tracking-wider text-white/90 bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
                        {currentImage + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex gap-1.5 mt-2.5 max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`flex-shrink-0 w-16 h-12 sm:w-[72px] sm:h-[52px] rounded-md overflow-hidden border-2 transition-all ${
                          i === currentImage ? "border-primary" : "border-transparent opacity-50 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={thumbnails[i] ?? img}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Specs */}
              <section>
                <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Especificações</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 flex items-center gap-2.5">
                    <Users size={16} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Passageiros</p>
                      <p className="text-sm font-medium mt-1 leading-none">{dbv.passengers}</p>
                    </div>
                  </div>
                  {dbv.bags > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 flex items-center gap-2.5">
                      <Briefcase size={16} className="text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Bagagem</p>
                        <p className="text-sm font-medium mt-1 leading-none">{dbv.bags} {dbv.bags === 1 ? "mala" : "malas"}</p>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 flex items-center gap-2.5">
                    <Settings size={16} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Câmbio</p>
                      <p className="text-sm font-medium mt-1 leading-none">Automático</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 flex items-center gap-2.5">
                    <Smartphone size={16} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Conectividade</p>
                      <p className="text-sm font-medium mt-1 leading-none">CarPlay</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Features */}
              {vehicleT?.features && vehicleT.features.length > 0 && (
                <section>
                  <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Equipamentos & conforto</h2>
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-4 sm:px-5">
                    <div className="divide-y divide-border/40">
                      {vehicleT.features.map((feat) => (
                        <div key={feat} className="flex items-center justify-between gap-3 py-3">
                          <span className="text-sm text-foreground">{feat}</span>
                          <Check size={15} className="text-primary flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* O que está incluído */}
              <section>
                <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">O que está incluído</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { icon: Check, label: "Milhagem ilimitada em toda a Flórida" },
                    { icon: Shield, label: "Seguro básico (LDW) e responsabilidade civil" },
                    { icon: Plane, label: "Entrega e devolução no Aeroporto de Orlando (MCO)" },
                    { icon: BadgeCheck, label: "Atendimento bilíngue 24/7 em português" },
                    { icon: FileCheck, label: "Assistência mecânica e guincho durante a locação" },
                    { icon: Fuel, label: "Tanque cheio na retirada, devolver com tanque cheio" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-3 py-2.5">
                      <Icon size={15} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground/90 leading-snug">{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Como funciona a entrega */}
              <section>
                <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Como funciona a entrega</h2>
                <div className="rounded-lg border border-border/50 bg-muted/15 divide-y divide-border/40">
                  <div className="flex gap-3 p-4">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold tabular-nums">1</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Veículo pronto no horário marcado</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Higienizado, abastecido e revisado, aguardando você no ponto de encontro do Aeroporto de Orlando (MCO) ou no endereço escolhido.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold tabular-nums">2</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Recepção em português</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Um concierge da GoDrive recebe você, faz a vistoria de entrega em conjunto e explica todos os detalhes do veículo, dos seguros e dos opcionais contratados.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold tabular-nums">3</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Devolução simples e flexível</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">No dia da devolução, basta nos avisar pelo WhatsApp ao chegar. Toleramos até 59 minutos de atraso sem cobrança de diária adicional.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Caução, franquia e políticas */}
              <section>
                <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Caução, franquia e políticas</h2>
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm font-medium">Depósito caução (pré-autorização)</p>
                          <span className="text-sm font-semibold tabular-nums">{formatPrice(deposit)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Valor bloqueado (não cobrado) no cartão de crédito internacional do condutor principal na retirada. É liberado pelo banco em até 30 dias após a devolução, desde que o veículo seja entregue nas mesmas condições. Não aceitamos cartão de débito ou pré-pago.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <div className="flex items-start gap-3">
                      <Shield size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm font-medium">Franquia em caso de sinistro</p>
                          <span className="text-sm font-semibold tabular-nums">até {formatPrice(franchise)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Valor máximo de participação do locatário em caso de avaria ou roubo coberto pelo seguro básico. Você pode reduzir ou zerar essa franquia contratando o seguro Premium na próxima etapa da reserva.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <div className="flex items-start gap-3">
                      <Clock size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Prazo de devolução</p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          A diária é contada de 24 em 24 horas a partir do horário de retirada. Tolerância de 59 minutos. Após esse prazo, é cobrada uma diária adicional proporcional. Devoluções antecipadas não geram reembolso parcial.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/15 p-4">
                    <div className="flex items-start gap-3">
                      <FileCheck size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Documentos do condutor</p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Idade mínima de 21 anos, passaporte válido, CNH (brasileira ou internacional) emitida há pelo menos 1 ano e cartão de crédito internacional em nome do condutor principal.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </section>
            </div>

            {/* Sidebar de preço */}
            <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start space-y-4">
              {hasDates ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">
                    <Calendar size={12} /> Preço para o período
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-primary/70" />
                      {format(pickupDate!, "dd MMM yyyy", { locale: pt })} → {format(returnDate!, "dd MMM yyyy", { locale: pt })}
                    </p>
                    <p>{days} {days === 1 ? "diária" : "diárias"}</p>
                    {pickupLocation && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-primary/70" /> {pickupLocation}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">Total do período</p>
                    {exchangeRate && subtotalRental > 0 ? (
                      <>
                        <p className="text-3xl sm:text-4xl font-black gold-text tabular-nums leading-none">
                          R$ {Math.ceil(subtotalRental * exchangeRate).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                          equivalente a <span className="text-foreground/80 font-medium">US$ {subtotalRental.toLocaleString("en-US")}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black gold-text tabular-nums leading-none">
                        {formatPrice(subtotalRental)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Diária média</p>
                      <p className="text-[11px] text-foreground/85 font-medium tabular-nums mt-0.5">{formatPrice(avgDaily)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Caução</p>
                      <p className="text-[11px] text-foreground/85 font-medium tabular-nums mt-0.5">{formatPrice(deposit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Franquia</p>
                      <p className="text-[11px] text-foreground/85 font-medium tabular-nums mt-0.5">{formatPrice(franchise)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/reserva/${encodeURIComponent(decodedName)}?${forwardQuery}`)}
                    className="flex items-center justify-center gap-2 w-full gold-gradient text-primary-foreground py-3.5 rounded-md text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    <Calendar className="w-4 h-4" />
                    Efetuar Reserva
                  </button>

                  <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
                    Sem cobrança agora. Você revisa todos os opcionais e seguros na próxima etapa.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 bg-muted/30 p-5 space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Escolha as datas no buscador para ver o preço exato deste veículo.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="flex items-center justify-center gap-2 w-full gold-gradient text-primary-foreground py-3.5 rounded-md text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    <Calendar className="w-4 h-4" />
                    Escolher datas
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-foreground/80">
                  <Plane size={14} className="text-primary" /> Entrega no aeroporto incluída
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground/80">
                  <Shield size={14} className="text-primary" /> Seguro básico já incluso
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground/80">
                  <Smartphone size={14} className="text-primary" /> Suporte 24/7 em português
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>


      <Footer />

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
              aria-label="Fechar tela cheia"
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>

            {images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                aria-label="Imagem anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img
              src={images[currentImage]}
              alt={`${decodedName} - ${currentImage + 1}`}
              className="max-w-[95vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                aria-label="Próxima imagem"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VehicleDetail;
