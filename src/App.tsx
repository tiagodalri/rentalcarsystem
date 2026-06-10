import { lazy, Suspense, useLayoutEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/i18n/ThemeContext";
import { CurrencyProvider } from "@/i18n/CurrencyContext";
import Index from "./pages/Index.tsx";
import AboutUs from "./pages/AboutUs.tsx";
import SearchResults from "./pages/SearchResults.tsx";
import BookingDetails from "./pages/BookingDetails.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import BookingConfirmed from "./pages/BookingConfirmed.tsx";
import CustomerRegistration from "./pages/CustomerRegistration.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Contato from "./pages/Contato.tsx";
import VehicleDetail from "./pages/VehicleDetail.tsx";
import Frota from "./pages/Frota.tsx";
import PublicTrack from "./pages/PublicTrack.tsx";

import RequireAuth from "./components/RequireAuth.tsx";
import { RequireRole } from "./components/admin/RequireRole.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import { AdminShellSkeleton } from "./components/skeletons/AdminShellSkeleton.tsx";
import { AccountSkeleton } from "./components/skeletons/AccountSkeleton.tsx";
import InstallPrompt from "./components/InstallPrompt.tsx";

// Lazy-loaded: client authenticated pages
const MyAccount = lazy(() => import("./pages/MyAccount.tsx"));
const BookingDetailClient = lazy(() => import("./pages/BookingDetailClient.tsx"));

// Lazy-loaded: admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminPainel = lazy(() => import("./pages/admin/AdminPainel.tsx"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings.tsx"));
const AdminFleet = lazy(() => import("./pages/admin/AdminFleet.tsx"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers.tsx"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));
const AdminLive = lazy(() => import("./pages/admin/AdminLive.tsx"));
const AdminInspection = lazy(() => import("./pages/admin/AdminInspection.tsx"));
const AdminInspectionCompare = lazy(() => import("./pages/admin/AdminInspectionCompare.tsx"));
const AdminInspectionReport = lazy(() => import("./pages/admin/AdminInspectionReport.tsx"));
const AdminVehicleHistory = lazy(() => import("./pages/admin/AdminVehicleHistory.tsx"));
const AdminVehicleDetail = lazy(() => import("./pages/admin/AdminVehicleDetail.tsx"));
const AdminReportRedirect = lazy(() => import("./pages/admin/AdminPainel.tsx").then(m => ({ default: m.AdminReportRedirect })));
const AdminFleetPnLRedirect = lazy(() => import("./pages/admin/AdminPainel.tsx").then(m => ({ default: m.AdminFleetPnLLegacyRedirect })));
const AdminBookingDetail = lazy(() => import("./pages/admin/AdminBookingDetail.tsx"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance.tsx"));
const AdminTeam = lazy(() => import("./pages/admin/AdminTeam.tsx"));
const AdminOpsToday = lazy(() => import("./pages/admin/AdminOpsToday.tsx"));
const AdminFleetGantt = lazy(() => import("./pages/admin/AdminFleetGantt.tsx"));
const AdminVehicleNew = lazy(() => import("./pages/admin/AdminVehicleNew.tsx"));
const AdminBookingNew = lazy(() => import("./pages/admin/AdminBookingNew.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const AdminSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<AdminShellSkeleton />}>{children}</Suspense>
);

const ClientSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<AccountSkeleton />}>{children}</Suspense>
);

const forceScrollTop = () => {
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;

  root.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  root.scrollTop = 0;
  document.body.scrollTop = 0;
  root.style.scrollBehavior = previousScrollBehavior;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    forceScrollTop();
    const frame = window.requestAnimationFrame(forceScrollTop);

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <InstallPrompt />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/share/track/:token" element={<PublicTrack />} />

              <Route path="/sobre-nos" element={<AboutUs />} />
              <Route path="/frota" element={<Frota />} />
              <Route path="/buscar" element={<SearchResults />} />
              <Route path="/veiculo/:vehicleName" element={<VehicleDetail />} />
              <Route path="/reserva/:vehicleName" element={<BookingDetails />} />
              <Route path="/reserva/confirmada" element={<BookingConfirmed />} />
              <Route path="/cadastro" element={<CustomerRegistration />} />
              <Route path="/login" element={<Login />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route path="/contato" element={<Contato />} />
              <Route path="/minha-conta" element={<RequireAuth><ClientSuspense><MyAccount /></ClientSuspense></RequireAuth>} />
              <Route path="/minha-conta/reserva/:bookingId" element={<RequireAuth><ClientSuspense><BookingDetailClient /></ClientSuspense></RequireAuth>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<RequireRole roles={["admin","finance","operations","support"]}><AdminSuspense><AdminPainel /></AdminSuspense></RequireRole>} />
                <Route path="bookings" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminBookings /></AdminSuspense></RequireRole>} />
                <Route path="bookings/:bookingId" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminBookingDetail /></AdminSuspense></RequireRole>} />
                <Route path="live" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminLive /></AdminSuspense></RequireRole>} />
                <Route path="bookings/new" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminBookingNew /></AdminSuspense></RequireRole>} />
                <Route path="fleet" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminFleet /></AdminSuspense></RequireRole>} />
                <Route path="fleet/new" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminVehicleNew /></AdminSuspense></RequireRole>} />
                <Route path="customers" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminCustomers /></AdminSuspense></RequireRole>} />
                <Route path="customers/:customerId" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminCustomerDetail /></AdminSuspense></RequireRole>} />
                <Route path="settings" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminSettings /></AdminSuspense></RequireRole>} />
                <Route path="inspection/:bookingId" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminInspection /></AdminSuspense></RequireRole>} />
                <Route path="inspection/compare/:bookingId" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminInspectionCompare /></AdminSuspense></RequireRole>} />
                <Route path="inspection/report/:bookingId" element={<RequireRole roles={["admin","operations","finance"]}><AdminSuspense><AdminInspectionReport /></AdminSuspense></RequireRole>} />
                <Route path="vehicle-history/:vehicleId" element={<RequireRole roles={["admin","finance","operations"]}><AdminSuspense><AdminVehicleHistory /></AdminSuspense></RequireRole>} />
                <Route path="fleet/:vehicleId" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminVehicleDetail /></AdminSuspense></RequireRole>} />
                <Route path="report" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminReport /></AdminSuspense></RequireRole>} />
                <Route path="report/fleet-pnl" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminFleetPnLRedirect /></AdminSuspense></RequireRole>} />
                <Route path="finance" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminFinance /></AdminSuspense></RequireRole>} />
                <Route path="team" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminTeam /></AdminSuspense></RequireRole>} />
                <Route path="ops-today" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminOpsToday /></AdminSuspense></RequireRole>} />
                <Route path="calendar" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminFleetGantt /></AdminSuspense></RequireRole>} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
