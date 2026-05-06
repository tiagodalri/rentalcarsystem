import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, MessageCircle, ChevronRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface BookingData {
  id: string;
  booking_number: string;
  customer_email: string;
  customer_name: string;
  vehicle_id: string;
  pickup_date: string;
  pickup_time: string | null;
  pickup_location: string | null;
  return_date: string;
  return_time: string | null;
  total_price: number | null;
  vehicles: { name: string } | null;
}

const BookingConfirmed = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const fetchBookingAndSendEmail = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("id, booking_number, customer_email, customer_name, vehicle_id, pickup_date, pickup_time, pickup_location, return_date, return_time, total_price, vehicles(name)")
          .eq("stripe_session_id", sessionId)
          .single();

        if (error || !data) {
          console.warn("Could not fetch booking by stripe_session_id:", error?.message);
          setLoading(false);
          return;
        }

        const bookingData = data as unknown as BookingData;
        setBooking(bookingData);
        setLoading(false);

        // Fire-and-forget: send booking-confirmation email
        if (!emailSent) {
          setEmailSent(true);

          // Get customer preferred language
          let lang: "pt" | "en" = "pt";
          try {
            const { data: custData } = await supabase
              .from("customers")
              .select("preferred_language")
              .eq("email", bookingData.customer_email)
              .maybeSingle();
            if (custData?.preferred_language === "en") lang = "en";
          } catch {
            // default pt
          }

          const firstName = (bookingData.customer_name || "").split(" ")[0];
          const vehicleName = bookingData.vehicles?.name || "";
          const totalFormatted = bookingData.total_price
            ? `$ ${bookingData.total_price.toFixed(2)}`
            : "—";

          supabase.functions
            .invoke("send-email", {
              body: {
                templateName: "booking-confirmation",
                recipientEmail: bookingData.customer_email,
                idempotencyKey: `booking-confirmation-${bookingData.id}`,
                language: lang,
                templateData: {
                  firstName,
                  bookingNumber: bookingData.booking_number,
                  vehicleName,
                  pickupDate: bookingData.pickup_date,
                  pickupTime: bookingData.pickup_time || "",
                  returnDate: bookingData.return_date,
                  returnTime: bookingData.return_time || "",
                  pickupLocation: bookingData.pickup_location || "Orlando, FL",
                  totalPrice: totalFormatted,
                  bookingDetailsUrl: `${window.location.origin}/minha-conta`,
                },
              },
            })
            .catch((err) => console.warn("Booking confirmation email failed:", err));
        }
      } catch (err) {
        console.error("Error fetching booking:", err);
        setLoading(false);
      }
    };

    fetchBookingAndSendEmail();
  }, [sessionId]);

  const bookingNumber = booking?.booking_number || "—";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-lg text-center">
          {/* Animated check icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
            >
              <Check size={36} className="text-emerald-500" strokeWidth={3} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              Reserva <span className="gold-text">confirmada!</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Seu pagamento foi aprovado e a reserva está garantida.
            </p>
          </motion.div>

          {/* Booking summary card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-6 mb-8 text-left"
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Código da Reserva</span>
                  <span className="text-sm font-bold font-mono text-primary">{bookingNumber}</span>
                </div>
                {booking?.vehicles?.name && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Veículo</span>
                    <span className="text-sm font-medium">{booking.vehicles.name}</span>
                  </div>
                )}
                {booking?.pickup_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Retirada</span>
                    <span className="text-sm font-medium">
                      {format(new Date(booking.pickup_date + "T12:00:00"), "dd/MM/yyyy")}
                      {booking.pickup_time ? ` · ${booking.pickup_time}` : ""}
                    </span>
                  </div>
                )}
                {booking?.return_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Devolução</span>
                    <span className="text-sm font-medium">
                      {format(new Date(booking.return_date + "T12:00:00"), "dd/MM/yyyy")}
                      {booking.return_time ? ` · ${booking.return_time}` : ""}
                    </span>
                  </div>
                )}
                {booking?.total_price && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/30">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
                    <span className="text-sm font-bold">$ {booking.total_price.toFixed(2)}</span>
                  </div>
                )}
                {sessionId && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">ID do Pagamento</span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">{sessionId}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você receberá um e-mail com os detalhes da reserva e instruções para a retirada do veículo.
              </p>
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/minha-conta"
              className="gold-gradient text-primary-foreground py-3 px-6 rounded-lg text-xs font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              Minhas Reservas
              <ChevronRight size={14} />
            </Link>
            <a
              href="https://wa.me/16892981754?text=Olá!%20Acabei%20de%20finalizar%20minha%20reserva%20e%20gostaria%20de%20mais%20informações."
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-6 rounded-lg text-xs font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BookingConfirmed;
