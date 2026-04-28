import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, CheckCircle, Clock, CalendarDays } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { mockBookings, Booking } from "@/data/mockBookings";
import ClientHeader from "@/components/client/ClientHeader";
import BookingCard from "@/components/client/BookingCard";

const formatShortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const MyAccount = () => {
  const { user, customer, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");

  if (loading || !user) return null;

  const activeBooking = mockBookings.find((b) => b.status === "active" || b.status === "in_progress");
  const completedCount = mockBookings.filter((b) => b.status === "completed").length;
  const nextFuture = mockBookings
    .filter((b) => b.status === "confirmed" || b.status === "pending")
    .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime())[0];

  const filtered: Booking[] =
    tab === "all"
      ? mockBookings
      : tab === "active"
        ? mockBookings.filter((b) => b.status === "active" || b.status === "in_progress")
        : tab === "future"
          ? mockBookings.filter((b) => b.status === "confirmed" || b.status === "pending")
          : mockBookings.filter((b) => b.status === "completed");

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime()
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const profileIncomplete = !customer || !customer.phone || !customer.document_number;

  const stats = [
    { icon: Car, label: "Total de reservas", value: mockBookings.length.toString() },
    { icon: CheckCircle, label: "Concluídas", value: completedCount.toString() },
    {
      icon: Clock,
      label: "Ativa agora",
      value: activeBooking ? "1" : "0",
      pulse: !!activeBooking,
    },
    {
      icon: CalendarDays,
      label: "Próxima reserva",
      value: nextFuture ? formatShortDate(nextFuture.pickupDate) : "Nenhuma",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-20 sm:pt-24 pb-16">
        {/* Header */}
        <ClientHeader user={user} onLogout={handleLogout} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
              className="glass-card rounded-xl p-4 text-center"
            >
              <stat.icon size={20} className="mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-bold text-foreground mt-1 flex items-center justify-center gap-1.5">
                {stat.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Active booking highlight */}
        {activeBooking && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Reserva em andamento
            </h2>
            <BookingCard booking={activeBooking} index={0} featured />
          </div>
        )}

        {/* All bookings */}
        <div className="mt-10">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/50 mb-4 w-full grid grid-cols-4 h-auto p-1">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">Todas</TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">Ativas</TabsTrigger>
              <TabsTrigger value="future" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">Futuras</TabsTrigger>
              <TabsTrigger value="completed" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">Concluídas</TabsTrigger>
            </TabsList>
            <TabsContent value={tab}>
              <div className="space-y-3">
                {sorted.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Nenhuma reserva encontrada nesta categoria.
                  </p>
                ) : (
                  sorted.map((booking, i) => (
                    <BookingCard key={booking.id} booking={booking} index={i} />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyAccount;
