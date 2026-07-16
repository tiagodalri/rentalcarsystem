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

/**
 * GoDalz Rent — canal de agências parceiras.
 * Cor identidade do módulo: EMERALD (#0F9E7A), escolhida como complementar
 * ao dourado GoDrive e ao azul-marinho da Frota Inteligente.
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
  x: number; // % dentro do viewBox 100x140
  y: number;
  requests: number;
  primary?: boolean;
};

const AGENCIES: AgencyPoint[] = [
  { id: "orl", name: "GoDalz Viagens", city: "Orlando", x: 62, y: 60, requests: 12, primary: true },
  { id: "mia", name: "Sunshine Travel", city: "Miami", x: 82, y: 118, requests: 6 },
  { id: "tpa", name: "Gulf Coast Trips", city: "Tampa", x: 48, y: 74, requests: 3 },
  { id: "ftl", name: "Atlantic Rentals", city: "Fort Lauderdale", x: 80, y: 112, requests: 2 },
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
  {
    id: "w1",
    vehicle: "Corolla Prata",
    range: "seg 20 a sex 24",
    nights: 4,
    risk: 196,
    suggestedPrice: 39,
  },
  {
    id: "w2",
    vehicle: "Nissan Kicks",
    range: "qua 22 a dom 26",
    nights: 4,
    risk: 184,
    suggestedPrice: 36,
    published: true,
  },
  {
    id: "w3",
    vehicle: "Volkswagen Tiguan",
    range: "sex 24 a ter 28",
    nights: 4,
    risk: 324,
    suggestedPrice: 69,
  },
];

// Preços por diária no canal — pequeno desconto vs. varejo público
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

  // Notificação simulada ao vivo
  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      if (!liveHandled) setShowLiveRequest(true);
    }, 3000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [liveHandled]);

  const featuredVehicles = useMemo(() => {
    return (vehicles || []).slice(0, 6);
  }, [vehicles]);

  // Alguns já ligados por padrão
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
    toast.success("Solicitação aceita", {
      description: "Sunshine Travel recebeu a confirmação.",
    });
  };

  const handleDecline = () => {
    setLiveHandled(true);
    setShowLiveRequest(false);
    toast("Solicitação recusada", {
      description: "A agência foi notificada.",
    });
  };

  const publishWindow = (id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, published: true } : w)));
    toast.success("Oferta publicada", {
      description: "No ar para 7 agências parceiras.",
    });
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="GoDalz Rent"
        subtitle="Seu canal de agências parceiras. Faturamento além da Turo."
        eyebrow={
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: EM.base }}
          >
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
            <span
              className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: EM.base }}
            />
            Rede em expansão · 1ª agência ativa: GoDalz Viagens
          </Badge>
        }
      />

      {/* HERÓI: mapa + métricas */}
      <AdminSection>
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 lg:gap-6">
          {/* Métricas (em mobile aparecem primeiro) */}
          <div className="order-2 lg:order-2 flex flex-col justify-between gap-4">
            <AdminKpiGrid cols={2}>
              <MetricCard label="Agências conectadas" value="7" icon={<Building2 className="h-4 w-4" />} />
              <MetricCard label="Solicitações este mês" value={String(requestsCount)} icon={<BellRing className="h-4 w-4" />} />
            </AdminKpiGrid>
            <Card
              className="p-5 lg:p-6 border-0"
              style={{
                background: `linear-gradient(135deg, ${EM.bg}, transparent 70%)`,
                boxShadow: EM.glow,
                border: `1px solid ${EM.border}`,
              }}
            >
              <div className="admin-label" style={{ color: EM.base }}>
                Faturamento fora da Turo
              </div>
              <div
                key={revenue}
                className="mt-2 text-4xl lg:text-5xl font-light tabular-nums tracking-tight animate-fade-in"
                style={{ color: EM.base }}
              >
                ${revenue.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Acumulado do mês · gerado pelo canal de agências
              </div>
            </Card>
          </div>

          {/* Mapa da Flórida */}
          <Card className="order-1 lg:order-1 p-4 lg:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="admin-section-title flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: EM.base }} />
                Malha da Flórida
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Ao vivo
              </span>
            </div>
            <FloridaMap points={AGENCIES} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {AGENCIES.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: a.primary ? EM.base : "hsl(var(--foreground) / 0.35)" }}
                  />
                  {a.city} · {a.name}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </AdminSection>

      {/* Seus carros no canal */}
      <AdminSection>
        <Card className="p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="admin-section-title">Seus carros no canal</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {activeCount} de {featuredVehicles.length} veículos disponíveis para agências
              </div>
            </div>
            <Badge
              variant="outline"
              style={{ background: EM.bg, color: EM.base, borderColor: EM.border }}
            >
              Preço B2B
            </Badge>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {featuredVehicles.map((v) => {
                const on = !!channelOn[v.id];
                const price = agencyPrice(v.daily_price_usd);
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="h-12 w-16 rounded-md overflow-hidden bg-muted shrink-0">
                      <img
                        src={getCoverImage(v.name)}
                        alt={v.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">
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
                    <div className="shrink-0 pl-2">
                      <Switch
                        checked={on}
                        onCheckedChange={(checked) => {
                          setChannelOn((prev) => ({ ...prev, [v.id]: checked }));
                          toast(checked ? "Publicado no canal" : "Removido do canal", {
                            description: v.name,
                          });
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
      </AdminSection>

      {/* Promoções de janela ociosa */}
      <AdminSection>
        <Card className="p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="admin-section-title">Promoções de janela ociosa</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                <Brain className="h-3 w-3" style={{ color: EM.base }} />
                Detectado pela Frota Inteligente
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {windows.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-border/60 p-4 flex flex-col gap-3 bg-background"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{w.vehicle}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Livre de {w.range}
                    </div>
                  </div>
                  {w.published ? (
                    <Badge
                      variant="outline"
                      className="shrink-0"
                      style={{ background: EM.bg, color: EM.base, borderColor: EM.border }}
                    >
                      <Radio className="h-3 w-3 mr-1" />
                      No ar para 7 agências
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
                    <div className="text-2xl font-light tabular-nums" style={{ color: EM.base }}>
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
                        ? {
                            background: EM.base,
                            color: "white",
                            boxShadow: EM.glow,
                          }
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
      </AdminSection>

      {/* Rodapé roadmap */}
      <AdminSection>
        <Card
          className="p-5 lg:p-7 border-0"
          style={{
            background: `linear-gradient(135deg, ${EM.bg}, transparent 60%)`,
            border: `1px solid ${EM.border}`,
          }}
        >
          <div className="admin-label mb-4" style={{ color: EM.base }}>
            VISÃO DE FUTURO
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-2 items-start">
            <RoadmapStep
              phase="Hoje"
              title="GoDalz Viagens conectada"
              icon={<Handshake className="h-4 w-4" />}
              active
            />
            <RoadmapStep
              phase="Em breve"
              title="Novas agências parceiras da Flórida"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <RoadmapStep
              phase="Futuro"
              title="Rede nacional de agências"
              icon={<Rocket className="h-4 w-4" />}
              last
            />
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
            style={{
              borderLeft: `4px solid ${EM.base}`,
              boxShadow: EM.glow,
            }}
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
                <div className="text-sm font-medium mt-0.5">
                  Sunshine Travel quer o Corolla Prata
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  4 diárias · $216
                </div>
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDecline}
                    className="flex-1"
                  >
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
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span style={{ color: EM.base }}>{icon}</span>
        <span className="admin-label">{label}</span>
      </div>
      <div className="mt-2 text-2xl lg:text-3xl font-light tabular-nums">{value}</div>
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
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
            )}
            style={{
              background: active ? EM.base : EM.bg,
              color: active ? "white" : EM.base,
              boxShadow: active ? EM.glow : undefined,
            }}
          >
            {icon}
          </span>
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: EM.base }}
            >
              {phase}
            </div>
            <div className="text-sm font-medium">{title}</div>
          </div>
        </div>
      </div>
      {!last && (
        <ArrowRight
          className="hidden md:block h-4 w-4 mt-3 shrink-0 opacity-30"
          aria-hidden
        />
      )}
    </div>
  );
}

// SVG estilizado da Flórida (não é mapa real, é ilustrativo)
function FloridaMap({ points }: { points: AgencyPoint[] }) {
  return (
    <div
      className="relative w-full aspect-[10/12] max-h-[420px] rounded-lg overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, hsl(var(--muted) / 0.35), hsl(var(--muted) / 0.1))",
      }}
    >
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        {/* Silhueta estilizada da Flórida */}
        <path
          d="M 10 22
             L 78 20
             L 82 30
             C 84 40, 85 50, 78 60
             C 72 70, 66 78, 62 88
             C 60 100, 62 112, 72 122
             C 78 130, 84 132, 84 136
             L 78 138
             C 70 132, 60 122, 55 108
             C 50 96, 44 88, 34 84
             C 22 78, 14 68, 12 52
             C 10 40, 8 30, 10 22 Z"
          fill="hsl(var(--foreground) / 0.06)"
          stroke="hsl(var(--foreground) / 0.18)"
          strokeWidth="0.4"
        />
        {/* Pontos */}
        {points.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.primary ? 5 : 3.5}
              fill={EM.base}
              opacity={0.25}
            >
              <animate
                attributeName="r"
                values={`${p.primary ? 5 : 3.5};${p.primary ? 9 : 7};${p.primary ? 5 : 3.5}`}
                dur="2.4s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.35;0;0.35"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.primary ? 2 : 1.4}
              fill={EM.base}
            />
            <text
              x={p.x + 3.5}
              y={p.y + 1.5}
              fontSize="3"
              fill="hsl(var(--foreground) / 0.7)"
              style={{ fontFamily: "inherit" }}
            >
              {p.city}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
