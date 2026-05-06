import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Users, Briefcase, Settings, Smartphone, MessageCircle, Maximize, Minimize } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface VehicleModalProps {
  vehicle: {
    name: string;
    categoryKey: string;
    passengers: number;
    luggage?: number;
    images: string[];
    thumbnails: string[];
  };
  categoryLabel: string;
  onClose: () => void;
  whatsappUrl: string;
}

const VehicleModal = ({ vehicle, categoryLabel, onClose, whatsappUrl }: VehicleModalProps) => {
  const [currentImage, setCurrentImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useLanguage();
  const vehicleT = t.vehicles[vehicle.name];

  const nextImage = () => setCurrentImage((prev) => (prev + 1) % vehicle.images.length);
  const prevImage = () => setCurrentImage((prev) => (prev - 1 + vehicle.images.length) % vehicle.images.length);

  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, currentImage]);

  useEffect(() => {
    setCurrentImage(0);
  }, [vehicle.name]);

  useEffect(() => {
    const nextIndex = (currentImage + 1) % vehicle.images.length;
    const prevIndex = (currentImage - 1 + vehicle.images.length) % vehicle.images.length;

    [vehicle.images[nextIndex], vehicle.images[prevIndex]].forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  }, [currentImage, vehicle.images]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background border border-white/10 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden rounded-t-xl">
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            title="Tela cheia"
          >
            <Maximize size={16} />
          </button>
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImage}
              src={vehicle.images[currentImage]}
              alt={`${vehicle.name} - ${currentImage + 1}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </AnimatePresence>

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
            {vehicle.images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentImage ? "bg-primary scale-125" : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 p-3 sm:p-4 overflow-x-auto">
          {vehicle.images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentImage(i)}
              className={`flex-shrink-0 w-16 h-11 sm:w-20 sm:h-14 rounded-md overflow-hidden border-2 transition-all ${
                i === currentImage ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={vehicle.thumbnails[i] ?? img}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                width={320}
                height={220}
              />
            </button>
          ))}
        </div>

        <div className="px-5 pb-6 pt-1 sm:px-8 sm:pb-8 sm:pt-2 space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-wider leading-tight">{vehicle.name}</h2>
            <p className="text-muted-foreground italic font-light mt-1.5 text-base sm:text-lg">{vehicleT?.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users size={16} className="text-primary" /> {vehicle.passengers} {t.fleet.passengers.replace(":", "")}
            </span>
            {vehicle.luggage && (
              <span className="flex items-center gap-2">
                <Briefcase size={16} className="text-primary" /> {vehicle.luggage}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Settings size={16} className="text-primary" /> Auto
            </span>
            <span className="flex items-center gap-2">
              <Smartphone size={16} className="text-primary" /> CarPlay
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 sm:px-5 py-2">
            <div className="divide-y divide-border/50">
              {vehicleT?.features.map((feat) => (
                <div key={feat} className="flex items-center justify-between gap-3 py-3.5 sm:py-3">
                  <span className="text-sm sm:text-base font-medium tracking-wide text-foreground">{feat}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full gold-gradient text-primary-foreground py-4 sm:py-5 rounded-md text-sm sm:text-base font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={18} />
            {t.fleet.book}
          </a>
        </div>
      </motion.div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
            onClick={toggleFullscreen}
          >
            <button
              onClick={toggleFullscreen}
              aria-label="Sair da tela cheia"
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <Minimize size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              aria-label="Imagem anterior"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>

            <img
              src={vehicle.images[currentImage]}
              alt={`${vehicle.name} - ${currentImage + 1}`}
              className="max-w-[95vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              aria-label="Próxima imagem"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={24} />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {vehicle.images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentImage(i); }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === currentImage ? "bg-primary scale-125" : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VehicleModal;
