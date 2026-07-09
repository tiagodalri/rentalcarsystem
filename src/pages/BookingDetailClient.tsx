// auth handled by RequireAuth wrapper
import { useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
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
  Loader2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import { useBookingByNumber } from "@/hooks/useBookingByNumber";
import { adaptBookingFromDb } from "@/lib/bookingAdapter";
import BookingStatusBadge from "@/components/client/BookingStatusBadge";
import BookingTimeline from "@/components/client/BookingTimeline";
import PricingBreakdown from "@/components/client/PricingBreakdown";
import InsuranceCard from "@/components/client/InsuranceCard";
import FuelGauge from "@/components/client/FuelGauge";
import ExtraChargesTable from "@/components/client/ExtraChargesTable";
import ContractButton from "@/components/client/ContractButton";
import ClientContractPanel from "@/components/client/ClientContractPanel";


const BookingDetailClient = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const { booking: dbBooking, loading, error } = useBookingByNumber(bookingId);
  const [cancelling, setCancelling] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-5xl px-4 pt-24 pb-16 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error / not found
  if (error || !dbBooking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-5xl px-4 pt-24 pb-16 text-center">
          <p className="text-muted-foreground">{error || "Reserva não encontrada."}</p>
          <button onClick={() => navigate("/minha-conta")} className="text-primary mt-4 text-sm">
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  const booking = adaptBookingFromDb(dbBooking);

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

  const pickupIsInFuture = new Date(booking.pickupDate) > new Date();
  const isFuture = (booking.status === "confirmed" || booking.status === "pending") && pickupIsInFuture;
  const hasContractUrl = booking.contractAvailable;
  const hasFuelData = booking.status === "completed" && booking.fuelDropoff;
  const hasExtraCharges = booking.extraCharges && booking.extraCharges.length > 0;



  const handleCancelBooking = async () => {
    setCancelling(true);
    try {
      // Re-validate client-side
      if (!["pending", "confirmed"].includes(dbBooking.status)) {
        toast.error("Esta reserva não pode mais ser cancelada.");
        setCancelling(false);
        return;
      }
      if (parseDateOnly(dbBooking.pickup_date) <= new Date()) {
        toast.error("Não é possível cancelar reservas com data de retirada passada.");
        setCancelling(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        setCancelling(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: "Cancelado pelo cliente",
        } as any)
        .eq("id", dbBooking.id);

      if (updateError) {
        console.error("Cancel error:", updateError);
        toast.error("Não foi possível cancelar. Tente novamente.");
        setCancelling(false);
        return;
      }

      // Fire-and-forget email
      supabase.functions.invoke("send-email", {
        body: {
          templateName: "booking-cancellation",
          recipientEmail: dbBooking.customer_email || "",
          idempotencyKey: `booking-cancellation-${dbBooking.id}`,
          language: "pt",
          templateData: {
            firstName: (dbBooking.customer_name || "").split(" ")[0] || "",
            bookingNumber: dbBooking.booking_number || "",
            vehicleName: dbBooking.vehicle?.name || "—",
            originalPickupDate: dbBooking.pickup_date,
            cancellationDate: new Date().toISOString().split("T")[0],
            refundAmount: "A definir",
            refundMethod: "Estorno via cartão de origem",
            refundDeadline: "Até 10 dias úteis",
            bookingDetailsUrl: `https://rentalcarsystem.lovable.app/minha-conta/reserva/${dbBooking.booking_number}`,
          },
        },
      });

      toast.success("Reserva cancelada. Você receberá um email de confirmação.");
      setTimeout(() => navigate("/minha-conta"), 1500);
    } catch (err) {
      console.error("Cancel exception:", err);
      toast.error("Erro inesperado ao cancelar. Tente novamente.");
      setCancelling(false);
    }
  };

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
            {booking.coverImage && (
              <div className="rounded-xl overflow-hidden">
                <img
                  src={booking.coverImage}
                  alt={booking.vehicle}
                  className="w-full h-48 sm:h-64 object-cover"
                  loading="lazy"
                  width={640}
                  height={360}
                />
              </div>
            )}

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
                {booking.pickupLocation && (
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Retirada</p>
                      <p className="text-foreground">{booking.pickupLocation}</p>
                    </div>
                  </div>
                )}
                {booking.dropoffLocation && (
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Devolução</p>
                      <p className="text-foreground">{booking.dropoffLocation}</p>
                    </div>
                  </div>
                )}
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

            {/* Fuel — only show if data exists */}
            {hasFuelData && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  <Fuel size={14} className="inline mr-1.5" />
                  Combustível
                </h3>
                <div className="flex gap-6">
                  <FuelGauge level={booking.fuelPickup} label="Retirada" />
                  <FuelGauge level={booking.fuelDropoff!} label="Devolução" />
                </div>
                {booking.fuelPickup !== booking.fuelDropoff && (
                  <p className="text-xs text-amber-400 mt-3">
                    Tanque devolvido abaixo do nível de retirada. Cobrança de reabastecimento aplicada.
                  </p>
                )}
              </div>
            )}

            {/* Extra charges — only show if data exists */}
            {hasExtraCharges && (
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

              {/* Contract — sign / download */}
              <ClientContractPanel
                bookingId={dbBooking.id}
                contractStatus={(dbBooking as any).contract_status ?? null}
                signedAt={(dbBooking as any).contract_signed_at ?? null}
                signedPdfPath={(dbBooking as any).contract_signed_pdf_url ?? null}
              />

              {/* Legacy: simple PDF preview button (rascunho não assinado) */}
              {hasContractUrl && (dbBooking as any).contract_status !== "signed" && (
                <div className="space-y-1.5">
                  <ContractButton bookingId={dbBooking.id} />
                  <p className="text-[10px] text-muted-foreground/70 text-center uppercase tracking-wider">
                    Pré-visualização (rascunho)
                  </p>
                </div>
              )}


              {/* Actions for future */}
              {isFuture && (
                <div className="space-y-2">
                  <a
                    href="https://wa.me/15550000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 border border-border/50 rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <MessageCircle size={16} />
                    Falar com a Sua Marca
                  </a>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={cancelling}
                        className="w-full flex items-center justify-center gap-2 border border-destructive/30 rounded-lg px-4 py-3 text-sm font-medium text-destructive/70 hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
                      >
                        {cancelling ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                        {cancelling ? "Cancelando..." : "Cancelar reserva"}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Você receberá um email de confirmação.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancelBooking}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sim, cancelar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Rating — only show for completed with rating */}
              {booking.status === "completed" && booking.rating && (
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
