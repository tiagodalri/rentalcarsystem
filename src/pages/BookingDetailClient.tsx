// auth handled by RequireAuth wrapper
import { useParams, useNavigate } from "react-router-dom";
import { useCurrency } from "@/i18n/CurrencyContext";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Star,
  ShieldCheck,
  Baby,
  CreditCard,
  Navigation,
  MessageCircle,
  XCircle,
  Fuel,
  Check,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import { mockBookings } from "@/data/mockBookings";
import BookingStatusBadge from "@/components/client/BookingStatusBadge";
import BookingTimeline from "@/components/client/BookingTimeline";
import PricingBreakdown from "@/components/client/PricingBreakdown";
import InsuranceCard from "@/components/client/InsuranceCard";
import FuelGauge from "@/components/client/FuelGauge";
import ExtraChargesTable from "@/components/client/ExtraChargesTable";
import ContractButton from "@/components/client/ContractButton";

const BookingDetailClient = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const booking = mockBookings.find((b) => b.id === bookingId);

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-5xl px-4 pt-24 pb-16 text-center">
          <p className="text-muted-foreground">Reserva não encontrada.</p>
          <button onClick={() => navigate("/minha-conta")} className="text-primary mt-4 text-sm">
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  const pickupDate = new Date(booking.pickupDate);
  const dropoffDate = new Date(booking.dropoffDate);
  const formatFull = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const extras = [
    {
      label: "Seguro Premium",
      active: booking.extras.premiumInsurance,
      icon: ShieldCheck,
    },
    {
      label: "Cadeirinha infantil",
      active: booking.extras.childSeat,
      icon: Baby,
    },
    {
      label: "TAG pedágio ilimitada",
      active: booking.extras.tollTag,
      icon: CreditCard,
    },
    {
      label: "Devolução em outra cidade",
      active: booking.extras.oneWay,
      icon: Navigation,
    },
  ];

  const isFuture = booking.status === "confirmed" || booking.status === "pending";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-20 sm:pt-24 pb-16">
        {/* Back */}
        <button
          onClick={() => navigate("/minha-conta")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider"
        >
          <ArrowLeft size={14} />
          Voltar ao painel
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 space-y-6"
          >
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-mono text-sm text-muted-foreground">{booking.id}</span>
                <BookingStatusBadge status={booking.status} pulse={booking.status === "active"} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{booking.vehicle}</h1>
              <p className="text-sm text-muted-foreground italic">{booking.category}</p>
            </div>

            {/* Cover */}
            <div className="rounded-xl overflow-hidden">
              <img
                src={booking.coverImage}
                alt={booking.vehicle}
                className="w-full h-48 sm:h-64 object-cover"
              />
            </div>

            {/* Timeline */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                Status da reserva
              </h3>
              <BookingTimeline
                status={booking.status}
                pickupDate={booking.pickupDate}
                dropoffDate={booking.dropoffDate}
              />
            </div>

            {/* Rental details */}
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Detalhes da locação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Retirada</p>
                    <p className="text-foreground">{booking.pickupLocation}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Devolução</p>
                    <p className="text-foreground">{booking.dropoffLocation}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Data retirada</p>
                    <p className="text-foreground">{formatFull(pickupDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Data devolução</p>
                    <p className="text-foreground">{formatFull(dropoffDate)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-primary" />
                <span className="text-foreground font-medium">{booking.rentalDays} dias</span>
                {booking.extras.oneWay && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                    Devolução em outra cidade
                  </span>
                )}
              </div>
            </div>

            {/* Insurance */}
            <InsuranceCard
              isPremium={booking.extras.premiumInsurance}
              deposit={booking.deposit}
              franchise={booking.franchise}
            />

            {/* Extras */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                Extras contratados
              </h3>
              <div className="space-y-2">
                {extras.map((extra) => (
                  <div key={extra.label} className="flex items-center gap-2.5 text-sm">
                    {extra.active ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <X size={14} className="text-muted-foreground/40" />
                    )}
                    <extra.icon size={14} className={extra.active ? "text-primary" : "text-muted-foreground/40"} />
                    <span className={extra.active ? "text-foreground" : "text-muted-foreground/40 line-through"}>
                      {extra.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fuel */}
            {booking.status === "completed" && booking.fuelDropoff && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  <Fuel size={14} className="inline mr-1.5" />
                  Combustível
                </h3>
                <div className="flex gap-6">
                  <FuelGauge level={booking.fuelPickup} label="Retirada" />
                  <FuelGauge level={booking.fuelDropoff} label="Devolução" />
                </div>
                {booking.fuelPickup !== booking.fuelDropoff && (
                  <p className="text-xs text-amber-400 mt-3">
                    Tanque devolvido abaixo do nível de retirada. Cobrança de reabastecimento aplicada.
                  </p>
                )}
              </div>
            )}

            {/* Extra charges */}
            {booking.extraCharges.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <ExtraChargesTable charges={booking.extraCharges} />
              </div>
            )}
          </motion.div>

          {/* Right sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full lg:w-80 shrink-0"
          >
            <div className="lg:sticky lg:top-24 space-y-4">
              {/* Pricing */}
              <div className="glass-card gold-border-glow rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  Resumo financeiro
                </h3>
                <PricingBreakdown
                  pricing={booking.pricing}
                  dailyRate={booking.dailyRate}
                  rentalDays={booking.rentalDays}
                  discountApplied={booking.discountApplied}
                />
              </div>

              {/* Deposit */}
              <div className="glass-card rounded-xl p-4">
                {booking.extras.premiumInsurance ? (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <ShieldCheck size={16} />
                    Sem caução necessário
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Caução</p>
                    <p className="text-foreground font-bold">{formatPrice(booking.deposit)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {booking.status === "completed" ? "Devolvido" : "Retido"}
                    </p>
                  </div>
                )}
              </div>

              {/* Contract */}
              <ContractButton url={booking.contractUrl} />

              {/* Actions for future */}
              {isFuture && (
                <div className="space-y-2">
                  <a
                    href="https://wa.me/16892981754"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 border border-border/50 rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <MessageCircle size={16} />
                    Falar com a Zeus
                  </a>
                  <button className="w-full flex items-center justify-center gap-2 border border-destructive/30 rounded-lg px-4 py-3 text-sm font-medium text-destructive/70 hover:text-destructive hover:border-destructive/50 transition-colors">
                    <XCircle size={16} />
                    Cancelar reserva
                  </button>
                </div>
              )}

              {/* Rating */}
              {booking.status === "completed" && (
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Sua avaliação
                  </p>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={20}
                        className={
                          booking.rating && s <= booking.rating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BookingDetailClient;
