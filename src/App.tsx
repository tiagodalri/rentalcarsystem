import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.tsx";
import { RouteProgress } from "./components/RouteProgress.tsx";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/i18n/ThemeContext";
import { CurrencyProvider } from "@/i18n/CurrencyContext";
// Eager: home (LCP crítico) e shell admin
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

import RequireAuth from "./components/RequireAuth.tsx";
import { AdminShellSkeleton } from "./components/skeletons/AdminShellSkeleton.tsx";
import { AccountSkeleton } from "./components/skeletons/AccountSkeleton.tsx";
import InstallPrompt from "./components/InstallPrompt.tsx";
import { OfflineBanner } from "./components/OfflineBanner";
// Lazy: shell admin + role guard só são baixados quando alguém entra em /admin
const AdminLayout = lazy(() => import("./components/admin/AdminLayout.tsx"));
const RequireRole = lazy(() =>
  import("./components/admin/RequireRole.tsx").then((m) => ({ default: m.RequireRole })),
);
import { useSwUpdateOnNavigate } from "./hooks/useSwUpdateOnNavigate.ts";
import { useDynamicThemeColor } from "./hooks/useDynamicThemeColor.ts";
import { useNativeFeel } from "./hooks/useNativeFeel.ts";
import { useSwipeBack } from "./hooks/useSwipeBack.ts";

// Lazy-loaded: páginas públicas secundárias (reduz bundle inicial da home)
const AboutUs = lazy(() => import("./pages/AboutUs.tsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.tsx"));
const BookingDetails = lazy(() => import("./pages/BookingDetails.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const BookingConfirmed = lazy(() => import("./pages/BookingConfirmed.tsx"));
const CustomerRegistration = lazy(() => import("./pages/CustomerRegistration.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Contato = lazy(() => import("./pages/Contato.tsx"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail.tsx"));
const Frota = lazy(() => import("./pages/Frota.tsx"));
const PublicTrack = lazy(() => import("./pages/PublicTrack.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));

// Lazy-loaded: client authenticated pages
const MyAccount = lazy(() => import("./pages/MyAccount.tsx"));
const BookingDetailClient = lazy(() => import("./pages/BookingDetailClient.tsx"));

// Lazy-loaded: admin login (raramente acessado por visitantes do site público)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));

// Lazy-loaded: admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminPainel = lazy(() => import("./pages/admin/AdminPainel.tsx"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings.tsx"));
const AdminFleet = lazy(() => import("./pages/admin/AdminFleet.tsx"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers.tsx"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail.tsx"));
const AdminCustomerBirthdays = lazy(() => import("./pages/admin/AdminCustomerBirthdays.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.tsx"));
const AdminLive = lazy(() => import("./pages/admin/AdminLive.tsx"));
const AdminInspection = lazy(() => import("./pages/admin/AdminInspection.tsx"));
const AdminInspectionCompare = lazy(() => import("./pages/admin/AdminInspectionCompare.tsx"));
const AdminInspectionReport = lazy(() => import("./pages/admin/AdminInspectionReport.tsx"));
const AdminVehicleHistory = lazy(() => import("./pages/admin/AdminVehicleHistory.tsx"));
const AdminVehicleDetail = lazy(() => import("./pages/admin/AdminVehicleDetail.tsx"));
const AdminReport = lazy(() => import("./pages/admin/AdminReport.tsx"));
const AdminFleetPnLRedirect = lazy(() => import("./pages/admin/AdminReport.tsx").then(m => ({ default: m.AdminFleetPnLRedirect })));
const AdminBookingDetail = lazy(() => import("./pages/admin/AdminBookingDetail.tsx"));
const AdminFinance = lazy(() => import("./pages/admin/AdminFinance.tsx"));
const AdminTeam = lazy(() => import("./pages/admin/AdminTeam.tsx"));
const AdminOpsToday = lazy(() => import("./pages/admin/AdminOpsToday.tsx"));
const AdminFleetGantt = lazy(() => import("./pages/admin/AdminFleetGantt.tsx"));
const AdminVehicleNew = lazy(() => import("./pages/admin/AdminVehicleNew.tsx"));
const AdminBookingNew = lazy(() => import("./pages/admin/AdminBookingNew.tsx"));
const AdminContracts = lazy(() => import("./pages/admin/AdminContracts.tsx"));
const AdminTuroImport = lazy(() => import("./pages/admin/AdminTuroImport.tsx"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 min — mantém cache vivo entre navegações
      refetchOnWindowFocus: false,
      // Wave 2: PWA fica horas em background. Quando volta a ter rede, refaz
      // queries para o usuário não ficar olhando dado de ontem sem aviso.
      refetchOnReconnect: true,
      // Mantém o backoff humano (não martela API em problema de rede móvel).
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    },
  },
});

const AdminSuspense = ({ children }: { children: React.ReactNode }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<AdminShellSkeleton />}>{children}</Suspense>
  </RouteErrorBoundary>
);

const ClientSuspense = ({ children }: { children: React.ReactNode }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<AccountSkeleton />}>{children}</Suspense>
  </RouteErrorBoundary>
);

// Fallback minimalista para páginas públicas — o RouteProgress já indica carregamento
const PublicSuspense = ({ children }: { children: React.ReactNode }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<div className="min-h-screen bg-background" />}>{children}</Suspense>
  </RouteErrorBoundary>
);

/**
 * Gerencia scroll entre navegações:
 * - PUSH/REPLACE → vai pro topo (comportamento esperado de "abrir nova tela").
 * - POP (voltar/avançar do browser) → restaura a posição que estava ao sair.
 *
 * Posições ficam em sessionStorage indexadas por location.key, então
 * sobrevivem a hot reloads do mesmo tab mas não vazam entre abas.
 */
const SCROLL_STORAGE_KEY = "zeus:scroll-positions";
const loadPositions = (): Map<string, number> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, number][]);
  } catch {
    return new Map();
  }
};
const persistPositions = (map: Map<string, number>) => {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify([...map]));
  } catch {
    /* quota / private mode */
  }
};

const ScrollManager = () => {
  const { key, pathname } = useLocation();
  const navType = useNavigationType();
  const prevKeyRef = useRef<string>(key);
  const positionsRef = useRef<Map<string, number>>(loadPositions());

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // Salva a posição da rota que estava saindo
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      positionsRef.current.set(prevKeyRef.current, window.scrollY);
      persistPositions(positionsRef.current);
    }
    prevKeyRef.current = key;

    if (navType === "POP" && positionsRef.current.has(key)) {
      const y = positionsRef.current.get(key) ?? 0;
      // Aguarda 1 frame pra DOM/Suspense montar antes de restaurar
      const frame = window.requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    // PUSH/REPLACE → topo
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [key, navType, pathname]);

  return null;
};

const SwUpdateOnNavigate = () => {
  useSwUpdateOnNavigate();
  useDynamicThemeColor();
  useNativeFeel();
  useSwipeBack();
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
          <OfflineBanner />
          <InstallPrompt />
          <BrowserRouter>
            <ScrollManager />
            <SwUpdateOnNavigate />
            <RouteProgress />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/share/track/:token" element={<PublicSuspense><PublicTrack /></PublicSuspense>} />

              <Route path="/sobre-nos" element={<PublicSuspense><AboutUs /></PublicSuspense>} />
              <Route path="/frota" element={<PublicSuspense><Frota /></PublicSuspense>} />
              <Route path="/buscar" element={<PublicSuspense><SearchResults /></PublicSuspense>} />
              <Route path="/resultados" element={<PublicSuspense><SearchResults /></PublicSuspense>} />
              <Route path="/veiculo/:vehicleName" element={<PublicSuspense><VehicleDetail /></PublicSuspense>} />
              <Route path="/reserva/:vehicleName" element={<PublicSuspense><BookingDetails /></PublicSuspense>} />
              <Route path="/checkout" element={<PublicSuspense><Checkout /></PublicSuspense>} />
              <Route path="/reserva/confirmada" element={<PublicSuspense><BookingConfirmed /></PublicSuspense>} />
              <Route path="/cadastro" element={<PublicSuspense><CustomerRegistration /></PublicSuspense>} />
              <Route path="/login" element={<PublicSuspense><Login /></PublicSuspense>} />
              <Route path="/redefinir-senha" element={<PublicSuspense><ResetPassword /></PublicSuspense>} />
              <Route path="/contato" element={<PublicSuspense><Contato /></PublicSuspense>} />
              <Route path="/minha-conta" element={<RequireAuth><ClientSuspense><MyAccount /></ClientSuspense></RequireAuth>} />
              <Route path="/minha-conta/reserva/:bookingId" element={<RequireAuth><ClientSuspense><BookingDetailClient /></ClientSuspense></RequireAuth>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<PublicSuspense><AdminLogin /></PublicSuspense>} />
              <Route path="/admin" element={<Suspense fallback={<AdminShellSkeleton />}><AdminLayout /></Suspense>}>
                <Route index element={<RequireRole roles={["admin","finance","operations","support","driver"]}><AdminSuspense><AdminPainel /></AdminSuspense></RequireRole>} />
                <Route path="bookings" element={<RequireRole roles={["admin","operations","support","driver"]}><AdminSuspense><AdminBookings /></AdminSuspense></RequireRole>} />
                <Route path="bookings/:bookingId" element={<RequireRole roles={["admin","operations","support","driver"]}><AdminSuspense><AdminBookingDetail /></AdminSuspense></RequireRole>} />
                <Route path="live" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminLive /></AdminSuspense></RequireRole>} />
                <Route path="bookings/new" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminBookingNew /></AdminSuspense></RequireRole>} />
                <Route path="fleet" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminFleet /></AdminSuspense></RequireRole>} />
                <Route path="fleet/new" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminVehicleNew /></AdminSuspense></RequireRole>} />
                <Route path="customers" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminCustomers /></AdminSuspense></RequireRole>} />
                <Route path="customers/birthdays" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminCustomerBirthdays /></AdminSuspense></RequireRole>} />
                <Route path="customers/:customerId" element={<RequireRole roles={["admin","operations","support","driver"]}><AdminSuspense><AdminCustomerDetail /></AdminSuspense></RequireRole>} />
                <Route path="settings" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminSettings /></AdminSuspense></RequireRole>} />
                <Route path="inspection/:bookingId" element={<RequireRole roles={["admin","operations","driver"]}><AdminSuspense><AdminInspection /></AdminSuspense></RequireRole>} />
                <Route path="inspection/compare/:bookingId" element={<RequireRole roles={["admin","operations","driver"]}><AdminSuspense><AdminInspectionCompare /></AdminSuspense></RequireRole>} />
                <Route path="inspection/report/:bookingId" element={<RequireRole roles={["admin","operations","finance","driver"]}><AdminSuspense><AdminInspectionReport /></AdminSuspense></RequireRole>} />
                <Route path="vehicle-history/:vehicleId" element={<RequireRole roles={["admin","finance","operations"]}><AdminSuspense><AdminVehicleHistory /></AdminSuspense></RequireRole>} />
                <Route path="fleet/:vehicleId" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminVehicleDetail /></AdminSuspense></RequireRole>} />
                <Route path="report" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminReport /></AdminSuspense></RequireRole>} />
                <Route path="report/fleet-pnl" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminFleetPnLRedirect /></AdminSuspense></RequireRole>} />
                <Route path="dashboard" element={<RequireRole roles={["admin","finance","operations","support"]}><AdminSuspense><AdminDashboard /></AdminSuspense></RequireRole>} />

                <Route path="finance" element={<RequireRole roles={["admin","finance"]}><AdminSuspense><AdminFinance /></AdminSuspense></RequireRole>} />
                <Route path="team" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminTeam /></AdminSuspense></RequireRole>} />
                <Route path="ops-today" element={<RequireRole roles={["admin","operations","support","driver"]}><AdminSuspense><AdminOpsToday /></AdminSuspense></RequireRole>} />
                <Route path="calendar" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminFleetGantt /></AdminSuspense></RequireRole>} />
                <Route path="contracts" element={<RequireRole roles={["admin","operations","support","finance"]}><AdminSuspense><AdminContracts /></AdminSuspense></RequireRole>} />
                <Route path="turo-import" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminTuroImport /></AdminSuspense></RequireRole>} />
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
