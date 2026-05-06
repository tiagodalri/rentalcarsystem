import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import MyAccount from "./pages/MyAccount.tsx";
import BookingDetailClient from "./pages/BookingDetailClient.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminBookings from "./pages/admin/AdminBookings.tsx";
import AdminFleet from "./pages/admin/AdminFleet.tsx";
import AdminCustomers from "./pages/admin/AdminCustomers.tsx";
import AdminCustomerDetail from "./pages/admin/AdminCustomerDetail.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminLive from "./pages/admin/AdminLive.tsx";
import AdminInspection from "./pages/admin/AdminInspection.tsx";
import AdminInspectionCompare from "./pages/admin/AdminInspectionCompare.tsx";
import AdminVehicleHistory from "./pages/admin/AdminVehicleHistory.tsx";
import AdminVehicleDetail from "./pages/admin/AdminVehicleDetail.tsx";
import AdminFleetReport from "./pages/admin/AdminFleetReport.tsx";
import AdminFleetPnL from "./pages/admin/AdminFleetPnL.tsx";
import AdminBookingDetail from "./pages/admin/AdminBookingDetail.tsx";
import AdminFinance from "./pages/admin/AdminFinance.tsx";
import AdminTeam from "./pages/admin/AdminTeam.tsx";
import BookingConfirmed from "./pages/BookingConfirmed.tsx";
import CustomerRegistration from "./pages/CustomerRegistration.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Contato from "./pages/Contato.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import { RequireRole } from "./components/admin/RequireRole.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/sobre-nos" element={<AboutUs />} />
              <Route path="/buscar" element={<SearchResults />} />
              <Route path="/reserva/:vehicleName" element={<BookingDetails />} />
              <Route path="/reserva/confirmada" element={<BookingConfirmed />} />
              <Route path="/cadastro" element={<CustomerRegistration />} />
              <Route path="/login" element={<Login />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route path="/minha-conta" element={<RequireAuth><MyAccount /></RequireAuth>} />
              <Route path="/minha-conta/reserva/:bookingId" element={<RequireAuth><BookingDetailClient /></RequireAuth>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<RequireRole roles={["admin","finance","operations","support"]}><AdminDashboard /></RequireRole>} />
                <Route path="bookings" element={<RequireRole roles={["admin","operations","support"]}><AdminBookings /></RequireRole>} />
                <Route path="bookings/:bookingId" element={<RequireRole roles={["admin","operations","support"]}><AdminBookingDetail /></RequireRole>} />
                <Route path="live" element={<RequireRole roles={["admin","operations"]}><AdminLive /></RequireRole>} />
                <Route path="fleet" element={<RequireRole roles={["admin","operations"]}><AdminFleet /></RequireRole>} />
                <Route path="customers" element={<RequireRole roles={["admin","operations","support"]}><AdminCustomers /></RequireRole>} />
                <Route path="customers/:customerId" element={<RequireRole roles={["admin","operations","support"]}><AdminCustomerDetail /></RequireRole>} />
                <Route path="settings" element={<RequireRole roles={["admin"]}><AdminSettings /></RequireRole>} />
                <Route path="inspection/:bookingId" element={<RequireRole roles={["admin","operations"]}><AdminInspection /></RequireRole>} />
                <Route path="inspection/compare/:bookingId" element={<RequireRole roles={["admin","operations"]}><AdminInspectionCompare /></RequireRole>} />
                <Route path="vehicle-history/:vehicleId" element={<RequireRole roles={["admin","finance","operations"]}><AdminVehicleHistory /></RequireRole>} />
                <Route path="fleet/:vehicleId" element={<RequireRole roles={["admin","operations"]}><AdminVehicleDetail /></RequireRole>} />
                <Route path="report" element={<RequireRole roles={["admin","finance"]}><AdminFleetReport /></RequireRole>} />
                <Route path="report/fleet-pnl" element={<RequireRole roles={["admin","finance"]}><AdminFleetPnL /></RequireRole>} />
                <Route path="finance" element={<RequireRole roles={["admin","finance"]}><AdminFinance /></RequireRole>} />
                <Route path="team" element={<RequireRole roles={["admin"]}><AdminTeam /></RequireRole>} />
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
