import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  BellRing,
  Check,
  X,
  Sparkles,
  Radio,
  MapPin,
  Handshake,
  Rocket,
  ArrowRight,
  Brain,
  DollarSign,
} from "lucide-react";
import { AdminPage, AdminSection, AdminKpiGrid } from "@/components/admin/layout/AdminPage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVehiclesDB } from "@/hooks/useVehiclesDB";
import { getCoverImage } from "@/data/vehicleImages";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

/**
 * GoDalz Rent - canal de agências parceiras.
 * Cor identidade do módulo: EMERALD, complementar ao dourado GoDrive
 * e ao azul-marinho da Frota Inteligente.
 */
const EM = {
  base: "#0F9E7A",
  bg: "rgba(15,158,122,0.08)",
  soft: "rgba(15,158,122,0.14)",
  border: "rgba(15,158,122,0.35)",
  glow: "0 8px 30px -12px rgba(15,158,122,0.45)",
};

type AgencyPoint = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  requests: number;
  primary?: boolean;
};

const AGENCIES: AgencyPoint[] = [
  { id: "orl", name: "GoDalz Viagens", city: "Orlando", lat: 28.5383, lng: -81.3792, requests: 12, primary: true },
  { id: "mia", name: "Sunshine Travel", city: "Miami", lat: 25.7617, lng: -80.1918, requests: 6 },
  { id: "tpa", name: "Gulf Coast Trips", city: "Tampa", lat: 27.9506, lng: -82.4572, requests: 3 },
  { id: "ftl", name: "Atlantic Rentals", city: "Fort Lauderdale", lat: 26.1224, lng: -80.1373, requests: 2 },
];

type Window = {
  id: string;
  vehicle: string;
  range: string;
  nights: number;
  risk: number;
  suggestedPrice: number;
  published?: boolean;
};

const INITIAL_WINDOWS: Window[] = [
  { id: "w1", vehicle: "Corolla Prata", range: "seg 20 a sex 24", nights: 4, risk: 196, suggestedPrice: 39 },
  { id: "w2", vehicle: "Nissan Kicks", range: "qua 22 a dom 26", nights: 4, risk: 184, suggestedPrice: 36, published: true },
  { id: "w3", vehicle: "Volkswagen Tiguan", range: "sex 24 a ter 28", nights: 4, risk: 324, suggestedPrice: 69 },
];

function agencyPrice(retail: number): number {
  if (!retail) return 39;
  return Math.max(29, Math.round(retail * 0.85));
}

export default function AdminGodalzRent() {
  const { vehicles, loading } = useVehiclesDB();
  const [revenue, setRevenue] = useState(4380);
  const [requestsCount, setRequestsCount] = useState(23);
  const [showLiveRequest, setShowLiveRequest] = useState(false);
  const [liveHandled, setLiveHandled] = useState(false);
  const [windows, setWindows] = useState<Window[]>(INITIAL_WINDOWS);
  const [channelOn, setChannelOn] = useState<Record<string, boolean>>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      if (!liveHandled) setShowLiveRequest(true);
    }, 3000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [liveHandled]);

  const featuredVehicles = useMemo(() => (vehicles || []).slice(0, 6), [vehicles]);

  useEffect(() => {
    if (!featuredVehicles.length) return;
    setChannelOn((prev) => {
      if (Object.keys(prev).length) return prev;
      const next: Record<string, boolean> = {};
      featuredVehicles.forEach((v, i) => {
        next[v.id] = i % 2 === 0;
      });
      return next;
    });
  }, [featuredVehicles]);

  const activeCount = Object.values(channelOn).filter(Boolean).length;

  const handleAccept = () => {
    setLiveHandled(true);
    setShowLiveRequest(false);
    setRevenue((r) => r + 216);
    setRequestsCount((c) => c + 1);
    toast.success("Solicitação aceita", { description: "Sunshine Travel recebeu a confirmação." });
  };

  const handleDecline = () => {
    setLiveHandled(true);
    setShowLiveRequest(false);
    toast("Solicitação recusada", { description: "A agência foi notificada." });
  };

  const publishWindow = (id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, published: true } : w)));
    toast.success("Oferta publicada", { description: "No ar para 7 agências parceiras." });
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="GoDalz Rent"
        subtitle="Seu canal de agências parceiras. Faturamento além da Turo."
        eyebrow={
          <span className="inline-flex items-center gap-1.5" style={{ color: EM.base }}>
            <Handshake className="h-3 w-3" />
            CANAL B2B · MÓDULO GODALZ RENT
          </span>
        }
        actions={
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 border-transparent"
            style={{ background: EM.bg, color: EM.base, borderColor: EM.border }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: EM.base }} />
            Rede em expansão · 1ª agência ativa: GoDalz Viagens
          </Badge>
        }
      />

      {/* KPIs compactos */}
      <AdminSection>
        <AdminKpiGrid cols={3}>
          <MetricCard
            label="Faturamento fora da Turo"
            value={`$${revenue.toLocaleString("en-US")}`}
            hint="Acumulado do mês"
            icon={<DollarSign className="h-4 w-4" />}
            highlight
          />
          <MetricCard
            label="Agências conectadas"
            value="7"
            hint="1 ativa · 6 em onboarding"
            icon={<Building2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Solicitações este mês"
            value={String(requestsCount)}
            hint="Via canal parceiro"
            icon={<BellRing className="h-4 w-4" />}
          />
        </AdminKpiGrid>
      </AdminSection>

      {/* Malha da Flórida - mapa real Google Maps */}
      <AdminSection>
        <Card className="p-4 lg:p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="admin-section-title flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: EM.base }} />
                Malha da Flórida
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Agências parceiras conectadas ao canal
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: EM.base }} />
              Ao vivo
            </span>
          </div>
          <FloridaGoogleMap points={AGENCIES} />
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            {AGENCIES.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: a.primary ? EM.base : "hsl(var(--foreground) / 0.35)" }}
                />
                <span className="truncate">
                  <span className="text-foreground/80">{a.city}</span> · {a.name}
                </span>
              </span>
            ))}
          </div>
        </Card>
      </AdminSection>

      {/* Carros no canal + Promoções lado a lado no desktop */}
      <AdminSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
          {/* Seus carros no canal */}
          <Card className="p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="admin-section-title">Seus carros no canal</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {activeCount} de {featuredVehicles.length} veículos publicados
                </div>
              </div>
              <Badge variant="outline" style={{ background: EM.bg, color: EM.base, borderColor: EM.border }}>
                Preço B2B
              </Badge>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {featuredVehicles.map((v) => {
                  const on = !!channelOn[v.id];
                  const price = agencyPrice(v.daily_price_usd);
                  return (
                    <li key={v.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="h-11 w-14 rounded-md overflow-hidden bg-muted shrink-0">
                        <img
                          src={getCoverImage(v.name)}
                          alt={v.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{v.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {v.category} · {v.passengers} passageiros
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="text-sm font-medium tabular-nums"
                          style={{ color: on ? EM.base : undefined }}
                        >
                          ${price}
                          <span className="text-[10px] text-muted-foreground font-normal">/dia</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">agência</div>
                      </div>
                      <div className="shrink-0 pl-1">
                        <Switch
                          checked={on}
                          onCheckedChange={(checked) => {
                            setChannelOn((prev) => ({ ...prev, [v.id]: checked }));
                            toast(checked ? "Publicado no canal" : "Removido do canal", { description: v.name });
                          }}
                          aria-label={`Publicar ${v.name} no canal`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Promoções de janela ociosa */}
          <Card className="p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="admin-section-title">Promoções de janela ociosa</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                  <Brain className="h-3 w-3" style={{ color: EM.base }} />
                  Detectado pela Frota Inteligente
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {windows.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border border-border/60 p-3.5 flex flex-col gap-3 bg-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{w.vehicle}</div>
                      <div className="text-[11px] text-muted-foreground">Livre de {w.range}</div>
                    </div>
                    {w.published ? (
                      <Badge
                        variant="outline"
                        className="shrink-0"
                        style={{ background: EM.bg, color: EM.base, borderColor: EM.border }}
                      >
                        <Radio className="h-3 w-3 mr-1" />
                        No ar · 7 agências
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-destructive border-destructive/40">
                        ${w.risk} em risco
                      </Badge>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Sugestão de oferta
                      </div>
                      <div className="text-2xl font-light tabular-nums leading-tight" style={{ color: EM.base }}>
                        ${w.suggestedPrice}
                        <span className="text-xs text-muted-foreground font-normal">/dia</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {w.nights} noites paradas
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={w.published}
                      onClick={() => publishWindow(w.id)}
                      style={
                        !w.published
                          ? { background: EM.base, color: "white", boxShadow: EM.glow }
                          : undefined
                      }
                      className="shrink-0"
                    >
                      {w.published ? "Publicada" : "Publicar oferta"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </AdminSection>

      {/* Rodapé roadmap */}
      <AdminSection>
        <Card
          className="p-4 lg:p-6 border-0"
          style={{
            background: `linear-gradient(135deg, ${EM.bg}, transparent 60%)`,
            border: `1px solid ${EM.border}`,
          }}
        >
          <div className="admin-label mb-3" style={{ color: EM.base }}>
            VISÃO DE FUTURO
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-2 items-start">
            <RoadmapStep phase="Hoje" title="GoDalz Viagens conectada" icon={<Handshake className="h-4 w-4" />} active />
            <RoadmapStep phase="Em breve" title="Novas agências parceiras da Flórida" icon={<Sparkles className="h-4 w-4" />} />
            <RoadmapStep phase="Futuro" title="Rede nacional de agências" icon={<Rocket className="h-4 w-4" />} last />
          </div>
        </Card>
      </AdminSection>

      {/* Notificação simulada ao vivo */}
      {showLiveRequest && (
        <div
          className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[380px] z-50 animate-slide-in-right"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <Card
            className="p-4 shadow-2xl border-0"
            style={{ borderLeft: `4px solid ${EM.base}`, boxShadow: EM.glow }}
          >
            <div className="flex items-start gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: EM.bg, color: EM.base }}
              >
                <BellRing className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: EM.base }}>
                  Nova solicitação
                </div>
                <div className="text-sm font-medium mt-0.5">Sunshine Travel quer o Corolla Prata</div>
                <div className="text-xs text-muted-foreground mt-0.5">4 diárias · $216</div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleAccept}
                    className="flex-1"
                    style={{ background: EM.base, color: "white" }}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDecline} className="flex-1">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Recusar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}

// ============================================================
// Componentes internos
// ============================================================

function MetricCard({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      className="p-4 lg:p-5 border-0"
      style={
        highlight
          ? {
              background: `linear-gradient(135deg, ${EM.bg}, transparent 70%)`,
              border: `1px solid ${EM.border}`,
              boxShadow: EM.glow,
            }
          : { border: "1px solid hsl(var(--border) / 0.6)" }
      }
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span style={{ color: EM.base }}>{icon}</span>
        <span className="admin-label truncate">{label}</span>
      </div>
      <div
        key={value}
        className={cn(
          "mt-2 font-light tabular-nums tracking-tight animate-fade-in leading-none",
          highlight ? "text-3xl lg:text-4xl" : "text-2xl lg:text-3xl"
        )}
        style={highlight ? { color: EM.base } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function RoadmapStep({
  phase,
  title,
  icon,
  active,
  last,
}: {
  phase: string;
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 md:flex-col md:items-start">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0")}
            style={{
              background: active ? EM.base : EM.bg,
              color: active ? "white" : EM.base,
              boxShadow: active ? EM.glow : undefined,
            }}
          >
            {icon}
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: EM.base }}>
              {phase}
            </div>
            <div className="text-sm font-medium">{title}</div>
          </div>
        </div>
      </div>
      {!last && <ArrowRight className="hidden md:block h-4 w-4 mt-3 shrink-0 opacity-30" aria-hidden />}
    </div>
  );
}

// ============================================================
// Mapa Google real. Mesmo visual/config do AdminLive (GoogleFleetMap):
// tema claro padrão (roadmap), controles idênticos, marcadores em
// "puck" branco com ícone dentro, InfoWindow ao clicar.
// ============================================================

const GOLD = "#D4AF37";

function agencyMarkerIcon(primary: boolean, initial: string): any {
  const size = primary ? 52 : 46;
  const ringStroke = primary ? GOLD : "#0f9e7a";
  const ringWidth = primary ? 3.4 : 2.8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44" shape-rendering="geometricPrecision">
    <defs>
      <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="2" flood-color="#000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <circle cx="22" cy="22" r="19" fill="${ringStroke}" opacity="0.18" />
    <g filter="url(#s)">
      <circle cx="22" cy="22" r="14" fill="#ffffff" stroke="${ringStroke}" stroke-width="${ringWidth}" />
    </g>
    <!-- Ícone de agência (prédio) -->
    <g transform="translate(14 14)" fill="${ringStroke}">
      <rect x="1" y="3" width="14" height="12" rx="1.2" />
      <rect x="3" y="5.5" width="2" height="2" fill="#fff" />
      <rect x="7" y="5.5" width="2" height="2" fill="#fff" />
      <rect x="11" y="5.5" width="2" height="2" fill="#fff" />
      <rect x="3" y="9" width="2" height="2" fill="#fff" />
      <rect x="7" y="9" width="2" height="2" fill="#fff" />
      <rect x="11" y="9" width="2" height="2" fill="#fff" />
      <rect x="6.5" y="12" width="3" height="3" fill="#fff" />
    </g>
  </svg>`;
  const g = (window as any).google;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: g?.maps?.Size ? new g.maps.Size(size, size) : ({ width: size, height: size } as any),
    anchor: g?.maps?.Point ? new g.maps.Point(size / 2, size / 2) : ({ x: size / 2, y: size / 2 } as any),
  };
}

function esc(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function FloridaGoogleMap({ points }: { points: AgencyPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !ref.current) return;

        // Mesmo preset visual do AdminLive: tema claro padrão (roadmap),
        // controles no canto inferior direito, gestos "greedy".
        const map = new google.maps.Map(ref.current, {
          center: { lat: 27.9, lng: -82.0 },
          zoom: 6,
          mapTypeId: "roadmap",
          tilt: 0,
          restriction: {
            latLngBounds: { north: 50, south: 7, east: -60, west: -125 },
            strictBounds: false,
          },
          minZoom: 5,
          maxZoom: 21,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: true,
          rotateControlOptions: { position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM },
          backgroundColor: "#e5e3df",
          gestureHandling: "greedy",
          scrollwheel: true,
          isFractionalZoomEnabled: true,
          clickableIcons: true,
          keyboardShortcuts: true,
          draggableCursor: "grab",
          draggingCursor: "grabbing",
        });

        const infoWindow = new google.maps.InfoWindow();
        const bounds = new google.maps.LatLngBounds();

        points.forEach((p) => {
          const initial = (p.name || p.city || "?").trim().charAt(0).toUpperCase();
          const marker = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            icon: agencyMarkerIcon(!!p.primary, initial),
            title: `${p.city} · ${p.name}`,
            zIndex: p.primary ? 10 : 1,
            optimized: false,
          });
          const statusDot = p.primary ? GOLD : "#0f9e7a";
          const statusLabel = p.primary ? "Agência principal" : "Ativa";
          const content = `
            <div style="font-family:'Inter',sans-serif;color:#111;padding:4px 6px;min-width:200px">
              <div style="font-weight:700;font-size:14px;line-height:1.25">${esc(p.name)}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(p.city)} · Flórida</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:8px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${statusDot}"></span>
                <span style="font-size:11px;font-weight:600;color:#111">${statusLabel}</span>
              </div>
              <div style="font-size:11px;color:#0f9e7a;margin-top:6px;font-weight:600">${p.requests} solicitações este mês</div>
            </div>`;
          marker.addListener("click", () => {
            infoWindow.setContent(content);
            infoWindow.open({ anchor: marker, map });
          });
          bounds.extend({ lat: p.lat, lng: p.lng });
        });

        if (points.length > 1) {
          map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        }

        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-border/60"
      style={{ background: "hsl(var(--muted) / 0.35)" }}
    >
      <div ref={ref} className="w-full h-[260px] sm:h-[320px] lg:h-[380px]" />
      {state !== "ok" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/60 backdrop-blur-sm">
          {state === "loading" ? (
            <>
              <div
                className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: EM.base, borderTopColor: "transparent" }}
              />
              <span className="text-[11px] text-muted-foreground">Carregando mapa da Flórida...</span>
            </>
          ) : (
            <>
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Mapa indisponível no momento</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

