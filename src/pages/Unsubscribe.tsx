import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (res.ok && data.valid) setState({ kind: "ready" });
        else if (data.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid" });
      } catch {
        setState({ kind: "invalid" });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.success) setState({ kind: "success" });
      else if (data.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: data.error ?? "Erro ao processar." });
    } catch (e: any) {
      setState({ kind: "error", message: e.message ?? "Erro de rede." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-[10px] tracking-[0.24em] uppercase text-primary font-semibold mb-2">
            GoDrive
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Cancelar inscrição</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-sm">Validando link…</p>
            </div>
          )}

          {state.kind === "ready" && (
            <>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Tem certeza que deseja parar de receber e-mails da GoDrive?
                Você ainda receberá comunicações essenciais sobre reservas ativas.
              </p>
              <button
                onClick={confirm}
                className="w-full bg-foreground text-background rounded-xl py-3 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Confirmar cancelamento
              </button>
            </>
          )}

          {state.kind === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-sm">Processando…</p>
            </div>
          )}

          {state.kind === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="text-primary" size={36} />
              <p className="text-sm">
                Pronto. Sua inscrição foi cancelada com sucesso.
              </p>
            </div>
          )}

          {state.kind === "already" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <CheckCircle2 className="text-muted-foreground" size={32} />
              <p className="text-sm">Este e-mail já havia sido descadastrado.</p>
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <XCircle className="text-destructive" size={32} />
              <p className="text-sm">Link inválido ou expirado.</p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <XCircle className="text-destructive" size={32} />
              <p className="text-sm">{state.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
