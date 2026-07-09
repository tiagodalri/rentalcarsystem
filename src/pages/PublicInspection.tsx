import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, ShieldAlert, Calendar, MapPin, User, Car, Gauge, Fuel,
  Camera, AlertTriangle, ClipboardCheck, CheckCircle2, XCircle, Hash,
  FileSignature, Printer, Download,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { normalizeDamageText } from "@/lib/damageTextNormalizer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};
const FUEL_PCT: Record<string, number> = {
  empty: 0, "1/8": 12.5, "1/4": 25, "3/8": 37.5,
  "1/2": 50, "5/8": 62.5, "3/4": 75, "7/8": 87.5, full: 100,
};
const ACCESSORIES_LABELS: Record<string, string> = {
  jack: "Macaco", antenna: "Antena", first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe", triangle: "Triângulo", floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};
const SEVERITY_LABELS: Record<string, string> = { light: "Leve", medium: "Moderada", heavy: "Grave" };
const SEVERITY_COLOR: Record<string, string> = {
  light: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  medium: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  heavy: "bg-red-500/10 text-red-700 border-red-500/30",
};

const fmtName = (n?: string | null) => {
  if (!n) return "—";
  const s = new Set(["da","de","do","das","dos","e","di","du"]);
  return n.toLowerCase().split(/\s+/).map(w => s.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

type State = { status: "loading" | "ok" | "error"; error?: string; data?: any };

export default function PublicInspection() {
  const { token } = useParams();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) return;
    document.title = "Inspeção do Veículo — Sua Marca";
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-inspection-view?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ status: "error", error: body?.error || `http_${res.status}` });
          return;
        }
        setState({ status: "ok", data: body });
      } catch (e: any) {
        setState({ status: "error", error: e?.message || "network_error" });
      }
    })();
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin mx-auto text-primary" size={28} />
          <p className="text-sm text-muted-foreground">Carregando inspeção…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const errMap: Record<string, string> = {
      not_found: "Este link de inspeção não existe ou foi removido.",
      revoked: "Este link foi revogado pela equipe Sua Marca.",
      expired: "Este link expirou.",
      invalid_token: "Link inválido.",
    };
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-2xl border border-border bg-card p-8">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="text-destructive" size={22} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Não foi possível abrir esta inspeção</h1>
          <p className="text-sm text-muted-foreground">{errMap[state.error || ""] || "Tente novamente mais tarde."}</p>
        </div>
      </div>
    );
  }

  const { type, booking, vehicle, inspection } = state.data;
  const isCheckin = type === "checkin";
  const damages: any[] = inspection.damages ?? [];
  const photos: any[] = inspection.exterior_photos ?? [];
  const acc: Record<string, boolean> = inspection.accessories_check ?? {};
  const fuelPct = FUEL_PCT[inspection.fuel_level] ?? 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-foreground text-background print:bg-white print:text-black print:border-b print:border-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" dark showMark={false} className="print:invert-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-background/60 print:text-black/60">Sua Marca</p>
              <h1 className="text-base sm:text-lg font-semibold truncate">
                {isCheckin ? "Inspeção de Entrega" : "Inspeção de Devolução"}
              </h1>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-background/30 px-3 py-2 hover:bg-background/10 transition print:hidden"
          >
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Sumário */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Reserva</p>
                <p className="text-sm font-medium text-foreground tabular-nums flex items-center gap-1.5">
                  <Hash size={12} className="text-muted-foreground" />
                  {booking.booking_number || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Cliente</p>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <User size={12} className="text-muted-foreground" /> {fmtName(booking.customer_name)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Veículo</p>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Car size={12} className="text-muted-foreground" />
                  {vehicle ? `${vehicle.name}${vehicle.plate ? ` • ${vehicle.plate}` : ""}` : "Não vinculado"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  {isCheckin ? "Retirada" : "Devolução"}
                </p>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Calendar size={12} className="text-muted-foreground" />
                  {fmtDate(isCheckin ? booking.pickup_date : booking.return_date)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <MapPin size={11} /> {(isCheckin ? booking.pickup_location : booking.return_location) || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Inspeção finalizada</p>
                <p className="text-sm font-medium text-foreground tabular-nums">{fmtDateTime(inspection.completed_at)}</p>
                <p className="text-xs text-muted-foreground">Agente: {fmtName(inspection.agent_name)}</p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 px-2.5 py-1">
                <CheckCircle2 size={11} /> Inspeção concluída
              </div>
            </div>
          </div>
        </section>

        {/* Odômetro & Combustível */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Gauge size={11} /> Odômetro
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {inspection.odometer_reading?.toLocaleString("pt-BR") ?? "—"}
              <span className="text-xs font-normal text-muted-foreground ml-1">mi</span>
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Fuel size={11} /> Combustível
            </p>
            <p className="text-2xl font-semibold text-foreground">{FUEL_LABELS[inspection.fuel_level] || "—"}</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground/80 transition-all"
                style={{ width: `${fuelPct}%` }}
              />
            </div>
          </div>
        </section>

        {/* Acessórios */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <ClipboardCheck size={11} /> Checklist de Acessórios
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(ACCESSORIES_LABELS).map(([k, label]) => {
              const ok = acc[k] !== false;
              return (
                <div key={k} className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg border ${ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
                  {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <span className="truncate">{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Avarias */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold flex items-center gap-1.5">
              <AlertTriangle size={11} /> Avarias Registradas
            </p>
            <span className="text-xs font-medium text-foreground tabular-nums">{damages.length}</span>
          </div>
          {damages.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma avaria registrada.</p>
          ) : (
            <ul className="space-y-3">
              {damages.map((d, i) => (
                <li key={i} className="flex gap-3 items-start rounded-xl border border-border/60 p-3 bg-background/40">
                  {d.photo_url ? (
                    <img src={d.photo_url} alt={d.position} className="w-20 h-20 object-contain rounded-lg flex-shrink-0 border border-border bg-muted/30" loading="lazy" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                      <Camera size={16} className="text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{d.position}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${SEVERITY_COLOR[d.severity] || "border-border"}`}>
                        {SEVERITY_LABELS[d.severity] || d.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-words">{normalizeDamageText(d.description || "") || "Sem descrição"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Fotos */}
        {photos.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold flex items-center gap-1.5">
                <Camera size={11} /> Registro Fotográfico
                <span className="ml-1 text-foreground font-medium">{photos.length}</span>
              </p>
              <DownloadAllPhotosButton
                photos={photos}
                prefix={`zeus-${booking.booking_number || "inspecao"}-${isCheckin ? "entrega" : "devolucao"}`}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {photos.map((p, i) => (
                <figure key={i} className="rounded-xl overflow-hidden border border-border bg-muted/40">
                  {p.url ? (
                    <img src={p.url} alt={p.position} className="w-full h-32 sm:h-36 object-contain bg-muted/30" loading="lazy" />
                  ) : (
                    <div className="w-full h-32 sm:h-36 flex items-center justify-center">
                      <Camera size={18} className="text-muted-foreground/50" />
                    </div>
                  )}
                  <figcaption className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1.5">{p.position}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Observações */}
        {inspection.notes && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">Observações</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{inspection.notes}</p>
          </section>
        )}

        {/* Assinaturas */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <FileSignature size={11} /> Assinaturas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { url: inspection.agent_signature, label: "Agente Sua Marca", name: inspection.agent_name },
              { url: inspection.customer_signature, label: "Cliente", name: booking.customer_name },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="h-24 flex items-center justify-center rounded-lg bg-muted/30 border border-dashed border-border">
                  {s.url ? (
                    <img src={s.url} alt={`Assinatura ${s.label}`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">— sem assinatura —</span>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">{s.label}</p>
                <p className="text-xs font-medium text-foreground">{fmtName(s.name)}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-[11px] text-muted-foreground pt-2 pb-6">
          Documento gerado por Sua Marca • Link público compartilhado pela equipe.
        </footer>
      </div>
    </div>
  );
}

function DownloadAllPhotosButton({ photos, prefix }: { photos: any[]; prefix: string }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleDownload = async () => {
    const valid = photos.filter((p) => p?.url);
    if (valid.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: valid.length });
    try {
      for (let i = 0; i < valid.length; i++) {
        const p = valid[i];
        try {
          const res = await fetch(p.url);
          const blob = await res.blob();
          const safePos = String(p.position || `foto-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `${prefix}-${String(i + 1).padStart(2, "0")}-${safePos}.jpg`;
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 1500);
          // pequena pausa para o navegador não engasgar com muitos downloads simultâneos
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          // ignora falha individual e segue
        }
        setProgress({ done: i + 1, total: valid.length });
      }
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 1500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-border bg-background px-3 py-1.5 hover:bg-muted transition disabled:opacity-60 print:hidden"
    >
      {busy ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          Baixando {progress?.done}/{progress?.total}
        </>
      ) : (
        <>
          <Download size={12} /> Baixar todas as fotos
        </>
      )}
    </button>
  );
}
