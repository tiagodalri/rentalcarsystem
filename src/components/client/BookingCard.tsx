import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Booking } from "@/data/bookingTypes";
import { useCurrency } from "@/i18n/CurrencyContext";
import BookingStatusBadge from "./BookingStatusBadge";
import { useAccountT } from "@/i18n/accountTranslations";

interface BookingCardProps {
  booking: Booking;
  index: number;
  featured?: boolean;
}

function getBookingProgress(b: Booking): number {
  if (b.status === "completed") return 100;
  if (b.status === "pending" || b.status === "confirmed" || b.status === "cancelled") return 0;
  const now = new Date().getTime();
  const start = new Date(b.pickupDate).getTime();
  const end = new Date(b.dropoffDate).getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function getProgressColor(b: Booking): string {
  if (b.status === "completed") return "bg-emerald-500";
  if (b.status === "active" || b.status === "in_progress") return "bg-amber-500";
  return "bg-muted-foreground/30";
}

const BookingCard = ({ booking, index, featured }: BookingCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { t, formatDate } = useAccountT();
  const progress = getBookingProgress(booking);
  const progressColor = getProgressColor(booking);

  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        onClick={() => navigate(`/minha-conta/reserva/${booking.id}`)}
        className="glass-card gold-border-glow rounded-xl overflow-hidden cursor-pointer hover:scale-[1.005] transition-transform duration-300"
      >
        <div className="flex flex-col md:flex-row">
          <div className="md:w-2/5 h-48 md:h-auto relative overflow-hidden">
            <img
              src={booking.coverImage}
              alt={booking.vehicle}
              className="w-full h-full object-cover"
              loading="lazy"
              width={640}
              height={360}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <BookingStatusBadge status={booking.status} pulse />
            </div>
          </div>
          <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {booking.status === "in_progress" ? t.cardInProgress : t.cardActive}
              </p>
              <h3 className="text-xl font-bold text-foreground">{booking.vehicle}</h3>
              <p className="text-sm text-muted-foreground italic">{booking.category}</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  {formatDate(booking.pickupDate)}. {formatDate(booking.dropoffDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-primary" />
                  {t.dropoffLabel}: {booking.dropoffLocation}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-5 gap-3">
              <div className="w-full sm:w-auto">
                <div className="space-y-1.5">
                  {booking.daysRemaining != null && (
                    <p className="text-sm font-semibold text-foreground">
                      {t.cardReturnIn(booking.daysRemaining)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 w-48">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">{progress}%</span>
                  </div>
                </div>
              </div>
              <button className="flex items-center gap-1 gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity">
                {t.viewDetails}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onClick={() => navigate(`/minha-conta/reserva/${booking.id}`)}
      className="glass-card rounded-xl overflow-hidden cursor-pointer hover:scale-[1.01] transition-transform duration-300 flex flex-col sm:flex-row"
    >
      <div className="sm:w-40 h-32 sm:h-auto relative overflow-hidden shrink-0">
        <img
          src={booking.coverImage}
          alt={booking.vehicle}
          className="w-full h-full object-cover"
          loading="lazy"
          width={320}
          height={220}
        />
      </div>
      <div className="p-4 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{booking.vehicle}</h3>
            <BookingStatusBadge status={booking.status} pulse={booking.status === "active" || booking.status === "in_progress"} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
            <Calendar size={12} />
            {formatDate(booking.pickupDate)}. {formatDate(booking.dropoffDate)}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{booking.pickupLocation}</p>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-2 w-32">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{progress}%</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-lg font-bold gold-text">{formatPrice(booking.pricing?.total ?? 0)}</p>
          <ChevronRight size={18} className="text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
};

export default BookingCard;
