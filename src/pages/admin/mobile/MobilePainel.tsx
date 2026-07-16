import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, CalendarPlus, Car, ChevronRight, ClipboardCheck, LogIn,
  LogOut as LogOutIcon, Phone, Radio, Sparkles, Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPersonName } from "@/lib/formatName";
import { MobileList, MobileListItem } from "@/components/mobile/MobileListItem";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { SwipeAction } from "@/components/mobile/SwipeAction";
import PresentationModeButton from "@/components/admin/PresentationModeButton";
import GuidedTourButton from "@/components/admin/guided-tour/GuidedTourButton";

/* ============================================================
   PAINEL Mobile-first.
   - Hero "próxima ação" do dia: card grande, ação primária full-width.
   - KPIs em chips horizontais (scroll), tap navega.
   - Timeline do dia agrupada por período (Manhã/Tarde/Noite),
     com swipe-action por item.
   - Atalhos rápidos (4 tiles).
   ============================================================ */

type BookingRow = {
  id: string;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  total_price: number | null;
  created_at: string;
  vehicle_id: string | null;
  customer_name: string | null;
};

interface MobilePainelProps {
  bookings: BookingRow[];
  vehicles: { id: string; name: string | null; status: string | null; color: string | null }[];
  onRefresh: () => Promise<void>;
  aiMode?: boolean;
  onToggleAi?: () => void;
}

const ACTIVE_STATUSES = new Set(["confirmed", "active", "in_progress"]);
const PREP_STATUSES = new Set(["maintenance", "preparing", "cleaning", "in_preparation"]);
const todayStr = () => format(new Date(), "yyyy-MM-dd");

type Period = "morning" | "afternoon" | "evening";
function periodOf(time: string | null): Period {
  const h = parseInt((time || "00:00").slice(0, 2), 10);
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
const PERIOD_LABEL: Record<Period, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export default function MobilePainel({ bookings, vehicles, onRefresh, aiMode, onToggleAi }: MobilePainelProps) {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const today = todayStr();

  // ───── Stats ─────
  const rodando = bookings.filter(
    (b) =>
      ACTIVE_STATUSES.has(b.status) &&
      b.pickup_date <= today &&
      b.return_date >= today,
  ).length;
  const disponiveis = vehicles.filter((v) => v.status === "available").length;
  const emPreparo = vehicles.filter((v) =>
    PREP_STATUSES.has((v.status || "").toLowerCase()),
  ).length;
  const pendentes = bookings.filter((b) => b.status === "pending").length;
  const totalFrota = vehicles.length;
  const ocupacao = totalFrota ? Math.round((rodando / totalFrota) * 100) : 0;

  const vehicleLabel = (vehicleId: string | null) => {
    if (!vehicleId) return "Veículo não atribuído";
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo não atribuído";
    const name = v.name || "Veículo";
    return v.color ? `${name} · ${v.color}` : name;
  };

  // ───── Today's events ─────
  type Evt = { id: string; t: string; kind: "in" | "out"; name: string; customer: string; bookingId: string };
  const events: Evt[] = useMemo(() => {
    const ins = bookings
      .filter((b) => b.pickup_date === today && b.status !== "cancelled" && b.pickup_time)
      .map<Evt>((b) => ({
        id: `in-${b.id}`,
        t: b.pickup_time!,
        kind: "in",
        name: vehicleLabel(b.vehicle_id),
        customer: formatPersonName(b.customer_name || ""),
        bookingId: b.id,
      }));
    const outs = bookings
      .filter((b) => b.return_date === today && b.status !== "cancelled" && b.return_time)
      .map<Evt>((b) => ({
        id: `out-${b.id}`,
        t: b.return_time!,
        kind: "out",
        name: vehicleLabel(b.vehicle_id),
        customer: formatPersonName(b.customer_name || ""),
        bookingId: b.id,
      }));
    return [...ins, ...outs].sort((a, b) => a.t.localeCompare(b.t));
  }, [bookings, today, vehicles]);

  const nowHHmm = format(now, "HH:mm");
  const proxima = events.find((e) => e.t >= nowHHmm) || events[0];

  const grouped = useMemo(() => {
    const g: Record<Period, Evt[]> = { morning: [], afternoon: [], evening: [] };
    events.forEach((e) => g[periodOf(e.t)].push(e));
    return g;
  }, [events]);

  return (
    <PullToRefresh
      onRefresh={onRefresh}
      className="h-full"
    >
      <div className="space-y-5 pb-4">
        {/* ═══════════ HERO. Próxima ação ═══════════ */}
        <section>
          <SectionLabel>Próxima ação</SectionLabel>
          {proxima ? (
            <button
              onClick={() => navigate(`/admin/bookings/${proxima.bookingId}`)}
              className="w-full text-left rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/40 p-5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-[40px] font-light tabular-nums leading-none text-foreground">
                  {proxima.t.slice(0, 5)}
                </span>
                <span
                  className={`text-[10.5px] uppercase tracking-[0.16em] font-semibold ${
                    proxima.kind === "in"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {proxima.kind === "in" ? "Check-in" : "Check-out"}
                </span>
              </div>
              <div className="mt-2 text-[16px] font-medium text-foreground truncate">
                {proxima.name}
              </div>
              {proxima.customer && (
                <div className="text-[12px] text-muted-foreground truncate">
                  {proxima.customer}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">
                  Toque para abrir a reserva
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground">
                  Abrir <ChevronRight size={14} />
                </span>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-5">
              <p className="text-[14px] text-muted-foreground">
                Nenhuma retirada ou devolução programada para hoje.
              </p>
            </div>
          )}
        </section>

        {/* ═══════════ KPIs horizontais ═══════════ */}
        <section>
          <SectionLabel>Frota agora</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <KpiChip
              label="Rodando"
              value={`${rodando}/${totalFrota}`}
              sub={`${ocupacao}% ocupação`}
              tone="emerald"
              onClick={() => navigate("/admin/live")}
            />
            <KpiChip
              label="Disponíveis"
              value={disponiveis}
              sub="Prontas"
              tone="neutral"
              onClick={() => navigate("/admin/fleet?status=available")}
            />
            <KpiChip
              label="Em preparo"
              value={emPreparo}
              sub={emPreparo === 0 ? "Tudo em dia" : "Aguardando"}
              tone={emPreparo > 0 ? "amber" : "neutral"}
              onClick={() => navigate("/admin/fleet?status=maintenance")}
            />
            <KpiChip
              label="Pendências"
              value={pendentes}
              sub={pendentes === 0 ? "Tudo ok" : "A confirmar"}
              tone={pendentes > 0 ? "rose" : "neutral"}
              onClick={() => navigate("/admin/bookings?status=pending")}
            />
          </div>

        </section>

        {/* ═══════════ Timeline do dia ═══════════ */}
        <section className="space-y-3">
          <SectionLabel>
            Hoje · {format(now, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </SectionLabel>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/50 p-5 text-center">
              <p className="text-[14px] text-muted-foreground">
                Sem operações programadas. Bom dia para colocar a frota em dia.
              </p>
            </div>
          ) : (
            (["morning", "afternoon", "evening"] as Period[])
              .filter((p) => grouped[p].length > 0)
              .map((p) => (
                <div key={p} className="space-y-1.5">
                  <div className="px-1 text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/80">
                    {PERIOD_LABEL[p]} · {grouped[p].length}
                  </div>
                  <MobileList>
                    {grouped[p].map((e) => (
                      <SwipeAction
                        key={e.id}
                        rightActions={[
                          {
                            icon: Phone,
                            label: "Ligar",
                            color: "emerald",
                            onTrigger: () => {
                              // Phone resolution happens on booking detail; fall back to nav.
                              navigate(`/admin/bookings/${e.bookingId}`);
                            },
                          },
                        ]}
                      >
                        <MobileListItem
                          meta={e.kind === "in" ? "Check-in" : "Check-out"}
                          title={e.name}
                          subtitle={e.customer ? `${e.customer} · ${e.t.slice(0, 5)}` : `Programado para ${e.t.slice(0, 5)}`}
                          leading={
                            <EventBadge
                              kind={e.kind}
                              past={e.t < nowHHmm}
                            />
                          }
                          trailing={
                            <span className="text-[14px] font-medium tabular-nums text-foreground">
                              {e.t.slice(0, 5)}
                            </span>
                          }
                          accent={e.t < nowHHmm && e.kind === "in" ? "danger" : undefined}
                          onClick={() => navigate(`/admin/bookings/${e.bookingId}`)}
                        />
                      </SwipeAction>
                    ))}
                  </MobileList>
                </div>
              ))
          )}
        </section>

        {/* ═══════════ 🧠 AI Studio ═══════════ */}
        {onToggleAi && (
          <button
            onClick={onToggleAi}
            className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3 active:scale-[0.99] transition-transform ${
              aiMode
                ? "border-cyan-300/40 bg-gradient-to-r from-cyan-500/15 via-violet-500/15 to-fuchsia-500/15 shadow-[0_0_20px_rgba(120,180,255,0.25)]"
                : "border-border/40 bg-card/70 hover:bg-card"
            }`}
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              aiMode ? "bg-cyan-500/20 text-cyan-300" : "bg-foreground/5 text-foreground"
            }`}>
              <Brain size={20} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-foreground">🧠 AI Studio</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {aiMode ? "🧠 AI Studio ativado. Toque para voltar" : "Insights inteligentes da frota"}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/50" />
          </button>
        )}

        <div className="flex flex-col items-center gap-2">
          <GuidedTourButton />
          <PresentationModeButton />
        </div>


        {/* ═══════════ Atalhos ═══════════ */}
        <section>
          <SectionLabel>Atalhos</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <ShortcutTile
              icon={CalendarPlus}
              label="Nova reserva"
              onClick={() => navigate("/admin/bookings/new")}
            />
            <ShortcutTile
              icon={ClipboardCheck}
              label="Operação do dia"
              onClick={() => navigate("/admin/ops-today")}
            />
            <ShortcutTile
              icon={Car}
              label="Frota"
              onClick={() => navigate("/admin/fleet")}
            />
            <ShortcutTile
              icon={Radio}
              label="Rastreio Live"
              onClick={() => navigate("/admin/live")}
            />
          </div>
        </section>
      </div>
    </PullToRefresh>
  );
}

/* ─────────── Building blocks ─────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/80">
      {children}
    </div>
  );
}

type Tone = "neutral" | "emerald" | "amber" | "rose";
const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-foreground",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};
const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/40",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

function KpiChip({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: Tone;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/40 bg-card/70 active:bg-card transition-colors p-3.5"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className={`text-[24px] font-light tabular-nums leading-none ${TONE_VALUE[tone]}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground/80 leading-tight truncate">
        {sub}
      </div>
    </button>
  );
}

function EventBadge({ kind, past }: { kind: "in" | "out"; past: boolean }) {
  const Icon = kind === "in" ? LogIn : LogOutIcon;
  return (
    <div
      className={`h-10 w-10 rounded-full flex items-center justify-center ${
        kind === "in"
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-blue-500/12 text-blue-600 dark:text-blue-400"
      } ${past ? "opacity-60" : ""}`}
    >
      <Icon size={18} strokeWidth={1.8} />
    </div>
  );
}

function ShortcutTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: import("lucide-react").LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="aspect-[1.6] rounded-2xl border border-border/40 bg-card/70 active:bg-card flex flex-col items-start justify-between p-3.5 transition-colors"
    >
      <div className="h-9 w-9 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground">
        <Icon size={18} className="opacity-85" />
      </div>
      <span className="text-[13.5px] font-medium text-foreground">{label}</span>
    </button>
  );
}
