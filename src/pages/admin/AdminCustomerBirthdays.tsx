import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Cake, Search, Gift, CalendarDays, CalendarRange, Sparkles, MessageCircle, Phone, Mail, Copy, Check } from "lucide-react";
import { CustomersSubNav } from "@/components/admin/CustomersSubNav";
import { formatPersonName } from "@/lib/formatName";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { EmptyState } from "@/components/admin/EmptyState";
import { toast } from "@/hooks/use-toast";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import { LoadingRows } from "@/components/skeletons/LoadingRows";

/* ============================================================
   ANIVERSARIANTES — Visão estratégica para marketing
   Filtros: Hoje · Esta semana · Este mês · Próximos 90 dias
   ============================================================ */

type CustomerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  preferred_language: string | null;
};

type Enriched = CustomerRow & {
  birthDate: Date;
  monthDay: number; // MMDD
  daysUntil: number; // 0..365
  turningAge: number;
  isToday: boolean;
};

type Bucket = "today" | "week" | "month" | "quarter" | "all";

const MONTHS_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function birthdayGreeting(name: string, lang: string | null) {
  const first = formatPersonName(name).split(" ")[0] || "";
  switch ((lang || "pt").toLowerCase()) {
    case "en":
      return `Hi ${first}! Everyone at GoDrive wishes you a happy birthday — a year full of safe roads, new adventures and unforgettable moments. We have a special treat waiting for you. Talk soon!`;
    case "es":
      return `¡Hola ${first}! Todo el equipo de GoDrive te desea un muy feliz cumpleaños — un año lleno de caminos seguros, nuevas aventuras y momentos inolvidables. Tenemos un mimo especial para ti. ¡Nos hablamos pronto!`;
    default:
      return `Olá ${first}! Todo o time da GoDrive te deseja um feliz aniversário — um ano cheio de boas estradas, novas aventuras e momentos inesquecíveis. Temos um mimo especial reservado pra você. Falamos em breve!`;
  }
}

function fmtDateLong(d: Date) {
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
}

function fmtRelative(daysUntil: number) {
  if (daysUntil === 0) return "Hoje";
  if (daysUntil === 1) return "Amanhã";
  if (daysUntil < 7) return `Em ${daysUntil} dias`;
  if (daysUntil < 14) return "Próxima semana";
  if (daysUntil < 31) return `Em ${daysUntil} dias`;
  const weeks = Math.round(daysUntil / 7);
  if (weeks < 9) return `Em ~${weeks} semanas`;
  const months = Math.round(daysUntil / 30);
  return `Em ~${months} meses`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function AdminCustomerBirthdays() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobileApp();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("month");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, email, phone, date_of_birth, preferred_language")
        .is("deleted_at", null)
        .neq("source", "turo")
        .not("date_of_birth", "is", null);
      setRows((data as CustomerRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const enriched: Enriched[] = useMemo(() => {
    const today = startOfDay(new Date());
    const out: Enriched[] = [];
    rows.forEach((c) => {
      if (!c.date_of_birth) return;
      const [y, m, d] = c.date_of_birth.split("-").map(Number);
      if (!y || !m || !d) return;
      const birthDate = new Date(y, m - 1, d);
      // próximo aniversário a partir de hoje
      let next = new Date(today.getFullYear(), m - 1, d);
      if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
      const daysUntil = Math.round((+next - +today) / 86_400_000);
      const turningAge = next.getFullYear() - y;
      out.push({
        ...c,
        birthDate,
        monthDay: m * 100 + d,
        daysUntil,
        turningAge,
        isToday: daysUntil === 0,
      });
    });
    return out.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [rows]);

  const buckets = useMemo(() => {
    const today = enriched.filter((e) => e.daysUntil === 0);
    const week = enriched.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 7);
    const month = enriched.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 31);
    const quarter = enriched.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 90);
    return { today, week, month, quarter, all: enriched };
  }, [enriched]);

  const currentList = useMemo(() => {
    let list = buckets[bucket] || [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => `${e.full_name} ${e.email ?? ""} ${e.phone ?? ""}`.toLowerCase().includes(q));
    return list;
  }, [buckets, bucket, search]);

  // Group "este mês" / "próximos 90 dias" por mês
  const grouped = useMemo(() => {
    if (bucket !== "month" && bucket !== "quarter" && bucket !== "all") return null;
    const map = new Map<string, Enriched[]>();
    const now = new Date();
    currentList.forEach((e) => {
      // mês do próximo aniversário (já calculado)
      const monthIdx = e.birthDate.getMonth();
      const key = MONTHS_PT[monthIdx].toUpperCase();
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    // ordena pelos meses na ordem do "próximo aniversário"
    const monthOrder: string[] = [];
    currentList.forEach((e) => {
      const k = MONTHS_PT[e.birthDate.getMonth()].toUpperCase();
      if (!monthOrder.includes(k)) monthOrder.push(k);
    });
    return monthOrder.map((k) => [k, map.get(k) || []] as const);
  }, [currentList, bucket]);

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: "Mensagem copiada", description: "Cole onde quiser enviar." });
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const BUCKET_TABS: { id: Bucket; label: string; icon: typeof Cake; count: number }[] = [
    { id: "today",   label: "Hoje",            icon: Gift,         count: buckets.today.length },
    { id: "week",    label: "Esta semana",     icon: Sparkles,     count: buckets.week.length },
    { id: "month",   label: "Este mês",        icon: CalendarDays, count: buckets.month.length },
    { id: "quarter", label: "Próx. 90 dias",   icon: CalendarRange,count: buckets.quarter.length },
    { id: "all",     label: "Todos",           icon: Cake,         count: buckets.all.length },
  ];

  return (
    <div className="p-3 lg:p-6 space-y-4 lg:space-y-6 pb-24 lg:pb-6">
      <CustomersSubNav />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="admin-h1 flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            Aniversariantes
          </h1>
          <p className="admin-label mt-1.5">
            Planeje ações de marketing e cuide de cada relacionamento no momento certo.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aniversariante…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
          />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
        {BUCKET_TABS.slice(0, 4).map((t) => {
          const Icon = t.icon;
          const active = bucket === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setBucket(t.id)}
              className={`text-left rounded-xl border p-3.5 transition-all admin-card ${
                active
                  ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                  : "border-border/40 bg-card hover:border-border/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="admin-label text-[10px]">{t.label}</span>
                <Icon size={14} className={active ? "text-primary" : "text-muted-foreground/60"} />
              </div>
              <div className={`mt-2 admin-kpi text-2xl ${active ? "text-primary" : ""}`}>{t.count}</div>
              <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                {t.count === 0 ? "ninguém" : t.count === 1 ? "cliente" : "clientes"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Segmented control */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit max-w-full overflow-x-auto scrollbar-none">
        {BUCKET_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setBucket(t.id)}
            className={`h-8 px-3 rounded-lg text-[11.5px] font-medium whitespace-nowrap transition-all ${
              bucket === t.id
                ? "bg-background text-foreground shadow-sm border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] tabular-nums ${bucket === t.id ? "text-primary" : "text-muted-foreground/60"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingRows count={5} rowHeight={64} className="px-0" />
      ) : currentList.length === 0 ? (
        <EmptyState
          icon={Cake}
          title={bucket === "today" ? "Ninguém faz aniversário hoje" : "Nenhum aniversariante neste período"}
          description={
            bucket === "today"
              ? "Aproveite pra programar suas ações para os próximos dias."
              : "Cadastre datas de nascimento nos perfis dos clientes pra começar a planejar ações."
          }
        />
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map(([month, list]) => (
            <section key={month}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="admin-section-title">{month}</h2>
                <span className="flex-1 h-px bg-border/40" />
                <span className="text-[10.5px] text-muted-foreground tabular-nums">{list.length}</span>
              </div>
              <BirthdayGrid
                list={list}
                isMobile={isMobile}
                onCustomer={(id) => navigate(`/admin/customers/${id}`)}
                onCopy={copyMessage}
                copiedId={copiedId}
              />
            </section>
          ))}
        </div>
      ) : (
        <BirthdayGrid
          list={currentList}
          isMobile={isMobile}
          onCustomer={(id) => navigate(`/admin/customers/${id}`)}
          onCopy={copyMessage}
          copiedId={copiedId}
        />
      )}
    </div>
  );
}

/* -------------------- Grid de cards -------------------- */

function BirthdayGrid({
  list,
  isMobile,
  onCustomer,
  onCopy,
  copiedId,
}: {
  list: Enriched[];
  isMobile: boolean;
  onCustomer: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
      {list.map((c) => (
        <BirthdayCard
          key={c.id}
          c={c}
          onClick={() => onCustomer(c.id)}
          onCopy={(text) => onCopy(c.id, text)}
          copied={copiedId === c.id}
        />
      ))}
    </div>
  );
}

function BirthdayCard({
  c,
  onClick,
  onCopy,
  copied,
}: {
  c: Enriched;
  onClick: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  const displayName = formatPersonName(c.full_name);
  const greeting = birthdayGreeting(c.full_name, c.preferred_language);
  const wa = buildWhatsAppUrl(c.phone, greeting);
  const phoneDigits = (c.phone || "").replace(/\D/g, "");

  return (
    <div
      className={`group relative admin-card overflow-hidden rounded-xl border bg-card transition-all ${
        c.isToday
          ? "border-primary/50 ring-1 ring-primary/20 shadow-[0_0_0_3px_hsl(var(--primary)/0.05)]"
          : "border-border/40 hover:border-border/70"
      }`}
    >
      {c.isToday && (
        <div className="absolute top-0 right-0 left-0 h-1 gold-gradient" />
      )}

      <div className="p-4 flex items-start gap-3">
        <button
          onClick={onClick}
          className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[13px] font-semibold shrink-0 hover:bg-primary/20 transition"
          aria-label={`Abrir ${displayName}`}
        >
          {initials(c.full_name) || "?"}
        </button>

        <div className="flex-1 min-w-0">
          <button onClick={onClick} className="text-left w-full">
            <div className="text-sm font-semibold text-foreground truncate">{displayName}</div>
            <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-muted-foreground">
              <Cake size={11} className="shrink-0" />
              <span className="truncate">{fmtDateLong(c.birthDate)} · faz {c.turningAge}</span>
            </div>
          </button>

          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                c.isToday
                  ? "bg-primary/15 text-primary"
                  : c.daysUntil <= 7
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {fmtRelative(c.daysUntil)}
            </span>
            {c.preferred_language && c.preferred_language !== "pt" && (
              <span className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground/80 font-semibold">
                {c.preferred_language}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-3.5 pt-1 flex items-center gap-1.5">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-9 rounded-lg bg-[#25D366] text-white text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition"
          >
            <MessageCircle size={13} /> Enviar parabéns
          </a>
        ) : (
          <span className="flex-1 h-9 rounded-lg bg-muted text-muted-foreground/60 text-[11px] inline-flex items-center justify-center">
            Sem telefone
          </span>
        )}
        <button
          onClick={() => onCopy(greeting)}
          className="h-9 w-9 rounded-lg border border-border/50 bg-background text-muted-foreground hover:text-foreground hover:border-border inline-flex items-center justify-center transition"
          title="Copiar mensagem"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            className="h-9 w-9 rounded-lg border border-border/50 bg-background text-muted-foreground hover:text-foreground hover:border-border inline-flex items-center justify-center transition"
            title="Ligar"
          >
            <Phone size={13} />
          </a>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}?subject=${encodeURIComponent("Feliz aniversário!")}&body=${encodeURIComponent(greeting)}`}
            className="h-9 w-9 rounded-lg border border-border/50 bg-background text-muted-foreground hover:text-foreground hover:border-border inline-flex items-center justify-center transition"
            title="Email"
          >
            <Mail size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
