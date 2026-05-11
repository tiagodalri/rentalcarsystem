import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, Users, Briefcase, Settings, Smartphone, X, Share2, Check, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { useVehiclesDB, categoryToKey } from "@/hooks/useVehiclesDB";
import { coverImageMap, galleryMap } from "@/data/fleetAssets";
import { useToast } from "@/hooks/use-toast";

const VehicleDetail = () => {
  const { vehicleName } = useParams<{ vehicleName: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { vehicles: dbVehicles, loading } = useVehiclesDB();
  const { toast } = useToast();
  const [currentImage, setCurrentImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useState({ x: 0 })[0];

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
  const cover = coverImageMap[decodedName] || "/placeholder.svg";
  const gallery = galleryMap[decodedName] || { images: [], thumbs: [] };
  const images = useMemo(() => [cover, ...gallery.images.filter((img) => img !== cover)], [cover, gallery.images]);
  const thumbnails = useMemo(() => [cover, ...gallery.thumbs], [cover, gallery.thumbs]);
  const vehicleT = t.vehicles[decodedName];

  const nextImage = useCallback(() => setCurrentImage((p) => (p + 1) % images.length), [images.length]);
  const prevImage = useCallback(() => setCurrentImage((p) => (p - 1 + images.length) % images.length), [images.length]);

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
    document.title = decodedName ? `${decodedName} | Zeus Rental Car` : "Veículo | Zeus Rental Car";
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
        <div className="pt-32 text-center text-muted-foreground">Carregando...</div>
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

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden w-full max-w-[100vw] [overflow-anchor:none]">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 min-w-0">
            {/* Gallery */}
            <div className="min-w-0 max-w-full">
              <div
                className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden rounded-xl border border-border/40 bg-muted max-w-full touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImage}
                    src={images[currentImage]}
                    alt={`${decodedName} - ${currentImage + 1}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="w-full h-full object-contain cursor-zoom-in"
                    loading="eager"
                    decoding="async"
                    onClick={() => setIsFullscreen(true)}
                  />
                </AnimatePresence>

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      aria-label="Imagem anterior"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      onClick={nextImage}
                      aria-label="Próxima imagem"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight size={22} />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImage(i)}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            i === currentImage ? "bg-primary scale-125" : "bg-white/50 hover:bg-white/80"
                          }`}
                          aria-label={`Imagem ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 mt-3 max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      className={`flex-shrink-0 w-20 h-14 sm:w-24 sm:h-16 rounded-md overflow-hidden border-2 transition-all ${
                        i === currentImage ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
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
            </div>

            {/* Info */}
              <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
              <div className="min-w-0 max-w-full">
                <h1 className="max-w-full break-words text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-wide sm:tracking-wider leading-tight">{decodedName}</h1>
                {vehicleT?.subtitle && (
                  <p className="text-muted-foreground italic font-light mt-2 text-lg">{vehicleT.subtitle}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground max-w-full">
                <span className="flex min-w-0 items-center gap-2">
                  <Users size={16} className="text-primary" /> {dbv.passengers} {dbv.passengers === 1 ? "passageiro" : "passageiros"}
                </span>
                {dbv.bags > 0 && (
                  <span className="flex min-w-0 items-center gap-2">
                    <Briefcase size={16} className="text-primary" /> {dbv.bags} {dbv.bags === 1 ? "mala" : "malas"}
                  </span>
                )}
                <span className="flex min-w-0 items-center gap-2">
                  <Settings size={16} className="text-primary" /> Auto
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <Smartphone size={16} className="text-primary" /> CarPlay
                </span>
              </div>

              {vehicleT?.features && vehicleT.features.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 sm:px-5 py-2">
                  <div className="divide-y divide-border/50">
                    {vehicleT.features.map((feat) => (
                      <div key={feat} className="flex items-center justify-between gap-3 py-3.5 sm:py-3">
                        <span className="text-sm sm:text-base font-medium tracking-wide text-foreground">{feat}</span>
                        <Check size={16} className="text-primary flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate(`/reserva/${encodeURIComponent(decodedName)}`)}
                className="flex items-center justify-center gap-2 w-full gold-gradient text-primary-foreground py-4 sm:py-5 rounded-md text-sm sm:text-base font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                <Calendar className="w-5 h-5" />
                Reservar
              </button>
            </div>
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
