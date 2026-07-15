import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, CheckCircle, Clock, CalendarDays, CalendarX, UserCog, CalendarRange } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileTab from "@/components/account/ProfileTab";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useUserBookings } from "@/hooks/useUserBookings";
import { adaptBookingFromDb } from "@/lib/bookingAdapter";
import { Booking } from "@/data/bookingTypes";
import ClientHeader from "@/components/client/ClientHeader";
import BookingCard from "@/components/client/BookingCard";
import { AccountSkeleton } from "@/components/skeletons/AccountSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { useAccountT } from "@/i18n/accountTranslations";
import ClientBottomNav from "@/components/client/ClientBottomNav";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";


const MyAccount = () => {
  const { user, customer, loading: authLoading, signOut } = useAuth();
  const { bookings: dbBookings, loading: bookingsLoading, refetch } = useUserBookings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const outerTab = searchParams.get("tab") === "perfil" ? "perfil" : "reservas";
  const [tab, setTab] = useState("all");
  const { t, formatDate } = useAccountT();

  const loading = authLoading || bookingsLoading;

  if (loading) return <AccountSkeleton />;
  if (!user) return null;

  const allBookings: Booking[] = dbBookings.map(adaptBookingFromDb);

  const activeBooking = allBookings.find((b) => b.status === "active" || b.status === "in_progress");
  const completedCount = allBookings.filter((b) => b.status === "completed").length;
  const nextFuture = allBookings
    .filter((b) => b.status === "confirmed" || b.status === "pending")
    .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime())[0];

  const filtered: Booking[] =
    tab === "all"
      ? allBookings
      : tab === "active"
        ? allBookings.filter((b) => b.status === "active" || b.status === "in_progress")
        : tab === "future"
          ? allBookings.filter((b) => b.status === "confirmed" || b.status === "pending")
          : allBookings.filter((b) => b.status === "completed");

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime()
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const profileIncomplete = !customer || !customer.phone || !customer.document_number;

  const stats = [
    { icon: Car, label: t.statTotal, value: allBookings.length.toString() },
    { icon: CheckCircle, label: t.statCompleted, value: completedCount.toString() },
    {
      icon: Clock,
      label: t.statActive,
      value: activeBooking ? "1" : "0",
      pulse: !!activeBooking,
    },
    {
      icon: CalendarDays,
      label: t.statNext,
      value: nextFuture ? formatDate(nextFuture.pickupDate) : t.none,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 pt-20 sm:pt-24 pb-16">
        {/* Header */}
        <ClientHeader user={user} onLogout={handleLogout} />

        {profileIncomplete && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-500">{t.completeProfileTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.completeProfileDesc}
              </p>
            </div>
            <button
              onClick={() => setSearchParams({ tab: "perfil" })}
              className="text-xs font-bold uppercase tracking-wider gold-gradient text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              {t.completeNow}
            </button>
          </div>
        )}

        {/* OUTER TABS: Reservas | Perfil */}
        <Tabs
          value={outerTab}
          onValueChange={(v) => setSearchParams(v === "perfil" ? { tab: "perfil" } : {})}
          className="mt-6"
        >
          <TabsList className="bg-muted/50 w-full grid grid-cols-2 h-auto p-1">
            <TabsTrigger value="reservas" className="text-xs uppercase tracking-wider flex items-center gap-1.5">
              <CalendarRange size={13} /> {t.tabReservations}
            </TabsTrigger>
            <TabsTrigger value="perfil" className="text-xs uppercase tracking-wider flex items-center gap-1.5">
              <UserCog size={13} /> {t.tabProfile}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="mt-6">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="reservas" className="mt-6">
        {/* RESERVAS CONTENT START */}

        {allBookings.length === 0 ? (
          <div className="mt-16">
            <EmptyState
              icon={CalendarX}
              title={t.emptyTitle}
              description={t.emptyDesc}
              actionLabel={t.emptyCta}
              onAction={() => navigate("/")}
            />
          </div>
        ) : (
          <>
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
                  {t.sectionActive}
                </h2>
                <BookingCard booking={activeBooking} index={0} featured />
              </div>
            )}

            {/* All bookings */}
            <div className="mt-10">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="bg-muted/50 mb-4 w-full grid grid-cols-4 h-auto p-1">
                  <TabsTrigger value="all" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">{t.filterAll}</TabsTrigger>
                  <TabsTrigger value="active" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">{t.filterActive}</TabsTrigger>
                  <TabsTrigger value="future" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">{t.filterFuture}</TabsTrigger>
                  <TabsTrigger value="completed" className="text-[10px] sm:text-xs uppercase tracking-wider px-1.5 sm:px-3">{t.filterCompleted}</TabsTrigger>
                </TabsList>
                <TabsContent value={tab}>
                  <div className="space-y-3">
                    {sorted.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        {t.noResults}
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
          </>
        )}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default MyAccount;
