import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.tsx";
import { RouteProgress } from "./components/RouteProgress.tsx";
import ActivityTracker from "./components/ActivityTracker.tsx";
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
import MobileOps from "./pages/admin/mobile/MobileOps.tsx";
import { RequireRole } from "./components/admin/RequireRole.tsx";
// Lazy: shell admin + role guard só são baixados quando alguém entra em /admin
const AdminLayout = lazy(() => import("./components/admin/AdminLayout.tsx"));
import { useSwUpdateOnNavigate } from "./hooks/useSwUpdateOnNavigate.ts";
import { useDynamicThemeColor } from "./hooks/useDynamicThemeColor.ts";
import { useNativeFeel } from "./hooks/useNativeFeel.ts";
import { useSwipeBack } from "./hooks/useSwipeBack.ts";
import { useIsMobileApp } from "./hooks/useIsMobileApp.ts";
import { DemoBadge } from "./components/demo/DemoBadge.tsx";
import { startDemoTracker } from "./lib/demo/tracker.ts";

// Inicia o simulador de rastreador uma única vez no boot do app.
if (typeof window !== "undefined") {
  startDemoTracker();
}

// Lazy-loaded: páginas públicas secundárias (reduz bundle inicial da home)
const AboutUs = lazy(() => import("./pages/AboutUs.tsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.tsx"));
const BookingDetails = lazy(() => import("./pages/BookingDetails.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const BookingConfirmed = lazy(() => import("./pages/BookingConfirmed.tsx"));
const CustomerRegistration = lazy(() => import("./pages/CustomerRegistration.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Contato = lazy(() => import("./pages/Contato.tsx"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail.tsx"));
const Frota = lazy(() => import("./pages/Frota.tsx"));
const PublicTrack = lazy(() => import("./pages/PublicTrack.tsx"));
const PublicInspection = lazy(() => import("./pages/PublicInspection.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));

// Lazy-loaded: client authenticated pages
const MyAccount = lazy(() => import("./pages/MyAccount.tsx"));
const BookingDetailClient = lazy(() => import("./pages/BookingDetailClient.tsx"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile.tsx"));

// Lazy-loaded: admin login (raramente acessado por visitantes do site público)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));

// Lazy-loaded: admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminPainel = lazy(() => import("./pages/admin/AdminPainel.tsx"));
const AiSimulador = lazy(() => import("./pages/admin/AiSimulador.tsx"));
const AdminFrotaInteligente = lazy(() => import("./pages/admin/AdminFrotaInteligente.tsx"));
const AdminGodalzRent = lazy(() => import("./pages/admin/AdminGodalzRent.tsx"));
const BrainAccessGate = lazy(() => import("./components/admin/ai-studio/BrainAccessGate.tsx"));
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
const AdminContractTemplate = lazy(() => import("./pages/admin/AdminContractTemplate.tsx"));
const AdminTuroImport = lazy(() => import("./pages/admin/AdminTuroImport.tsx"));
const AdminEpassImport = lazy(() => import("./pages/admin/AdminEpassImport.tsx"));
const AdminTolls = lazy(() => import("./pages/admin/AdminTolls.tsx"));
const AdminCosts = lazy(() => import("./pages/admin/AdminCosts.tsx"));
const AdminTutorials = lazy(() => import("./pages/admin/AdminTutorials.tsx"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs.tsx"));
const AdminPendencias = lazy(() => import("./pages/admin/AdminPendencias.tsx"));
const AdminStampPreview = lazy(() => import("./pages/admin/AdminStampPreview.tsx"));
const AdminWhatsApp = lazy(() => import("./pages/admin/AdminWhatsApp.tsx"));
const AdminWhatsAppScheduled = lazy(() => import("./pages/admin/AdminWhatsAppScheduled.tsx"));
const AdminWhatsAppPipeline = lazy(() => import("./pages/admin/AdminWhatsAppPipeline.tsx"));
const AdminWhatsAppLinks = lazy(() => import("./pages/admin/AdminWhatsAppLinks.tsx"));
const AdminWhatsAppStatus = lazy(() => import("./pages/admin/AdminWhatsAppStatus.tsx"));
const PublicWhatsAppRedirect = lazy(() => import("./pages/PublicWhatsAppRedirect.tsx"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 min. mantém cache vivo entre navegações
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
  <AdminRouteBoundary>{children}</AdminRouteBoundary>
);

const AdminRouteBoundary = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>
      <Suspense fallback={<AdminShellSkeleton />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
};

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

const OpsTodayRoute = () => {
  const { isMobile } = useIsMobileApp();

  // A tela "Hoje/Operação" é crítica para o Rui no celular. Mantemos a versão
  // mobile no bundle principal, sem import dinâmico, para não depender de chunk
  // lazy/prefetch em iOS Safari/PWA depois de deploys.
  if (isMobile) {
    return (
      <RouteErrorBoundary resetKey="mobile-ops-today">
        <MobileOps />
      </RouteErrorBoundary>
    );
  }

  return (
    <AdminSuspense>
      <AdminOpsToday />
    </AdminSuspense>
  );
};

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
          <DemoBadge />
          <BrowserRouter>
            <ScrollManager />
            <SwUpdateOnNavigate />
            <RouteProgress />
            <ActivityTracker />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/share/track/:token" element={<PublicSuspense><PublicTrack /></PublicSuspense>} />
              <Route path="/share/inspection/:token" element={<PublicSuspense><PublicInspection /></PublicSuspense>} />
              <Route path="/l/:slug" element={<PublicSuspense><PublicWhatsAppRedirect /></PublicSuspense>} />

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
              <Route path="/unsubscribe" element={<PublicSuspense><Unsubscribe /></PublicSuspense>} />
              <Route path="/minha-conta" element={<RequireAuth><ClientSuspense><MyAccount /></ClientSuspense></RequireAuth>} />
              <Route path="/minha-conta/reserva/:bookingId" element={<RequireAuth><ClientSuspense><BookingDetailClient /></ClientSuspense></RequireAuth>} />
              <Route path="/completar-perfil" element={<RequireAuth><ClientSuspense><CompleteProfile /></ClientSuspense></RequireAuth>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<PublicSuspense><AdminLogin /></PublicSuspense>} />
              <Route path="/admin" element={<Suspense fallback={<AdminShellSkeleton />}><AdminLayout /></Suspense>}>
                <Route index element={<RequireRole roles={["admin","finance","operations","support","driver"]}><AdminSuspense><AdminPainel /></AdminSuspense></RequireRole>} />
                <Route path="ai-studio/simulador" element={<RequireRole roles={["admin","finance","operations"]}><AdminSuspense><BrainAccessGate><AiSimulador /></BrainAccessGate></AdminSuspense></RequireRole>} />
                <Route path="frota-inteligente" element={<RequireRole roles={["admin","operations","finance","support"]}><AdminSuspense><AdminFrotaInteligente /></AdminSuspense></RequireRole>} />
                <Route path="godalz-rent" element={<RequireRole roles={["admin","operations","finance","support"]}><AdminSuspense><AdminGodalzRent /></AdminSuspense></RequireRole>} />
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
                <Route path="ops-today" element={<RequireRole roles={["admin","operations","support","driver"]}><OpsTodayRoute /></RequireRole>} />
                <Route path="calendar" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminFleetGantt /></AdminSuspense></RequireRole>} />
                <Route path="contracts" element={<RequireRole roles={["admin","operations","support","finance"]}><AdminSuspense><AdminContracts /></AdminSuspense></RequireRole>} />
                <Route path="contracts/template" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminContractTemplate /></AdminSuspense></RequireRole>} />
                <Route path="turo-import" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminTuroImport /></AdminSuspense></RequireRole>} />
                <Route path="epass-import" element={<RequireRole roles={["admin","operations","finance"]}><AdminSuspense><AdminEpassImport /></AdminSuspense></RequireRole>} />
                <Route path="tolls" element={<RequireRole roles={["admin","operations","finance"]}><AdminSuspense><AdminTolls /></AdminSuspense></RequireRole>} />
                <Route path="costs" element={<RequireRole roles={["admin","operations","finance","driver"]}><AdminSuspense><AdminCosts /></AdminSuspense></RequireRole>} />
                <Route path="tutoriais" element={<RequireRole roles={["admin","operations","support","driver","finance"]}><AdminSuspense><AdminTutorials /></AdminSuspense></RequireRole>} />
                <Route path="logs" element={<RequireRole roles={["admin"]}><AdminSuspense><AdminLogs /></AdminSuspense></RequireRole>} />
                <Route path="pendencias" element={<RequireRole roles={["admin","operations","finance"]}><AdminSuspense><AdminPendencias /></AdminSuspense></RequireRole>} />
                <Route path="stamp-preview" element={<RequireRole roles={["admin","operations"]}><AdminSuspense><AdminStampPreview /></AdminSuspense></RequireRole>} />
                <Route path="whatsapp" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminWhatsApp /></AdminSuspense></RequireRole>} />
                <Route path="whatsapp/agendadas" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminWhatsAppScheduled /></AdminSuspense></RequireRole>} />
                <Route path="whatsapp/pipeline" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminWhatsAppPipeline /></AdminSuspense></RequireRole>} />
                <Route path="whatsapp/links" element={<RequireRole roles={["admin","operations","support"]}><AdminSuspense><AdminWhatsAppLinks /></AdminSuspense></RequireRole>} />
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
